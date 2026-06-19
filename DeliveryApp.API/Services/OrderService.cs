using DeliveryApp.API.Data;
using DeliveryApp.API.DTOs.Orders;
using DeliveryApp.API.Hubs;
using DeliveryApp.API.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace DeliveryApp.API.Services;

public class OrderService
{
    private readonly AppDbContext _db;
    private readonly IHubContext<DeliveryHub> _hub;
    private readonly IConfiguration _config;
    private readonly AuditService _audit;
    private readonly NotificationService _notifications;

    public OrderService(AppDbContext db, IHubContext<DeliveryHub> hub, IConfiguration config, AuditService audit, NotificationService notifications)
    {
        _db = db;
        _hub = hub;
        _config = config;
        _audit = audit;
        _notifications = notifications;
    }

    public async Task<PagedResult<OrderListItem>> GetOrdersAsync(
        string? status, Guid? shipperId, DateTime? date, string? search,
        int page, int pageSize, UserRole callerRole, Guid callerId, string? sort = null)
    {
        var q = _db.Orders
            .Include(o => o.Shipper)
            .AsQueryable();

        if (callerRole == UserRole.Shipper)
            q = q.Where(o => o.ShipperId == callerId);
        else if (shipperId.HasValue)
            q = q.Where(o => o.ShipperId == shipperId);

        if (!string.IsNullOrEmpty(status) && Enum.TryParse<OrderStatus>(status, out var s))
            q = q.Where(o => o.Status == s);

        if (date.HasValue)
        {
            // Vietnam UTC+7 — user nhập "2026-06-13" hiểu là 1 ngày local, không phải ngày UTC.
            var start = new DateTimeOffset(date.Value.Date, TimeSpan.FromHours(7)).UtcDateTime;
            q = q.Where(o => o.CreatedAt >= start && o.CreatedAt < start.AddDays(1));
        }

        if (!string.IsNullOrEmpty(search))
            q = q.Where(o => o.OrderCode.Contains(search) || o.CustomerName.Contains(search));

        q = sort switch
        {
            "amount_asc" => q.OrderBy(o => o.Amount).ThenByDescending(o => o.CreatedAt),
            "amount_desc" => q.OrderByDescending(o => o.Amount).ThenByDescending(o => o.CreatedAt),
            _ => q.OrderByDescending(o => o.CreatedAt),
        };

        var total = await q.CountAsync();
        var items = await q
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(o => new OrderListItem(
                o.Id, o.OrderCode, o.RouteCode, o.CustomerName,
                o.Amount, o.AmountPaid, o.Amount - o.AmountPaid,
                o.Status.ToString(), o.ShipperId, o.ShipperNameXlsx ?? (o.Shipper != null ? o.Shipper.FullName : null),
                o.DeliveredAt, o.UpdatedAt))
            .ToListAsync();

        return new PagedResult<OrderListItem>(items, total, page, pageSize);
    }

    public async Task<OrderDetailDto?> GetOrderDetailAsync(Guid id, UserRole callerRole, Guid callerId)
    {
        var o = await _db.Orders
            .Include(o => o.Shipper)
            .Include(o => o.Photos)
            .Include(o => o.History)
            .Include(o => o.Transactions)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (o == null) return null;
        if (callerRole == UserRole.Shipper && o.ShipperId != callerId) return null;

        var isShipper = callerRole == UserRole.Shipper;
        var accountantNote = isShipper ? null : o.AccountantNote;

        return new OrderDetailDto(
            o.Id, o.OrderCode, o.RouteCode, o.CustomerName, o.Amount, o.AmountPaid,
            o.Amount - o.AmountPaid, o.Status.ToString(), o.UnpaidReason, o.ScheduledDate,
            o.DeliveredAt, o.ShipperNote, accountantNote,
            o.ShipperId, o.ShipperNameXlsx ?? o.Shipper?.FullName, o.LockedAt, o.CreatedAt, o.UpdatedAt,
            o.Photos.Select(p => new PhotoDto(p.Id, p.Url, p.Caption, p.CreatedAt)).ToList(),
            o.History.OrderByDescending(h => h.CreatedAt)
                .Select(h => new HistoryDto(h.Id, h.ChangedBy, h.FieldChanged, h.OldValue, h.NewValue, h.Reason, h.CreatedAt)).ToList(),
            o.OriginNote,
            isShipper
                ? new List<OrderTxnDto>()
                : o.Transactions.OrderBy(t => t.TransactionDate)
                    .Select(t => new OrderTxnDto(t.Id, t.TransactionCode, t.Amount, t.Gateway, t.ReferenceCode,
                        t.Content, t.TransactionDate, t.MatchStatus.ToString(), t.MatchedBy, t.MatchedAt)).ToList()
        );
    }

