using System.Text.Json;
using DeliveryApp.API.Data;
using DeliveryApp.API.Models;
using DeliveryApp.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DeliveryApp.API.Controllers;

[ApiController]
[Route("api")]
public class SePayController : ControllerBase
{
    private readonly SePayService _sepay;
    private readonly AppDbContext _db;

    public SePayController(SePayService sepay, AppDbContext db)
    {
        _sepay = sepay;
        _db = db;
    }

    [HttpPost("webhooks/sepay")]
    [AllowAnonymous]
    public async Task<IActionResult> Webhook()
    {
        string rawBody;
        using (var reader = new StreamReader(Request.Body))
            rawBody = await reader.ReadToEndAsync();

        // SePay xác thực webhook qua 1 trong 2 cách:
        // - HMAC: header "X-Sepay-Signature: sha256=<hex>"
        // - Static key: header "Authorization: Apikey <key>" hoặc "x-api-key: <key>"
        var apiKey = "";
        var authHeader = Request.Headers["Authorization"].FirstOrDefault() ?? "";
        if (authHeader.StartsWith("Apikey ", StringComparison.OrdinalIgnoreCase))
            apiKey = authHeader.Substring(7).Trim();
        else if (authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            apiKey = authHeader.Substring(7).Trim();
        else
            apiKey = Request.Headers["x-api-key"].FirstOrDefault()?.Trim() ?? "";

        var signature = Request.Headers["X-Sepay-Signature"].FirstOrDefault()?.Trim() ?? "";

        // Log toàn bộ header (loại Cookie)
        var allHeaders = string.Join("; ", Request.Headers
            .Where(h => !h.Key.StartsWith(":") && !h.Key.Equals("Cookie", StringComparison.OrdinalIgnoreCase))
            .Select(h => $"{h.Key}={h.Value}"));

        var log = new WebhookLog { RawBody = rawBody, Headers = allHeaders };
        _db.WebhookLogs.Add(log);
        await _db.SaveChangesAsync();

        if (!await _sepay.VerifyWebhookAsync(apiKey, signature, rawBody))
        {
            log.ResponseCode = "09";
            log.ErrorMessage = string.IsNullOrEmpty(apiKey) && string.IsNullOrEmpty(signature)
                ? "Missing authentication (no Authorization, x-api-key, or X-Sepay-Signature header)"
                : "Invalid API key or signature mismatch";
            await _db.SaveChangesAsync();
            return Ok(new { code = "09", message = log.ErrorMessage });
        }

        SePayWebhookPayload? payload;
        try { payload = JsonSerializer.Deserialize<SePayWebhookPayload>(rawBody, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }); }
        catch { return Ok(new { code = "xx", message = "Invalid payload" }); }

        if (payload == null) return Ok(new { code = "xx", message = "Empty payload" });

        var code = await _sepay.ProcessWebhookAsync(payload, rawBody);
        log.ResponseCode = code;
        await _db.SaveChangesAsync();

        return Ok(new { code, message = code == "00" ? "Success" : code == "02" ? "Duplicate" : "Error" });
    }

    [HttpGet("sepay/unmatched")]
    [Authorize(Roles = "Accountant,Admin,Shipper")]
    public async Task<IActionResult> GetUnmatched([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var result = await _sepay.GetUnmatchedAsync(page, pageSize);
        return Ok(result);
    }

    [HttpGet("sepay/stats")]
    [Authorize(Roles = "Accountant,Admin")]
    public async Task<IActionResult> GetStats()
    {
        var stats = await _sepay.GetStatsAsync();
        return Ok(stats);
    }

    [HttpGet("sepay/transactions")]
    [Authorize(Roles = "Accountant,Admin")]
    public async Task<IActionResult> GetTransactions(
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var result = await _sepay.GetTransactionsAsync(status, search, page, pageSize);
        return Ok(result);
    }

    [HttpGet("sepay/webhook-logs")]
    [Authorize(Roles = "Accountant,Admin")]
    public async Task<IActionResult> GetWebhookLogs([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var result = await _sepay.GetWebhookLogsAsync(page, pageSize);
        return Ok(result);
    }

    [HttpPost("sepay/assign")]
    [Authorize(Roles = "Accountant,Admin")]
    public async Task<IActionResult> Assign([FromBody] AssignRequest req)
    {
        var assignedBy = User.Identity?.Name ?? "";
        var ok = await _sepay.AssignTransactionAsync(req.TransactionId, req.OrderId, assignedBy);
        if (!ok) return BadRequest(new { message = "Giao dịch không tồn tại, đã khớp, hoặc đơn hàng không hợp lệ" });
        return Ok();
    }

    [HttpDelete("sepay/transactions/{id:guid}/match")]
    [Authorize(Roles = "Accountant,Admin")]
    public async Task<IActionResult> Unassign(Guid id)
    {
        var byUser = User.Identity?.Name ?? "";
        var ok = await _sepay.UnassignTransactionAsync(id, byUser);
        if (!ok) return BadRequest(new { message = "Không thể bỏ khớp giao dịch này" });
        return Ok();
    }
}

public record AssignRequest(Guid TransactionId, Guid OrderId);
