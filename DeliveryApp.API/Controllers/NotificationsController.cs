using System.Security.Claims;
using DeliveryApp.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DeliveryApp.API.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly NotificationService _svc;
    public NotificationsController(NotificationService svc) => _svc = svc;

    private Guid CallerId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int take = 20)
    {
        var (items, unread) = await _svc.ListAsync(CallerId, Math.Clamp(take, 1, 100));
        return Ok(new
        {
            unread,
            items = items.Select(n => new
            {
                id = n.Id,
                title = n.Title,
                body = n.Body,
                link = n.Link,
                type = n.Type,
                readAt = n.ReadAt,
                createdAt = n.CreatedAt
            })
        });
    }

    [HttpPut("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id)
    {
        var ok = await _svc.MarkReadAsync(CallerId, id);
        return ok ? Ok(new { message = "Đã đánh dấu đọc" }) : NotFound();
    }

    [HttpPut("read-all")]
    public async Task<IActionResult> MarkAllRead()
    {
        await _svc.MarkAllReadAsync(CallerId);
        return Ok(new { message = "Đã đánh dấu tất cả" });
    }
}