    public async Task<Order?> UpdateStatusAsync(Guid id, UpdateStatusRequest req, string changedBy, Guid callerId)
    {
        var order = await _db.Orders.FindAsync(id);
        if (order == null || order.ShipperId != callerId || await IsLockedAsync(order)) return null;

        if (!Enum.TryParse<OrderStatus>(req.Status, out var newStatus)) return null;

        var oldStatus = order.Status.ToString();

        switch (newStatus)
        {
            case OrderStatus.PaidCash:
                // Nếu shipper không truyền AmountPaid coi như thu đủ; số tiền âm/0 là vô nghĩa.
                var cashPaid = req.AmountPaid ?? order.Amount;
                if (cashPaid <= 0) return null;
                order.AmountPaid = Math.Min(cashPaid, order.Amount);
                break;

            case OrderStatus.PaidTransfer:
                order.AmountPaid = req.AmountPaid ?? order.Amount;
                break;

            case OrderStatus.Partial:
                // Partial bắt buộc phải có số tiền cụ thể (0 < paid < Amount), nếu không sẽ ghi đè 0 hoặc sai logic.
                if (!req.AmountPaid.HasValue || req.AmountPaid.Value <= 0 || req.AmountPaid.Value >= order.Amount)
                    return null;
                order.AmountPaid = req.AmountPaid.Value;
                break;

            case OrderStatus.Unpaid:
                order.AmountPaid = 0;
                order.UnpaidReason = req.UnpaidReason;
                if (req.ScheduledDate.HasValue)
                    order.ScheduledDate = DateTime.SpecifyKind(req.ScheduledDate.Value, DateTimeKind.Utc);
                break;

            case OrderStatus.Scheduled:
                order.AmountPaid = 0;
                order.ScheduledDate = req.ScheduledDate.HasValue
                    ? DateTime.SpecifyKind(req.ScheduledDate.Value, DateTimeKind.Utc)
                    : null;
                break;

            case OrderStatus.WaitingTransfer:
                // Giữ nguyên AmountPaid hiện có (có thể đã có 1 phần CK từ trước).
                break;

            default:
                // Pending / Unassigned: shipper không được tự đặt về các trạng thái này.
                return null;
        }

        order.Status = newStatus;
        if (req.Note != null) order.ShipperNote = req.Note;
        order.UpdatedAt = DateTime.UtcNow;

        _db.OrderHistories.Add(new OrderHistory
        {
            OrderId = order.Id,
            ChangedBy = changedBy,
            FieldChanged = "Status",
            OldValue = oldStatus,
            NewValue = newStatus.ToString()
        });

        var auditAction = newStatus == OrderStatus.PaidCash ? "COLLECT_CASH" : "UPDATE_STATUS";
        _audit.Add(auditAction, "Order", order.Id, oldStatus, newStatus.ToString(),
            $"{order.OrderCode}: {oldStatus} → {newStatus}");

        await _db.SaveChangesAsync();

        await _hub.Clients.Group($"shipper-{order.ShipperId}")
            .SendAsync("OrderStatusUpdated", new { order.Id, order.OrderCode, newStatus = newStatus.ToString(), order.AmountPaid, updatedBy = changedBy });
        await _hub.Clients.Group("accountants")
            .SendAsync("OrderStatusUpdated", new { order.Id, order.OrderCode, newStatus = newStatus.ToString(), order.AmountPaid, updatedBy = changedBy });

        return order;
    }

    public async Task<Order?> SetDeliveredAsync(Guid id, Guid callerId)
    {
        var order = await _db.Orders.FindAsync(id);
        if (order == null || order.ShipperId != callerId || await IsLockedAsync(order)) return null;
        if (order.DeliveredAt.HasValue) return order;

        order.DeliveredAt = DateTime.UtcNow;
        order.UpdatedAt = DateTime.UtcNow;

        _audit.Add("DELIVERED", "Order", order.Id, description: $"{order.OrderCode}: đánh dấu đã giao");

        await _db.SaveChangesAsync();
        return order;
    }

