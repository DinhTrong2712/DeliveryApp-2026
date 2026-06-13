using System.Security.Claims;
using DeliveryApp.API.Data;
using DeliveryApp.API.Models;
using DeliveryApp.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DeliveryApp.API.Controllers;

[ApiController]
[Route("api/routes")]
[Authorize(Roles = "Accountant,Admin")]
public class RoutesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly AuditService _audit;

    public RoutesController(AppDbContext db, AuditService audit)
    {
        _db = db;
        _audit = audit;
    }

    private string CallerName => User.FindFirstValue(ClaimTypes.Name) ?? "";

    /// <summary>
    /// Lấy danh sách đơn gộp (group by RouteCode).
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetRoutes(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] string? search)
    {
        var q = _db.Orders
            .Include(o => o.Shipper)
            .Where(o => o.RouteCode != null);

        if (from.HasValue)
        {
            var fromUtc = new DateTimeOffset(from.Value.Date, TimeSpan.FromHours(7)).UtcDateTime;
            q = q.Where(o => o.CreatedAt >= fromUtc);
        }

        if (to.HasValue)
        {
            var toUtc = new DateTimeOffset(to.Value.Date, TimeSpan.FromHours(7)).UtcDateTime.AddDays(1);
            q = q.Where(o => o.CreatedAt < toUtc);
        }

        if (!string.IsNullOrWhiteSpace(search))
            q = q.Where(o => o.RouteCode!.Contains(search));

        var groups = await q
            .GroupBy(o => new { o.RouteCode, o.ShipperId })
            .Select(g => new RouteSummaryDto
            {
                RouteCode      = g.Key.RouteCode!,
                OrderDate      = g.Max(o => o.CreatedAt),
                ShipperId      = g.Key.ShipperId,
                ShipperName    = g.First().ShipperNameXlsx ?? (g.First().Shipper != null ? g.First().Shipper!.FullName : null),
                CustomerCount  = g.Count(),
                TotalAmount    = g.Sum(o => o.Amount),
                TotalPaid      = g.Sum(o => o.AmountPaid),
            })
            .OrderByDescending(r => r.OrderDate)
            .ToListAsync();

        // Nếu một RouteCode có nhiều NV (hiếm), gộp lại thành 1 dòng
        var merged = groups
            .GroupBy(r => r.RouteCode)
            .Select(g => g.Count() == 1 ? g.First() : new RouteSummaryDto
            {
                RouteCode     = g.Key,
                OrderDate     = g.Max(r => r.OrderDate),
                ShipperId     = g.First().ShipperId,
                ShipperName   = string.Join(", ", g.Where(r => r.ShipperName != null).Select(r => r.ShipperName).Distinct()),
                CustomerCount = g.Sum(r => r.CustomerCount),
                TotalAmount   = g.Sum(r => r.TotalAmount),
                TotalPaid     = g.Sum(r => r.TotalPaid),
            })
            .OrderByDescending(r => r.OrderDate)
            .ToList();

        return Ok(new { total = merged.Count, items = merged });
    }

    /// <summary>
    /// Lấy chi tiết một đơn gộp gồm danh sách đơn hàng.
    /// </summary>
    [HttpGet("{routeCode}")]
    public async Task<IActionResult> GetRouteDetail(string routeCode)
    {
        var orders = await _db.Orders
            .Include(o => o.Shipper)
            .Where(o => o.RouteCode == routeCode)
            .OrderBy(o => o.OrderCode)
            .Select(o => new RouteOrderDto
            {
                Id            = o.Id,
                OrderCode     = o.OrderCode,
                CustomerName  = o.CustomerName,
                Amount        = o.Amount,
                AmountPaid    = o.AmountPaid,
                Status        = o.Status.ToString(),
                ShipperName   = o.ShipperNameXlsx ?? (o.Shipper != null ? o.Shipper.FullName : null),
                UnpaidReason  = o.UnpaidReason,
                ScheduledDate = o.ScheduledDate,
                DeliveredAt   = o.DeliveredAt,
                ShipperNote   = o.ShipperNote,
                CreatedAt     = o.CreatedAt,
            })
            .ToListAsync();

        if (orders.Count == 0)
            return NotFound(new { message = "Không tìm thấy đơn gộp" });

        return Ok(new
        {
            routeCode,
            customerCount = orders.Count,
            totalAmount   = orders.Sum(o => o.Amount),
            totalPaid     = orders.Sum(o => o.AmountPaid),
            items         = orders,
        });
    }

    /// <summary>
    /// Đổi nhân viên cho toàn bộ đơn trong một đơn gộp.
    /// </summary>
    [HttpPut("{routeCode}")]
    public async Task<IActionResult> UpdateShipper(string routeCode, [FromBody] UpdateRouteRequest req)
    {
        var orders = await _db.Orders
            .Where(o => o.RouteCode == routeCode)
            .ToListAsync();

        if (orders.Count == 0)
            return NotFound(new { message = "Không tìm thấy đơn gộp" });

        User? shipper = null;
        if (req.ShipperId.HasValue)
        {
            shipper = await _db.Users.FirstOrDefaultAsync(u =>
                u.Id == req.ShipperId.Value && u.Role == UserRole.Shipper);
            if (shipper == null)
                return BadRequest(new { message = "Nhân viên không tồn tại" });
        }

        var oldShipperName = orders.First().ShipperId?.ToString();
        var updated = 0;
        foreach (var o in orders)
        {
            // Chỉ đổi shipper + reset trạng thái cho đơn chưa thanh toán / chưa giao —
            // tránh xóa dữ liệu thu tiền của các đơn đã PaidCash / PaidTransfer / Partial trong cùng route.
            if (o.Status is OrderStatus.PaidCash or OrderStatus.PaidTransfer or OrderStatus.Partial
                or OrderStatus.WaitingTransfer)
                continue;

            o.ShipperId = shipper?.Id;
            o.Status = shipper != null ? OrderStatus.Pending : OrderStatus.Unassigned;
            o.UpdatedAt = DateTime.UtcNow;
            updated++;
        }

        _audit.Add("UPDATE_ROUTE", "Route",
            oldValue: oldShipperName,
            newValue: shipper?.FullName ?? "(không phân công)",
            description: $"{routeCode}: đổi NV cho {updated}/{orders.Count} đơn (bỏ qua đơn đã thanh toán/đang CK)");

        await _db.SaveChangesAsync();
        return Ok(new { updated, skipped = orders.Count - updated, total = orders.Count });
    }

    /// <summary>
    /// Xoá toàn bộ đơn hàng trong một đơn gộp.
    /// </summary>
    [HttpDelete("{routeCode}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteRoute(string routeCode)
    {
        var orders = await _db.Orders
            .Where(o => o.RouteCode == routeCode)
            .ToListAsync();

        if (orders.Count == 0)
            return NotFound(new { message = "Không tìm thấy đơn gộp" });

        _db.Orders.RemoveRange(orders);
        _audit.Add("DELETE_ROUTE", "Route",
            description: $"{routeCode}: xoá {orders.Count} đơn");
        await _db.SaveChangesAsync();

        return Ok(new { deleted = orders.Count });
    }
}

public class RouteSummaryDto
{
    public string RouteCode { get; set; } = string.Empty;
    public DateTime OrderDate { get; set; }
    public Guid? ShipperId { get; set; }
    public string? ShipperName { get; set; }
    public int CustomerCount { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal TotalPaid { get; set; }
}

public record UpdateRouteRequest(Guid? ShipperId);

public class RouteOrderDto
{
    public Guid Id { get; set; }
    public string OrderCode { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public decimal AmountPaid { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? ShipperName { get; set; }
    public string? UnpaidReason { get; set; }
    public DateTime? ScheduledDate { get; set; }
    public DateTime? DeliveredAt { get; set; }
    public string? ShipperNote { get; set; }
    public DateTime CreatedAt { get; set; }
}
