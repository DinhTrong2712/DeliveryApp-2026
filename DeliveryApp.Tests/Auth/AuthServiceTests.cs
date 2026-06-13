using System.IdentityModel.Tokens.Jwt;
using DeliveryApp.API.DTOs.Auth;
using DeliveryApp.API.Models;
using DeliveryApp.API.Services;
using DeliveryApp.Tests.Helpers;
using Microsoft.Extensions.Configuration;

namespace DeliveryApp.Tests.Auth;

public class AuthServiceTests
{
    private const string JwtSecret = "test-secret-must-be-at-least-32-chars-long-for-hmacsha256";

    private static AuthService CreateService(out DeliveryApp.API.Data.AppDbContext db)
    {
        db = TestDbHelper.CreateInMemoryDb();
        var config = ServiceFactory.Config(new Dictionary<string, string?>
        {
            ["Jwt:Secret"] = JwtSecret,
            ["Jwt:Issuer"] = "DeliveryApp",
            ["Jwt:Audience"] = "DeliveryApp"
        });
        return new AuthService(db, config);
    }

    private static User AddUser(DeliveryApp.API.Data.AppDbContext db,
        string username, string password, UserRole role = UserRole.Shipper, bool isActive = true)
    {
        var u = new User
        {
            Id = Guid.NewGuid(),
            Username = username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            FullName = username,
            Role = role,
            IsActive = isActive
        };
        db.Users.Add(u);
        db.SaveChanges();
        return u;
    }

    [Fact]
    public async Task Login_CorrectCredentials_ReturnsTokenAndUser()
    {
        var svc = CreateService(out var db);
        var u = AddUser(db, "manh", "ketoan123");

        var result = await svc.LoginAsync(new LoginRequest("manh", "ketoan123"));

        Assert.NotNull(result);
        Assert.False(string.IsNullOrEmpty(result!.Token));
        Assert.Equal(u.Id, result.User.Id);
        Assert.True(result.ExpiresAt > DateTime.UtcNow);
    }

    [Fact]
    public async Task Login_WrongPassword_ReturnsNull()
    {
        var svc = CreateService(out var db);
        AddUser(db, "manh", "ketoan123");
        Assert.Null(await svc.LoginAsync(new LoginRequest("manh", "wrong")));
    }

    [Fact]
    public async Task Login_UnknownUser_ReturnsNull()
    {
        var svc = CreateService(out _);
        Assert.Null(await svc.LoginAsync(new LoginRequest("ghost", "anything")));
    }

    [Fact]
    public async Task Login_DisabledUser_ReturnsNull()
    {
        var svc = CreateService(out var db);
        AddUser(db, "disabled", "p", isActive: false);
        Assert.Null(await svc.LoginAsync(new LoginRequest("disabled", "p")));
    }

    [Fact]
    public async Task Login_TokenContainsRoleAndUserClaims()
    {
        var svc = CreateService(out var db);
        var u = AddUser(db, "kt", "p", role: UserRole.Accountant);

        var result = await svc.LoginAsync(new LoginRequest("kt", "p"));
        Assert.NotNull(result);

        var token = new JwtSecurityTokenHandler().ReadJwtToken(result!.Token);
        Assert.Contains(token.Claims, c =>
            c.Type == System.Security.Claims.ClaimTypes.Role && c.Value == "Accountant");
        Assert.Contains(token.Claims, c =>
            c.Type == System.Security.Claims.ClaimTypes.NameIdentifier && c.Value == u.Id.ToString());
    }
}
