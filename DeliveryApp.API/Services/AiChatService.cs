using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using DeliveryApp.API.Data;
using Microsoft.EntityFrameworkCore;

namespace DeliveryApp.API.Services;

public class AiChatRequest
{
    public string Question { get; set; } = string.Empty;
    public string? SessionId { get; set; }
}

public class AiChatResponse
{
    public string Answer { get; set; } = string.Empty;
    public string? SqlQuery { get; set; }
    public List<Dictionary<string, object?>>? TableData { get; set; }
    public bool Success { get; set; } = true;
    public string? Error { get; set; }
    public string SessionId { get; set; } = string.Empty;
}

public record ChatTurn(string Role, string Content);

public class AiChatService
{
    private const int MaxHistoryMessages = 20;
    private const int SessionIdleHours = 2;
    private const int QueryTimeoutSeconds = 15;
    private const int MaxTokens = 2048;
    private const double Temperature = 0.2;

    private static readonly string[] ForbiddenSqlKeywords =
        { "INSERT", "UPDATE", "DELETE", "DROP", "TRUNCATE", "ALTER", "CREATE", "GRANT", "REVOKE", "EXEC", "EXECUTE" };

    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    private readonly HttpClient _http;

    private static readonly ConcurrentDictionary<string, (List<ChatTurn> History, DateTime LastAccess)> _sessions = new();

    private static readonly string DbSchema = @"
Cơ sở dữ liệu PostgreSQL của hệ thống quản lý giao hàng Khương Phúc gồm các bảng sau:

Bảng ""Users"" (người dùng):
- Id (uuid, PK)
- Username (varchar, tên đăng nhập)
- FullName (varchar, họ tên đầy đủ)
- Role (varchar: 'Admin', 'Accountant', 'Shipper')
- IsActive (boolean, trạng thái hoạt động)
- CreatedAt (timestamp)

Bảng ""Orders"" (đơn hàng):
- Id (uuid, PK)
- OrderCode (varchar, mã đơn hàng, duy nhất)
- RouteCode (varchar, mã tuyến đường)
- CustomerName (varchar, tên khách hàng)
- Amount (decimal, tổng tiền cần thu)
- AmountPaid (decimal, tiền đã thu được)
- Status (varchar: 'Pending','WaitingTransfer','PaidCash','PaidTransfer','Partial','Scheduled','Unpaid','Unassigned')
- ShipperId (uuid, FK -> Users.Id)
- ImportId (uuid, FK -> ImportLogs.Id)
- UnpaidReason (varchar, lý do chưa thu)
- ScheduledDate (timestamp, ngày hẹn lại)
- DeliveredAt (timestamp, thời điểm giao hàng)
- ShipperNote (varchar, ghi chú của shipper)
- LockedAt (timestamp, thời điểm khóa)
- CreatedAt (timestamp)
- UpdatedAt (timestamp)

Bảng ""SePayTransactions"" (giao dịch chuyển khoản từ SePay):
- Id (uuid, PK)
- TransactionCode (varchar, mã giao dịch)
- Amount (decimal, số tiền)
- Content (varchar, nội dung chuyển khoản)
- Gateway (varchar, tên ngân hàng / cổng thanh toán)
- AccountNumber (varchar, số tài khoản)
- TransactionDate (timestamp, thời điểm giao dịch)
- OrderId (uuid, FK -> Orders.Id, nullable)
- MatchStatus (varchar: 'Unmatched','AutoMatched','ManualMatched')
- MatchedAt (timestamp)
- CreatedAt (timestamp)

Bảng ""ImportLogs"" (lịch sử import):
- Id (uuid, PK)
- FileName (varchar, tên file)
- TotalRows (int), ImportedRows (int), SkippedRows (int)
- ImportedBy (varchar)
- CreatedAt (timestamp)

Bảng ""OrderHistories"" (lịch sử thay đổi đơn hàng):
- Id (uuid, PK)
- OrderId (uuid, FK -> Orders.Id)
- ChangedBy (varchar), FieldChanged (varchar)
- OldValue (varchar), NewValue (varchar), Reason (varchar)
- CreatedAt (timestamp)

LƯU Ý QUAN TRỌNG:
- Tên bảng/cột PostgreSQL dùng dấu ngoặc kép: ""TableName"".""ColumnName""
- Trạng thái đã thu tiền: Status IN ('PaidCash','PaidTransfer','Partial')
- Trạng thái chưa thu: Status = 'Unpaid'
- Doanh thu = SUM(""AmountPaid"")
- Hôm nay: DATE(""CreatedAt"") = CURRENT_DATE
- Tuần này: ""CreatedAt"" >= DATE_TRUNC('week', CURRENT_DATE)
- Tháng này: ""CreatedAt"" >= DATE_TRUNC('month', CURRENT_DATE)
- JOIN shipper: JOIN ""Users"" u ON u.""Id"" = o.""ShipperId""
";

