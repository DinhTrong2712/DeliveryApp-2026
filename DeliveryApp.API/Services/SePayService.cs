using System.Security.Cryptography;
using System.Text;
using DeliveryApp.API.Data;
using DeliveryApp.API.DTOs.Orders;
using DeliveryApp.API.Hubs;
using DeliveryApp.API.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace DeliveryApp.API.Services;

/// <summary>
/// Payload SePay gửi về khi có giao dịch chuyển khoản mới.
/// Tham khảo: https://docs.sepay.vn/webhook
/// </summary>
public class SePayWebhookPayload
{
    public int Id { get; set; }
    public string? Gateway { get; set; }
    public string? TransactionDate { get; set; }
    public string? AccountNumber { get; set; }
    public string? SubAccount { get; set; }
    public string? Content { get; set; }
    public string? TransferType { get; set; }
    public decimal TransferAmount { get; set; }
    public decimal Accumulated { get; set; }
    public string? ReferenceCode { get; set; }
    public string? Description { get; set; }
}

public class SePayService
{
    private const string WebhookActor = "sepay-webhook";
    private const string AccountantsGroup = "accountants";

    private readonly AppDbContext _db;
    private readonly IHubContext<DeliveryHub> _hub;
    private readonly IConfiguration _config;
    private readonly AuditService _audit;
    private readonly NotificationService _notifications;

    public SePayService(AppDbContext db, IHubContext<DeliveryHub> hub, IConfiguration config, AuditService audit, NotificationService notifications)
    {
        _db = db;
        _hub = hub;
        _config = config;
        _audit = audit;
        _notifications = notifications;
    }

