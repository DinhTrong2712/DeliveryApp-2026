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
    /// 1. HMAC SHA256 signature (mặc định, SePay gửi qua "X-Sepay-Signature: sha256=...")
    /// 2. Static API key (legacy, SePay gửi qua "Authorization: Apikey ..." hoặc "x-api-key: ...")
    /// </summary>
    public async Task<bool> VerifyWebhookAsync(string? apiKey, string? signature, string rawBody)
    {
        var cfg = await _db.SystemConfigs.FirstOrDefaultAsync(c => c.Key == "sepay_apikey");
        var storedSecret = cfg?.Value ?? _config["SePay:ApiKey"] ?? "";

        if (string.IsNullOrEmpty(storedSecret)) return false;

        if (!string.IsNullOrEmpty(apiKey) && storedSecret == apiKey) return true;

        if (!string.IsNullOrEmpty(signature) && !string.IsNullOrEmpty(rawBody))
        {
            var expected = signature.StartsWith("sha256=", StringComparison.OrdinalIgnoreCase)
                ? signature[7..].Trim()
                : signature.Trim();

            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(storedSecret));
            var computed = Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(rawBody))).ToLowerInvariant();

            if (string.Equals(computed, expected, StringComparison.OrdinalIgnoreCase)) return true;
        }

        return false;
    }

    [Obsolete("Use VerifyWebhookAsync instead", false)]
    public Task<bool> VerifyApiKeyAsync(string apiKey) => VerifyWebhookAsync(apiKey, null, "");

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
        var waitingOrders = await _db.Orders
            .Where(o => o.Status == OrderStatus.WaitingTransfer)
            .Select(o => new { o.Id, o.OrderCode })
            .ToListAsync();

        var matchedId = waitingOrders
            .FirstOrDefault(o => contentToSearch.Contains(o.OrderCode.ToUpperInvariant()))?.Id;

        var order = matchedId.HasValue ? await _db.Orders.FindAsync(matchedId.Value) : null;

        if (order != null)
        {
            tx.OrderId = order.Id;
            tx.MatchStatus = MatchStatus.AutoMatched;
            tx.MatchedAt = DateTime.UtcNow;
            tx.MatchedBy = WebhookActor;

            ApplyMatchToOrder(order, payload.TransferAmount, WebhookActor, $"SePay auto-match: {transactionCode}");
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

        tx.OrderId = orderId;
        tx.MatchStatus = MatchStatus.ManualMatched;
        tx.MatchedBy = assignedBy;
        tx.MatchedAt = DateTime.UtcNow;

        ApplyMatchToOrder(order, tx.Amount, assignedBy, $"Manual match: {tx.TransactionCode}");

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
            order.Status = OrderStatus.WaitingTransfer;
            order.AmountPaid = 0;
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

    private void ApplyMatchToOrder(Order order, decimal paidAmount, string changedBy, string reason)
    {
        var oldStatus = order.Status;
        if (paidAmount >= order.Amount)
        {
            order.Status = OrderStatus.PaidTransfer;
            order.AmountPaid = order.Amount;
        }
        else
        {
            order.Status = OrderStatus.Partial;
            order.AmountPaid = paidAmount;
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