    public async Task<Order?> UpdateShipperNoteAsync(Guid id, string note, Guid callerId)
    {
        var order = await _db.Orders.FindAsync(id);
        if (order == null || order.ShipperId != callerId || await IsLockedAsync(order)) return null;

        var oldNote = order.ShipperNote;
        note ??= string.Empty;
        order.ShipperNote = note[..Math.Min(note.Length, 1000)];
        order.UpdatedAt = DateTime.UtcNow;

        _audit.Add("UPDATE_ORDER", "Order", order.Id, oldNote, order.ShipperNote,
            $"{order.OrderCode}: cập nhật ghi chú shipper");

        await _db.SaveChangesAsync();
        return order;
    }

    public async Task<Order?> UpdateAccountantNoteAsync(Guid id, string note)
    {
        var order = await _db.Orders.FindAsync(id);
        if (order == null) return null;

        var oldNote = order.AccountantNote;
        order.AccountantNote = note;
        order.UpdatedAt = DateTime.UtcNow;

        _audit.Add("UPDATE_ORDER", "Order", order.Id, oldNote, note,
            $"{order.OrderCode}: cập nhật ghi chú kế toán");

        await _db.SaveChangesAsync();
        return order;
    }

    public async Task<Order?> OverrideAsync(Guid id, OverrideRequest req, string changedBy)
    {
        var order = await _db.Orders.FindAsync(id);
        if (order == null) return null;

        var oldValue = req.Field switch
        {
            "Status" => order.Status.ToString(),
            "AmountPaid" => order.AmountPaid.ToString(),
            "ShipperNote" => order.ShipperNote,
            _ => null
        };

        // Validate trước khi gán — tránh tình huống parse fail vẫn ghi audit + lịch sử như đã thành công.
        switch (req.Field)
        {
            case "Status":
                if (!Enum.TryParse<OrderStatus>(req.Value, out var s)) return null;
                order.Status = s;
                break;
            case "AmountPaid":
                if (!decimal.TryParse(req.Value, out var a) || a < 0) return null;
                order.AmountPaid = Math.Min(a, order.Amount);
                break;
            case "ShipperNote":
                order.ShipperNote = req.Value;
                break;
            default:
                return null;
        }

        order.UpdatedAt = DateTime.UtcNow;

        _db.OrderHistories.Add(new OrderHistory
        {
            OrderId = order.Id,
            ChangedBy = changedBy,
            FieldChanged = req.Field,
            OldValue = oldValue,
            NewValue = req.Value,
            Reason = req.Reason
        });

        _audit.Add("OVERRIDE_FIELD", "Order", order.Id, oldValue, req.Value,
            $"{order.OrderCode}: ghi đè {req.Field} — {req.Reason}");

        await _db.SaveChangesAsync();

        if (order.ShipperId.HasValue)
        {
            try
            {
                await _notifications.CreateAsync(
                    order.ShipperId.Value,
                    title: $"Kế toán điều chỉnh đơn {order.OrderCode}",
                    body: $"{req.Field}: {oldValue ?? "—"} → {req.Value} ({req.Reason})",
                    link: $"/shipper/orders/{order.Id}",
                    type: "OrderOverride");
            }
            catch
            {
                // Notification failure shouldn't fail the override operation
            }
        }

        return order;
    }

    private async Task<bool> IsLockedAsync(Order order)
    {
        // Đơn đã đánh dấu khoá tay (admin set LockedAt = thời điểm khoá) thì chốt khoá.
        if (order.LockedAt.HasValue && order.LockedAt.Value <= DateTime.UtcNow) return true;

        // Ưu tiên đọc lock_time từ SystemConfigs (admin chỉnh nóng trong UI); fallback appsettings.
        var dbCfg = await _db.SystemConfigs
            .Where(c => c.Key == "lock_time")
            .Select(c => c.Value)
            .FirstOrDefaultAsync();
        var lockTime = !string.IsNullOrWhiteSpace(dbCfg) ? dbCfg : (_config["App:LockTime"] ?? "23:59");

        var parts = lockTime.Split(':');
        if (parts.Length != 2) return false;
        if (!int.TryParse(parts[0], out var lockHour)) return false;
        if (!int.TryParse(parts[1], out var lockMin)) return false;
        // Vietnam time zone (UTC+7) - lock_time config is in Vietnam time
        var nowVietnam = DateTime.UtcNow.AddHours(7);
        return nowVietnam.Hour > lockHour || (nowVietnam.Hour == lockHour && nowVietnam.Minute >= lockMin);
    }
}
