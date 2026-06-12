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
            var start = DateTime.SpecifyKind(date.Value.Date, DateTimeKind.Utc);
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
            .FirstOrDefaultAsync(o => o.Id == id);

        if (o == null) return null;
        if (callerRole == UserRole.Shipper && o.ShipperId != callerId) return null;

        var accountantNote = callerRole == UserRole.Shipper ? null : o.AccountantNote;

        return new OrderDetailDto(
            o.Id, o.OrderCode, o.RouteCode, o.CustomerName, o.Amount, o.AmountPaid,
            o.Amount - o.AmountPaid, o.Status.ToString(), o.UnpaidReason, o.ScheduledDate,
            o.DeliveredAt, o.ShipperNote, accountantNote,
            o.ShipperId, o.ShipperNameXlsx ?? o.Shipper?.FullName, o.LockedAt, o.CreatedAt, o.UpdatedAt,
            o.Photos.Select(p => new PhotoDto(p.Id, p.Url, p.Caption, p.CreatedAt)).ToList(),
            o.History.OrderByDescending(h => h.CreatedAt)
                .Select(h => new HistoryDto(h.Id, h.ChangedBy, h.FieldChanged, h.OldValue, h.NewValue, h.Reason, h.CreatedAt)).ToList()
        );
    }

    public async Task<Order?> UpdateStatusAsync(Guid id, UpdateStatusRequest req, string changedBy, Guid callerId)
    {
        var order = await _db.Orders.FindAsync(id);
        if (order == null || order.ShipperId != callerId || IsLocked(order)) return null;

        if (!Enum.TryParse<OrderStatus>(req.Status, out var newStatus)) return null;

        var oldStatus = order.Status.ToString();
        order.Status = newStatus;

        if (newStatus == OrderStatus.PaidCash && req.AmountPaid.HasValue)
            order.AmountPaid = req.AmountPaid.Value;
        else if (newStatus == OrderStatus.PaidTransfer)
            order.AmountPaid = req.AmountPaid ?? order.Amount;
        else if (newStatus == OrderStatus.Partial && req.AmountPaid.HasValue)
            order.AmountPaid = req.AmountPaid.Value;
        else if (newStatus == OrderStatus.Unpaid)
        {
            order.UnpaidReason = req.UnpaidReason;
            if (req.ScheduledDate.HasValue)
                order.ScheduledDate = DateTime.SpecifyKind(req.ScheduledDate.Value, DateTimeKind.Utc);
        }
        else if (newStatus == OrderStatus.Scheduled)
            order.ScheduledDate = req.ScheduledDate.HasValue
                ? DateTime.SpecifyKind(req.ScheduledDate.Value, DateTimeKind.Utc)
                : null;

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
        if (order == null || order.ShipperId != callerId || IsLocked(order)) return null;
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
        if (order == null || order.ShipperId != callerId || IsLocked(order)) return null;

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

        switch (req.Field)
        {
            case "Status":
                if (Enum.TryParse<OrderStatus>(req.Value, out var s)) order.Status = s;
                break;
            case "AmountPaid":
                if (decimal.TryParse(req.Value, out var a)) order.AmountPaid = a;
                break;
            case "ShipperNote":
                order.ShipperNote = req.Value;
                break;
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
            await _notifications.CreateAsync(
                order.ShipperId.Value,
                title: $"Kế toán điều chỉnh đơn {order.OrderCode}",
                body: $"{req.Field}: {oldValue ?? "—"} → {req.Value} ({req.Reason})",
                link: $"/shipper/orders/{order.Id}",
                type: "OrderOverride");
        }

        return order;
    }

    private bool IsLocked(Order order)
    {
        var lockTime = _config["App:LockTime"] ?? "23:59";
        var parts = lockTime.Split(':');
        if (parts.Length != 2) return false;
        if (!int.TryParse(parts[0], out var lockHour)) return false;
        if (!int.TryParse(parts[1], out var lockMin)) return false;
        var now = DateTime.Now;
        return now.Hour > lockHour || (now.Hour == lockHour && now.Minute >= lockMin);
    }
}