    public AiChatService(AppDbContext db, IConfiguration config, HttpClient http)
    {
        _db = db;
        _config = config;
        _http = http;
    }

    // ── Session management ────────────────────────────────────────────────────

    private static List<ChatTurn> GetOrCreateSession(string sessionId)
    {
        var cutoff = DateTime.UtcNow.AddHours(-SessionIdleHours);
        foreach (var key in _sessions.Keys.ToList())
            if (_sessions.TryGetValue(key, out var s) && s.LastAccess < cutoff)
                _sessions.TryRemove(key, out _);

        var entry = _sessions.GetOrAdd(sessionId, _ => (new List<ChatTurn>(), DateTime.UtcNow));
        _sessions[sessionId] = (entry.History, DateTime.UtcNow);
        return entry.History;
    }

    private static void AppendToSession(string sessionId, string userMsg, string assistantMsg)
    {
        if (!_sessions.TryGetValue(sessionId, out var entry)) return;
        entry.History.Add(new ChatTurn("user", userMsg));
        entry.History.Add(new ChatTurn("assistant", assistantMsg));
        while (entry.History.Count > MaxHistoryMessages) entry.History.RemoveAt(0);
        _sessions[sessionId] = (entry.History, DateTime.UtcNow);
    }

    // ── Main entry point ──────────────────────────────────────────────────────

    public async Task<AiChatResponse> ChatAsync(string question, string? sessionId)
    {
        sessionId ??= Guid.NewGuid().ToString();
        var history = GetOrCreateSession(sessionId);

        var (apiKey, provider, model) = await LoadAiConfigAsync();

        if (string.IsNullOrEmpty(apiKey))
            return new AiChatResponse
            {
                Success = false,
                Error = "AI chưa được cấu hình. Vui lòng liên hệ Admin để thêm API Key.",
                Answer = "Tính năng AI chưa được kích hoạt.",
                SessionId = sessionId
            };

        try
        {
            var sqlPrompt = BuildSqlPrompt(question, history);
            var sqlResult = await CallLlmAsync(sqlPrompt, provider, model, apiKey);
            var sql = ExtractSql(sqlResult);

            if (string.IsNullOrEmpty(sql))
            {
                AppendToSession(sessionId, question, sqlResult);
                return new AiChatResponse { Answer = sqlResult, Success = true, SessionId = sessionId };
            }

            if (!IsSafeQuery(sql))
            {
                var safeAnswer = "Tôi không thể thực hiện thao tác này vì lý do bảo mật.";
                AppendToSession(sessionId, question, safeAnswer);
                return new AiChatResponse { Success = false, Error = "Chỉ cho phép SELECT.", Answer = safeAnswer, SessionId = sessionId };
            }

            List<Dictionary<string, object?>> tableData;
            try
            {
                tableData = await ExecuteQueryAsync(sql);
            }
            catch (Exception ex)
            {
                var retrySql = ExtractSql(await CallLlmAsync(BuildRetryPrompt(question, sql, ex.Message), provider, model, apiKey));
                if (!string.IsNullOrEmpty(retrySql) && IsSafeQuery(retrySql))
                {
                    try { tableData = await ExecuteQueryAsync(retrySql); sql = retrySql; }
                    catch
                    {
                        return FailResponse(sessionId, question, "Xin lỗi, tôi không thể xử lý câu hỏi này. Vui lòng thử câu hỏi cụ thể hơn.", ex.Message);
                    }
                }
                else
                {
                    return FailResponse(sessionId, question, "Xin lỗi, tôi không thể truy vấn dữ liệu lúc này.", ex.Message);
                }
            }

            var answer = await CallLlmAsync(BuildSummaryPrompt(question, sql, tableData), provider, model, apiKey);
            AppendToSession(sessionId, question, answer);
            return new AiChatResponse
            {
                Answer = answer,
                SqlQuery = sql,
                TableData = tableData.Count > 0 ? tableData : null,
                Success = true,
                SessionId = sessionId
            };
        }
        catch (Exception ex)
        {
            return new AiChatResponse
            {
                Success = false,
                Error = ex.Message,
                Answer = MapApiError(ex.Message),
                SessionId = sessionId
            };
        }
    }