    /// <summary>
    /// Xác thực webhook SePay. Hỗ trợ 2 phương thức:
    /// 1. HMAC SHA256 signature (khuyến nghị). SePay ký chuỗi "{timestamp}.{raw_body}"
    ///    rồi gửi qua header "X-SePay-Signature: sha256=&lt;hex&gt;" và "X-SePay-Timestamp: &lt;unix_seconds&gt;".
    ///    (Tham khảo: https://developer.sepay.vn/sepay-webhooks/xac-thuc)
    /// 2. Static API key (SePay gửi qua "Authorization: Apikey ..." hoặc "x-api-key: ...").
    /// </summary>
    public async Task<bool> VerifyWebhookAsync(string? apiKey, string? signature, string? timestamp, string rawBody)
    {
        var cfg = await _db.SystemConfigs.FirstOrDefaultAsync(c => c.Key == "sepay_apikey");
        var storedSecret = cfg?.Value ?? _config["SePay:ApiKey"] ?? "";

        if (string.IsNullOrEmpty(storedSecret)) return false;

        // So sánh constant-time để chống timing attack — kẻ tấn công không suy ra được key
        // qua thời gian phản hồi khác nhau giữa các lần fail.
        if (!string.IsNullOrEmpty(apiKey) && FixedTimeEqualsString(storedSecret, apiKey)) return true;

        if (!string.IsNullOrEmpty(signature) && !string.IsNullOrEmpty(rawBody))
        {
            var expected = signature.StartsWith("sha256=", StringComparison.OrdinalIgnoreCase)
                ? signature[7..].Trim()
                : signature.Trim();

            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(storedSecret));

            // Chuỗi được ký: chuẩn SePay là "{timestamp}.{raw_body}"; fallback raw_body thuần
            // để tương thích ngược nếu thiếu header timestamp.
            var candidates = new List<string>();
            if (!string.IsNullOrEmpty(timestamp)) candidates.Add($"{timestamp}.{rawBody}");
            candidates.Add(rawBody);

            foreach (var data in candidates)
            {
                var computed = Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(data))).ToLowerInvariant();
                if (FixedTimeEqualsString(computed, expected.ToLowerInvariant())) return true;
            }
        }

        return false;
    }

    private static bool FixedTimeEqualsString(string a, string b)
    {
        var ba = Encoding.UTF8.GetBytes(a);
        var bb = Encoding.UTF8.GetBytes(b);
        return ba.Length == bb.Length && CryptographicOperations.FixedTimeEquals(ba, bb);
    }

    [Obsolete("Use VerifyWebhookAsync instead", false)]
    public Task<bool> VerifyApiKeyAsync(string apiKey) => VerifyWebhookAsync(apiKey, null, null, "");

    public async Task<string> ProcessWebhookAsync(SePayWebhookPayload payload, string rawJson)
    {
        if (!string.Equals(payload.TransferType, "in", StringComparison.OrdinalIgnoreCase))
            return "00";

        var transactionCode = string.IsNullOrEmpty(payload.ReferenceCode)
            ? payload.Id.ToString()
            : payload.ReferenceCode;

        if (await _db.SePayTransactions.AnyAsync(t => t.TransactionCode == transactionCode))
            return "02";

        var tx = new SePayTransaction
        {
            TransactionCode = transactionCode,
            Amount = payload.TransferAmount,
            Content = payload.Content ?? payload.Description,
            Gateway = payload.Gateway,
            AccountNumber = payload.AccountNumber,
            ReferenceCode = payload.ReferenceCode,
            TransactionDate = ParseTransactionDate(payload.TransactionDate),
            RawPayload = rawJson
        };

        var contentToSearch = $"{payload.Content} {payload.Description}".Trim().ToUpperInvariant();
        // Match cả đơn WaitingTransfer (chờ CK) lẫn Partial (đã CK 1 phần, đang chờ phần còn lại).
        var candidateOrders = await _db.Orders
            .Where(o => o.Status == OrderStatus.WaitingTransfer || o.Status == OrderStatus.Partial)
            .Select(o => new { o.Id, o.OrderCode })
            .ToListAsync();

        // Ưu tiên match OrderCode dài nhất để tránh match nhầm khi 1 code là prefix của code khác (DG2 ⊂ DG2001).
        var matchedId = candidateOrders
            .Where(o => contentToSearch.Contains(o.OrderCode.ToUpperInvariant()))
            .OrderByDescending(o => o.OrderCode.Length)
            .Select(o => (Guid?)o.Id)
            .FirstOrDefault();

        var order = matchedId.HasValue ? await _db.Orders.FindAsync(matchedId.Value) : null;

        if (order != null)
        {
            tx.OrderId = order.Id;
            tx.MatchStatus = MatchStatus.AutoMatched;
            tx.MatchedAt = DateTime.UtcNow;
            tx.MatchedBy = WebhookActor;

            await ApplyMatchToOrderAsync(order, payload.TransferAmount, WebhookActor, $"SePay auto-match: {transactionCode}");
            _db.SePayTransactions.Add(tx);

            _audit.Add("AUTO_MATCH", "SePayTransaction", tx.Id,
                newValue: order.OrderCode,
                description: $"Tự động khớp {transactionCode} → {order.OrderCode} ({tx.Amount:N0}đ)",
                overrideUsername: WebhookActor);

            await _db.SaveChangesAsync();

            await EmitMatchedAsync(order, transactionCode, tx.Amount);
            return "00";
        }

        _db.SePayTransactions.Add(tx);
        await _db.SaveChangesAsync();

        await _hub.Clients.Group(AccountantsGroup)
            .SendAsync("UnmatchedTransaction", new
            {
                transactionCode,
                amount = tx.Amount,
                content = tx.Content,
                gateway = tx.Gateway
            });

        return "00";
    }

    public async Task<List<SePayTransaction>> GetUnmatchedAsync(int page, int pageSize) =>
        await _db.SePayTransactions
            .Where(t => t.MatchStatus == MatchStatus.Unmatched)
            .OrderByDescending(t => t.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

    public async Task<SePayStatsDto> GetStatsAsync()
    {
        var counts = await _db.SePayTransactions
            .GroupBy(t => t.MatchStatus)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Status, x => x.Count);

        return new SePayStatsDto
        {
            Unmatched = counts.GetValueOrDefault(MatchStatus.Unmatched),
            AutoMatched = counts.GetValueOrDefault(MatchStatus.AutoMatched),
            ManualMatched = counts.GetValueOrDefault(MatchStatus.ManualMatched),
        };
    }

    public async Task<PagedResult<SePayTransactionDto>> GetTransactionsAsync(
        string? status, string? search, int page, int pageSize)
    {
        var query = _db.SePayTransactions.Include(t => t.Order).AsQueryable();

        if (!string.IsNullOrEmpty(status) && Enum.TryParse<MatchStatus>(status, true, out var matchStatus))
            query = query.Where(t => t.MatchStatus == matchStatus);

        if (!string.IsNullOrEmpty(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(t =>
                t.TransactionCode.ToLower().Contains(s) ||
                (t.Content != null && t.Content.ToLower().Contains(s)) ||
                (t.Order != null && t.Order.OrderCode.ToLower().Contains(s)));
        }

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(t => t.TransactionDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(t => new SePayTransactionDto
            {
                Id = t.Id,
                TransactionCode = t.TransactionCode,
                Amount = t.Amount,
                Content = t.Content,
                Gateway = t.Gateway,
                TransactionDate = t.TransactionDate,
                MatchStatus = t.MatchStatus.ToString(),
                MatchedBy = t.MatchedBy,
                MatchedAt = t.MatchedAt,
                OrderId = t.OrderId,
                OrderCode = t.Order != null ? t.Order.OrderCode : null,
            })
            .ToListAsync();

        return new PagedResult<SePayTransactionDto>(items, total, page, pageSize);
    }

    public async Task<PagedResult<WebhookLogDto>> GetWebhookLogsAsync(int page, int pageSize)
    {
        var total = await _db.WebhookLogs.CountAsync();
        var items = await _db.WebhookLogs
            .OrderByDescending(l => l.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(l => new WebhookLogDto
            {
                Id = l.Id,
                ResponseCode = l.ResponseCode,
                ErrorMessage = l.ErrorMessage,
                CreatedAt = l.CreatedAt,
                RawBodyPreview = l.RawBody != null && l.RawBody.Length > 200
                    ? l.RawBody.Substring(0, 200) + "..."
                    : l.RawBody,
            })
            .ToListAsync();

        return new PagedResult<WebhookLogDto>(items, total, page, pageSize);
    }

    public async Task<bool> AssignTransactionAsync(Guid transactionId, Guid orderId, string assignedBy)
    {
        var tx = await _db.SePayTransactions.FindAsync(transactionId);
        var order = await _db.Orders.FindAsync(orderId);
        if (tx == null || order == null) return false;
        if (tx.MatchStatus != MatchStatus.Unmatched) return false;
        // Không cho gán CK vào đơn đã thu đủ bằng tiền mặt — tránh ghi đè AmountPaid và mất dữ liệu.
        if (order.Status == OrderStatus.PaidCash) return false;

        tx.OrderId = orderId;
        tx.MatchStatus = MatchStatus.ManualMatched;
        tx.MatchedBy = assignedBy;
        tx.MatchedAt = DateTime.UtcNow;

        await ApplyMatchToOrderAsync(order, tx.Amount, assignedBy, $"Manual match: {tx.TransactionCode}");

        _audit.Add("MANUAL_MATCH", "SePayTransaction", tx.Id,
            newValue: order.OrderCode,
            description: $"Khớp thủ công {tx.TransactionCode} → {order.OrderCode} ({tx.Amount:N0}đ)");

        await _db.SaveChangesAsync();

        await EmitMatchedAsync(order, tx.TransactionCode, tx.Amount);
        return true;
    }

    public async Task<bool> UnassignTransactionAsync(Guid transactionId, string byUser)
    {
        var tx = await _db.SePayTransactions
            .Include(t => t.Order)
            .FirstOrDefaultAsync(t => t.Id == transactionId);
        if (tx == null || tx.MatchStatus == MatchStatus.Unmatched) return false;

        var order = tx.Order;
        var prevOrderCode = order?.OrderCode;
        tx.OrderId = null;
        tx.MatchStatus = MatchStatus.Unmatched;
        tx.MatchedBy = null;
        tx.MatchedAt = null;

        if (order != null)
        {
            var oldStatus = order.Status;

            // Tính lại AmountPaid từ các giao dịch còn match trên đơn (loại trừ tx vừa bỏ khớp)
            // — tránh phá hỏng dữ liệu khi đơn từng được match bởi nhiều CK.
            var remainingPaid = await _db.SePayTransactions
                .Where(t => t.OrderId == order.Id
                         && t.Id != tx.Id
                         && t.MatchStatus != MatchStatus.Unmatched)
                .SumAsync(t => (decimal?)t.Amount) ?? 0m;

            order.AmountPaid = Math.Min(remainingPaid, order.Amount);
            if (remainingPaid <= 0)
                order.Status = OrderStatus.WaitingTransfer;
            else if (remainingPaid >= order.Amount)
                order.Status = OrderStatus.PaidTransfer;
            else
                order.Status = OrderStatus.Partial;

            order.UpdatedAt = DateTime.UtcNow;

            _db.OrderHistories.Add(new OrderHistory
            {
                OrderId = order.Id,
                ChangedBy = byUser,
                FieldChanged = "Status",
                OldValue = oldStatus.ToString(),
                NewValue = order.Status.ToString(),
                Reason = $"Unmatch: {tx.TransactionCode}"
            });
        }

        _audit.Add("UNMATCH", "SePayTransaction", tx.Id,
            oldValue: prevOrderCode,
            description: $"Bỏ khớp {tx.TransactionCode} ({prevOrderCode ?? "—"})");

        await _db.SaveChangesAsync();
        return true;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static DateTime ParseTransactionDate(string? raw)
    {
        if (!string.IsNullOrEmpty(raw) && DateTime.TryParse(raw, out var parsed))
            return DateTime.SpecifyKind(parsed, DateTimeKind.Utc);
        return DateTime.UtcNow;
    }

    private async Task ApplyMatchToOrderAsync(Order order, decimal newPaymentAmount, string changedBy, string reason)
    {
        var oldStatus = order.Status;

        // Cộng dồn các CK đã match trước đó trên đơn (tx mới chưa add vào DB) để xử lý
        // đúng kịch bản 1 đơn được thanh toán qua nhiều lần chuyển khoản.
        var existingMatched = await _db.SePayTransactions
            .Where(t => t.OrderId == order.Id && t.MatchStatus != MatchStatus.Unmatched)
            .SumAsync(t => (decimal?)t.Amount) ?? 0m;

        var totalPaid = existingMatched + newPaymentAmount;

        if (totalPaid >= order.Amount)
        {
            order.Status = OrderStatus.PaidTransfer;
            order.AmountPaid = order.Amount;
        }
        else
        {
            order.Status = OrderStatus.Partial;
            order.AmountPaid = totalPaid;
        }
        order.UpdatedAt = DateTime.UtcNow;

        _db.OrderHistories.Add(new OrderHistory
        {
            OrderId = order.Id,
            ChangedBy = changedBy,
            FieldChanged = "Status",
            OldValue = oldStatus.ToString(),
            NewValue = order.Status.ToString(),
            Reason = reason
        });
    }

    private async Task EmitMatchedAsync(Order order, string transactionCode, decimal amount)
    {
        var payload = new { order.Id, order.OrderCode, transactionCode, amount };
        if (order.ShipperId.HasValue)
        {
            await _hub.Clients.Group($"shipper-{order.ShipperId}").SendAsync("SePayMatched", payload);
            await _notifications.CreateAsync(
                order.ShipperId.Value,
                title: "Đã nhận chuyển khoản",
                body: $"Đơn {order.OrderCode}: +{amount:N0}đ ({transactionCode})",
                link: $"/shipper/orders/{order.Id}",
                type: "SePayMatched");
        }
        await _hub.Clients.Group(AccountantsGroup).SendAsync("SePayMatched", payload);
    }
}

public class SePayStatsDto
{
    public int Unmatched { get; set; }
    public int AutoMatched { get; set; }
    public int ManualMatched { get; set; }
}

public class SePayTransactionDto
{
    public Guid Id { get; set; }
    public string TransactionCode { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string? Content { get; set; }
    public string? Gateway { get; set; }
    public DateTime TransactionDate { get; set; }
    public string MatchStatus { get; set; } = string.Empty;
    public string? MatchedBy { get; set; }
    public DateTime? MatchedAt { get; set; }
    public Guid? OrderId { get; set; }
    public string? OrderCode { get; set; }
}

public class WebhookLogDto
{
    public Guid Id { get; set; }
    public string? ResponseCode { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? RawBodyPreview { get; set; }
}
