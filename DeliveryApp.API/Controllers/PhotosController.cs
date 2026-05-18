using System.Security.Claims;
using DeliveryApp.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DeliveryApp.API.Controllers;

[ApiController]
[Route("api/orders/{orderId:guid}/photos")]
[Authorize(Roles = "Shipper")]
public class PhotosController : ControllerBase
{
    private readonly PhotoService _photos;

    public PhotosController(PhotoService photos) => _photos = photos;

    private Guid CallerId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpPost]
    public async Task<IActionResult> Upload(Guid orderId, IFormFile file, [FromForm] string? caption)
    {
        var result = await _photos.UploadPhotoAsync(orderId, file, caption, CallerId);
        if (result == null) return BadRequest(new { message = "Không thể tải ảnh lên" });
        return Ok(result);
    }

    [HttpDelete("{photoId:guid}")]
    public async Task<IActionResult> Delete(Guid orderId, Guid photoId)
    {
        var ok = await _photos.DeletePhotoAsync(orderId, photoId, CallerId);
        return ok ? NoContent() : NotFound();
    }
}