    private async Task<(string apiKey, string provider, string model)> LoadAiConfigAsync()
    {
        var keys = new[] { "ai_api_key", "ai_provider", "ai_model" };
        var configs = await _db.SystemConfigs.Where(c => keys.Contains(c.Key)).ToDictionaryAsync(c => c.Key, c => c.Value);

        string Pick(string key, string fallback) =>
            (configs.TryGetValue(key, out var v) && !string.IsNullOrEmpty(v)) ? v : fallback;

        return (
            Pick("ai_api_key", _config["AI:ApiKey"] ?? ""),
            Pick("ai_provider", _config["AI:Provider"] ?? "openrouter"),
            Pick("ai_model", _config["AI:Model"] ?? "deepseek/deepseek-chat-v3.1")
        );
    }

    private static AiChatResponse FailResponse(string sessionId, string question, string answer, string error)
    {
        AppendToSession(sessionId, question, answer);
        return new AiChatResponse { Success = false, Error = error, Answer = answer, SessionId = sessionId };
    }

    private static string MapApiError(string msg)
    {
        bool Has(params string[] needles) => needles.Any(n => msg.Contains(n, StringComparison.OrdinalIgnoreCase));

        if (Has("429", "TooManyRequests", "RESOURCE_EXHAUSTED", "rate limit"))
            return "API key đã hết quota hoặc bị giới hạn tốc độ. Vui lòng liên hệ Admin để cập nhật API key hoặc đổi model khác.";
        if (Has("401", "403", "API_KEY_INVALID", "invalid_api_key"))
            return "API key không hợp lệ. Vui lòng liên hệ Admin để cập nhật API key.";
        return "Có lỗi xảy ra khi kết nối AI. Vui lòng thử lại.";
    }

    // ── Prompt builders ───────────────────────────────────────────────────────

    private static string BuildSqlPrompt(string question, List<ChatTurn> history)
    {
        var historyCtx = history.Count > 0
            ? "\nLịch sử hội thoại gần đây:\n" + string.Join("\n",
                history.TakeLast(6).Select(h => $"[{h.Role}]: {h.Content[..Math.Min(h.Content.Length, 200)]}"))
            : "";

        return $@"Bạn là trợ lý kế toán thông minh của doanh nghiệp Khương Phúc.
Nhiệm vụ: tạo câu SQL PostgreSQL để trả lời câu hỏi, HOẶC trả lời trực tiếp nếu không cần truy vấn.

{DbSchema}
{historyCtx}

Quy tắc:
1. CHỈ dùng SELECT, không INSERT/UPDATE/DELETE/DROP
2. Luôn dùng dấu ngoặc kép cho tên bảng/cột: ""TableName"".""ColumnName""
3. LIMIT 50 nếu không chỉ định số lượng
4. Cột kết quả đặt tên tiếng Việt (dùng AS)
5. Nếu câu hỏi là chào hỏi, hỏi về hệ thống, hoặc không cần dữ liệu → trả lời trực tiếp KHÔNG dùng SQL
6. Sử dụng lịch sử hội thoại để hiểu ngữ cảnh câu hỏi hiện tại

Câu hỏi: {question}

Nếu cần SQL:
```sql
[câu SQL]
```

Nếu không cần SQL, trả lời trực tiếp bằng tiếng Việt.";
    }

    private static string BuildRetryPrompt(string question, string failedSql, string error) =>
        $@"Câu SQL sau bị lỗi PostgreSQL:
```sql
{failedSql}
```
Lỗi: {error}

Câu hỏi gốc: {question}

{DbSchema}

Tạo lại SQL đúng cú pháp PostgreSQL, nhớ dùng ngoặc kép cho tên bảng/cột.
```sql
[câu SQL đúng]
```";

    private static string BuildSummaryPrompt(string question, string sql, List<Dictionary<string, object?>> data)
    {
        var dataJson = data.Count == 0
            ? "Không có dữ liệu"
            : JsonSerializer.Serialize(data.Take(20));

        return $@"Bạn là trợ lý kế toán của Khương Phúc.

Câu hỏi: {question}
Kết quả từ DB: {dataJson}

Tóm tắt ngắn gọn bằng tiếng Việt (3-5 câu), nêu rõ số liệu quan trọng. Nếu không có dữ liệu, nói rõ. Không giải thích kỹ thuật.";
    }

