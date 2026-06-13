using System.Net;
using System.Text;
using System.Text.Json;
using DeliveryApp.API.Data;
using DeliveryApp.API.Models;
using DeliveryApp.API.Services;
using DeliveryApp.Tests.Helpers;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Moq;
using Moq.Protected;

namespace DeliveryApp.Tests.AI;

public class AiChatServiceTests
{
    private static AiChatService CreateService(
        out AppDbContext db,
        string geminiResponseBody = "",
        int httpStatusCode = 200,
        string? apiKey = "test-gemini-key",
        string dbName = "")
    {
        db = TestDbHelper.CreateInMemoryDb(dbName.Length > 0 ? dbName : Guid.NewGuid().ToString());

        if (apiKey != null)
            db.SystemConfigs.Add(new SystemConfig { Key = "ai_api_key", Value = apiKey });
        db.SaveChanges();

        var handlerMock = new Mock<HttpMessageHandler>();
        handlerMock.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage
            {
                StatusCode = (HttpStatusCode)httpStatusCode,
                Content = new StringContent(geminiResponseBody, Encoding.UTF8, "application/json")
            });

        var http = new HttpClient(handlerMock.Object);
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["AI:Provider"] = "gemini",
                ["AI:Model"] = "gemini-2.0-flash",
                ["AI:ApiKey"] = ""
            })
            .Build();

        var audit = new AuditService(db, new Mock<IHttpContextAccessor>().Object);
        return new AiChatService(db, config, http, audit);
    }

    private static string GeminiOkResponse(string text) =>
        JsonSerializer.Serialize(new
        {
            candidates = new[]
            {
                new { content = new { parts = new[] { new { text } } } }
            }
        });

    // ── Không có API key ──────────────────────────────────────────────────

    [Fact]
    public async Task Chat_NoApiKey_ReturnsConfigError()
    {
        var db = TestDbHelper.CreateInMemoryDb();
        var audit = new AuditService(db, new Mock<IHttpContextAccessor>().Object);
        var svc = new AiChatService(db,
            new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?> { ["AI:ApiKey"] = "" })
                .Build(),
            new HttpClient(),
            audit);

        var resp = await svc.ChatAsync("xin chao", null);

        Assert.False(resp.Success);
        // Service trả "chưa được kích hoạt" trong Answer và "chưa được cấu hình" trong Error.
        Assert.Contains("chưa được kích hoạt", resp.Answer);
    }

    // ── Câu hỏi thông thường ─────────────────────────────────────────────

    [Fact]
    public async Task Chat_Greeting_ReturnsDirectAnswer_NoSql()
    {
        var svc = CreateService(out _, GeminiOkResponse("Xin chào! Tôi có thể giúp gì cho bạn?"));
        var resp = await svc.ChatAsync("xin chao", null);

        Assert.True(resp.Success);
        Assert.Contains("Xin chào", resp.Answer);
        Assert.Null(resp.SqlQuery);
        Assert.Null(resp.TableData);
    }

    [Fact]
    public async Task Chat_ReturnsNewSessionId_WhenNoSessionProvided()
    {
        var svc = CreateService(out _, GeminiOkResponse("OK"));
        var resp = await svc.ChatAsync("test", null);

        Assert.False(string.IsNullOrEmpty(resp.SessionId));
    }

    [Fact]
    public async Task Chat_PreservesSessionId_AcrossMultipleTurns()
    {
        var svc = CreateService(out _, GeminiOkResponse("OK"));
        var resp1 = await svc.ChatAsync("câu 1", "session-abc");
        var resp2 = await svc.ChatAsync("câu 2", "session-abc");

        Assert.Equal("session-abc", resp1.SessionId);
        Assert.Equal("session-abc", resp2.SessionId);
    }

    // ── Bảo mật SQL ──────────────────────────────────────────────────────

    [Fact]
    public async Task Chat_DeleteSql_IsBlocked()
    {
        var svc = CreateService(out _, GeminiOkResponse("```sql\nDELETE FROM \"Orders\";\n```"));
        var resp = await svc.ChatAsync("xóa tất cả đơn hàng", null);

        Assert.False(resp.Success);
        Assert.Contains("bảo mật", resp.Answer);
        Assert.Null(resp.TableData);
    }

    [Fact]
    public async Task Chat_DropTableSql_IsBlocked()
    {
        var svc = CreateService(out _, GeminiOkResponse("```sql\nDROP TABLE \"Orders\";\n```"));
        var resp = await svc.ChatAsync("xóa bảng", null);

        Assert.False(resp.Success);
    }

    [Fact]
    public async Task Chat_UpdateSql_IsBlocked()
    {
        var svc = CreateService(out _, GeminiOkResponse("```sql\nUPDATE \"Orders\" SET \"Status\"='PaidCash' WHERE 1=1;\n```"));
        var resp = await svc.ChatAsync("cập nhật tất cả đơn", null);

        Assert.False(resp.Success);
    }

    [Fact]
    public async Task Chat_InsertSql_IsBlocked()
    {
        var svc = CreateService(out _, GeminiOkResponse("```sql\nINSERT INTO \"Orders\" VALUES (1);\n```"));
        var resp = await svc.ChatAsync("thêm đơn hàng", null);

        Assert.False(resp.Success);
    }

    // ── Lỗi Gemini API ────────────────────────────────────────────────────

    [Fact]
    public async Task Chat_Gemini429_ReturnsQuotaMessage()
    {
        var body = JsonSerializer.Serialize(new
        {
            error = new { code = 429, message = "RESOURCE_EXHAUSTED", status = "RESOURCE_EXHAUSTED" }
        });
        var svc = CreateService(out _, body, 429);

        var resp = await svc.ChatAsync("hỏi gì đó", null);

        Assert.False(resp.Success);
        Assert.Contains("quota", resp.Answer.ToLower());
    }

    [Fact]
    public async Task Chat_Gemini401_ReturnsInvalidKeyMessage()
    {
        var body = JsonSerializer.Serialize(new
        {
            error = new { code = 401, message = "API_KEY_INVALID" }
        });
        var svc = CreateService(out _, body, 401);

        var resp = await svc.ChatAsync("hỏi gì đó", null);

        Assert.False(resp.Success);
        Assert.Contains("không hợp lệ", resp.Answer.ToLower());
    }

    // ── SELECT hợp lệ với InMemory DB ────────────────────────────────────

    [Fact]
    public async Task Chat_ValidSelect_ButInMemoryDbUnsupported_HandlesGracefully()
    {
        // InMemory DB không hỗ trợ raw SQL → service sẽ retry và trả về lỗi gracefully
        // Lần gọi 1: trả về SQL SELECT hợp lệ
        var svc = CreateService(out _,
            GeminiOkResponse("```sql\nSELECT COUNT(*) FROM \"Orders\";\n```"));

        var resp = await svc.ChatAsync("có bao nhiêu đơn hàng?", null);

        // InMemory không chạy raw SQL, service xử lý lỗi và trả về answer thân thiện
        Assert.NotNull(resp);
        Assert.False(string.IsNullOrEmpty(resp.SessionId));
    }
}
