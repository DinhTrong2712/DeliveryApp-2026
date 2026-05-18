using DeliveryApp.API.DTOs.Auth;
using DeliveryApp.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DeliveryApp.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AuthService _auth;
    private readonly AuditService _audit;

    public AuthController(AuthService auth, AuditService audit)
    {
        _auth = auth;
        _audit = audit;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        var result = await _auth.LoginAsync(req);
        if (result == null)
        {
            await _audit.LogAsync("LOGIN_FAILED", "User",
                description: $"Đăng nhập thất bại: {req.Username}",
                overrideUsername: req.Username);
            return Unauthorized(new { message = "Tên đăng nhập hoặc mật khẩu không đúng" });
        }

        await _audit.LogAsync("LOGIN", "User",
            entityId: result.User.Id,
            description: $"Đăng nhập thành công ({result.User.Role})",
            overrideUsername: req.Username,
            overrideUserId: result.User.Id);
        return Ok(result);
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        await _audit.LogAsync("LOGOUT", "User", description: "Đăng xuất");
        return Ok();
    }
}