    // ── LLM routing ───────────────────────────────────────────────────────────

    private Task<string> CallLlmAsync(string prompt, string provider, string model, string apiKey) =>
        provider.ToLowerInvariant() switch
        {
            "gemini" => CallGeminiAsync(prompt, model, apiKey),
            "anthropic" => CallAnthropicAsync(prompt, model, apiKey),
            "openai" => CallChatCompletionsAsync(prompt, model, apiKey, "https://api.openai.com/v1/chat/completions", null),
            _ => CallChatCompletionsAsync(prompt, model, apiKey, "https://openrouter.ai/api/v1/chat/completions",
                new[] { ("HTTP-Referer", "https://khuongphuc.local"), ("X-Title", "Khuong Phuc Delivery") })
        };

    private async Task<string> CallChatCompletionsAsync(string prompt, string model, string apiKey, string url, IEnumerable<(string, string)>? extraHeaders)
    {
        var body = JsonSerializer.Serialize(new
        {
            model,
            max_tokens = MaxTokens,
            temperature = Temperature,
            messages = new[] { new { role = "user", content = prompt } }
        });

        var req = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        };
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        if (extraHeaders != null)
            foreach (var (k, v) in extraHeaders) req.Headers.Add(k, v);

        var json = await SendAndReadAsync(req, "Chat completion");
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString() ?? "";
    }

    private async Task<string> CallGeminiAsync(string prompt, string model, string apiKey)
    {
        var url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}";
        var body = JsonSerializer.Serialize(new
        {
            contents = new[] { new { parts = new[] { new { text = prompt } } } },
            generationConfig = new { temperature = Temperature, maxOutputTokens = MaxTokens }
        });

        var req = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        };

        var json = await SendAndReadAsync(req, "Gemini");
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement
            .GetProperty("candidates")[0]
            .GetProperty("content")
            .GetProperty("parts")[0]
            .GetProperty("text")
            .GetString() ?? "";
    }

    private async Task<string> CallAnthropicAsync(string prompt, string model, string apiKey)
    {
        var body = JsonSerializer.Serialize(new
        {
            model,
            max_tokens = MaxTokens,
            messages = new[] { new { role = "user", content = prompt } }
        });

        var req = new HttpRequestMessage(HttpMethod.Post, "https://api.anthropic.com/v1/messages")
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        };
        req.Headers.Add("x-api-key", apiKey);
        req.Headers.Add("anthropic-version", "2023-06-01");

        var json = await SendAndReadAsync(req, "Anthropic");
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.GetProperty("content")[0].GetProperty("text").GetString() ?? "";
    }

    private async Task<string> SendAndReadAsync(HttpRequestMessage req, string providerLabel)
    {
        var res = await _http.SendAsync(req);
        var json = await res.Content.ReadAsStringAsync();
        if (!res.IsSuccessStatusCode)
            throw new Exception($"{providerLabel} error {res.StatusCode}: {json}");
        return json;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static string ExtractSql(string response)
    {
        var m = Regex.Match(response, @"```sql\s*([\s\S]*?)\s*```", RegexOptions.IgnoreCase);
        if (m.Success) return m.Groups[1].Value.Trim();

        var sel = Regex.Match(response, @"(SELECT\s[\s\S]+?;)", RegexOptions.IgnoreCase);
        return sel.Success ? sel.Groups[1].Value.Trim() : string.Empty;
    }

    private static bool IsSafeQuery(string sql)
    {
        var upper = sql.ToUpperInvariant();
        return upper.TrimStart().StartsWith("SELECT") &&
               !ForbiddenSqlKeywords.Any(kw => Regex.IsMatch(upper, $@"\b{kw}\b"));
    }

    private async Task<List<Dictionary<string, object?>>> ExecuteQueryAsync(string sql)
    {
        var results = new List<Dictionary<string, object?>>();
        var conn = _db.Database.GetDbConnection();
        var wasOpen = conn.State == System.Data.ConnectionState.Open;
        if (!wasOpen) await conn.OpenAsync();
        try
        {
            using var cmd = conn.CreateCommand();
            cmd.CommandText = sql;
            cmd.CommandTimeout = QueryTimeoutSeconds;
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var row = new Dictionary<string, object?>();
                for (int i = 0; i < reader.FieldCount; i++)
                    row[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i);
                results.Add(row);
            }
        }
        finally
        {
            if (!wasOpen) await conn.CloseAsync();
        }
        return results;
    }
}
