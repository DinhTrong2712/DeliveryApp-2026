using System.Security.Claims;
using DeliveryApp.API.Data;
using DeliveryApp.API.DTOs.Orders;
using DeliveryApp.API.Models;
using DeliveryApp.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DeliveryApp.API.Controllers;

[ApiController]
[Route("api/orders")]
[Authorize]
public class OrdersController : ControllerBase
{
    private readonly OrderService _orders;
    private readonly AppDbContext _db;

    public OrdersController(OrderService orders, AppDbContext db)
    {
        _orders = orders;
        _db = db;
    }

    private Guid CallerId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private UserRole CallerRole => Enum.Parse<UserRole>(User.FindFirstValue(ClaimTypes.Role)!);
    private string CallerName => User.FindFirstValue(ClaimTypes.Name) ?? "";

    [HttpGet]
    public async Task<IActionResult> GetOrders(
        [FromQuery] string? status, [FromQuery] Guid? shipperId,
        [FromQuery] DateTime? date, [FromQuery] string? search,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        [FromQuery] string? sort = null)
    {
        var result = await _orders.GetOrdersAsync(status, shipperId, date, search, page, pageSize, CallerRole, CallerId, sort);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetOrder(Guid id)
    {
        var result = await _orders.GetOrderDetailAsync(id, CallerRole, CallerId);
        if (result == null) return NotFound();
        return Ok(result);
    }

    [HttpPatch("{id:guid}/status")]
    [Authorize(Roles = "Shipper")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateStatusRequest req)
    {
        var result = await _orders.UpdateStatusAsync(id, req, CallerName, CallerId);
        if (result == null) return BadRequest(new { message = "Không thể cập nhật trạng thái" });
        return Ok(new
        {
            id = result.Id,
            orderCode = result.OrderCode,
            status = result.Status.ToString(),
            amountPaid = result.AmountPaid,
            amountRemaining = result.Amount - result.AmountPaid,
            unpaidReason = result.UnpaidReason,
            scheduledDate = result.ScheduledDate,
            deliveredAt = result.DeliveredAt
        });
    }

    [HttpPatch("{id:guid}/delivered")]
    [Authorize(Roles = "Shipper")]
    public async Task<IActionResult> SetDelivered(Guid id)
    {
        var result = await _orders.SetDeliveredAsync(id, CallerId);
        if (result == null) return BadRequest();
        return Ok(new
        {
            id = result.Id,
            orderCode = result.OrderCode,
            deliveredAt = result.DeliveredAt
        });
    }

    [HttpPatch("{id:guid}/note")]
    [Authorize(Roles = "Shipper")]
    public async Task<IActionResult> UpdateNote(Guid id, [FromBody] UpdateNoteRequest req)
    {
        var result = await _orders.UpdateShipperNoteAsync(id, req.Note, CallerId);
        if (result == null) return BadRequest();
        return Ok(result);
    }

    [HttpPatch("{id:guid}/accountant-note")]
    [Authorize(Roles = "Accountant,Admin")]
    public async Task<IActionResult> UpdateAccountantNote(Guid id, [FromBody] AccountantNoteRequest req)
    {
        var result = await _orders.UpdateAccountantNoteAsync(id, req.Note);
        if (result == null) return NotFound();
        return Ok(result);
    }

    [HttpPatch("{id:guid}/override")]
    [Authorize(Roles = "Accountant,Admin")]
    public async Task<IActionResult> Override(Guid id, [FromBody] OverrideRequest req)
    {
        if (string.IsNullOrEmpty(req.Reason)) return BadRequest(new { message = "Lý do là bắt buộc" });
        var result = await _orders.OverrideAsync(id, req, CallerName);
        if (result == null) return NotFound();
        return Ok(new { id = result.Id, orderCode = result.OrderCode, status = result.Status.ToString(), amountPaid = result.AmountPaid });
    }

    [HttpGet("{id:guid}/history")]
    [Authorize(Roles = "Accountant,Admin")]
    public async Task<IActionResult> GetHistory(Guid id)
    {
        var detail = await _orders.GetOrderDetailAsync(id, CallerRole, CallerId);
        if (detail == null) return NotFound();
        return Ok(detail.History);
    }

    [HttpGet("{id:guid}/qr")]
    public async Task<IActionResult> GetQr(
        Guid id,
        [FromQuery] int account = 1,
        [FromQuery] decimal? amount = null,
        [FromQuery] string? addInfo = null)
    {
        var order = await _db.Orders.FindAsync(id);
        if (order == null) return NotFound();
        if (CallerRole == UserRole.Shipper && order.ShipperId != CallerId) return Forbid();

        var suffix = account == 2 ? "_2" : "_1";
        var configs = await _db.SystemConfigs.ToListAsync();
        var get = (string key) => configs.FirstOrDefault(c => c.Key == key)?.Value ?? "";

        var bank = get($"vietqr_bank{suffix}");
        var accountNo = get($"vietqr_account_number{suffix}");
        var accountName = get($"vietqr_account_name{suffix}");
        var template = get($"vietqr_template{suffix}");
        if (string.IsNullOrWhiteSpace(template)) template = "compact2";

        if (string.IsNullOrEmpty(bank) || string.IsNullOrEmpty(accountNo))
            return NotFound(new { message = "Chưa cấu hình tài khoản ngân hàng" });

        var qrAmount = amount.HasValue && amount.Value > 0 ? amount.Value : order.Amount - order.AmountPaid;
        var infoRaw = string.IsNullOrWhiteSpace(addInfo) ? order.OrderCode : addInfo!.Trim();
        if (infoRaw.Length > 50) infoRaw = infoRaw[..50];
        var info = Uri.EscapeDataString(infoRaw);
        var nameEnc = Uri.EscapeDataString(accountName);
        var url = $"https://img.vietqr.io/image/{bank}-{accountNo}-{template}.png?amount={qrAmount}&addInfo={info}&accountName={nameEnc}";

        return Ok(new { qrUrl = url, bank, accountNo, accountName, amount = qrAmount, orderCode = order.OrderCode, addInfo = infoRaw });
    }
}
