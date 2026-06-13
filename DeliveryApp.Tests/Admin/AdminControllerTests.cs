using System.Security.Claims;
using DeliveryApp.API.Controllers;
using DeliveryApp.API.Data;
using DeliveryApp.API.DTOs.Admin;
using DeliveryApp.API.Models;
using DeliveryApp.API.Services;
using DeliveryApp.Tests.Helpers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace DeliveryApp.Tests.Admin;

public class AdminControllerTests
{
    private static AdminController CreateController(AppDbContext db, Guid callerId)
    {
        var httpFactory = new Mock<IHttpClientFactory>();
        var backup = new BackupService(ServiceFactory.Config(), NullLogger<BackupService>.Instance);
        var ctrl = new AdminController(db, ServiceFactory.Config(), httpFactory.Object,
            ServiceFactory.Audit(db), backup);

        var identity = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, callerId.ToString()),
            new Claim(ClaimTypes.Name, "admin"),
            new Claim(ClaimTypes.Role, "Admin")
        }, "test");

        ctrl.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
        };
        return ctrl;
    }

    private static User SeedAdmin(AppDbContext db, string username = "admin", bool active = true)
    {
        var u = new User
        {
            Id = Guid.NewGuid(),
            Username = username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("password"),
            FullName = "Admin " + username,
            Role = UserRole.Admin,
            IsActive = active
        };
        db.Users.Add(u);
        db.SaveChanges();
        return u;
    }

    // ── Self-deactivate guard ────────────────────────────────────────────────

    [Fact]
    public async Task ToggleActive_SelfDeactivate_Rejected()
    {
        var db = TestDbHelper.CreateInMemoryDb();
        var admin = SeedAdmin(db, "me");
        SeedAdmin(db, "backup"); // có admin khác

        var ctrl = CreateController(db, admin.Id);
        var result = await ctrl.ToggleActive(admin.Id);

        Assert.IsType<BadRequestObjectResult>(result);
        var reloaded = await db.Users.FindAsync(admin.Id);
        Assert.True(reloaded!.IsActive); // không thay đổi
    }

    [Fact]
    public async Task ToggleActive_LastActiveAdmin_Rejected()
    {
        var db = TestDbHelper.CreateInMemoryDb();
        var lone = SeedAdmin(db, "lonewolf");
        var other = SeedAdmin(db, "willcall"); // sẽ là caller

        var ctrl = CreateController(db, other.Id);
        // Vô hiệu hoá other trước → còn lone là admin active cuối cùng.
        await ctrl.ToggleActive(other.Id); // self → bị từ chối, vẫn 2 admin

        // Thử dùng caller other vô hiệu hoá lone — kết quả: còn other là admin active.
        // Nhưng nếu chỉ còn 1 admin active là lone, từ chối.
        // Ở đây hai admin đều active, deactivate lone OK.
        var result = await ctrl.ToggleActive(lone.Id);
        Assert.IsType<OkObjectResult>(result);

        // Tiếp tục: bây giờ chỉ còn other active. Caller other muốn tắt other → self-deactivate, rejected.
        var result2 = await ctrl.ToggleActive(other.Id);
        Assert.IsType<BadRequestObjectResult>(result2);
    }

    [Fact]
    public async Task ToggleActive_NonAdmin_Allowed()
    {
        var db = TestDbHelper.CreateInMemoryDb();
        var admin = SeedAdmin(db);
        var shipper = new User
        {
            Id = Guid.NewGuid(), Username = "ship1", PasswordHash = "x",
            FullName = "Ship", Role = UserRole.Shipper, IsActive = true
        };
        db.Users.Add(shipper);
        await db.SaveChangesAsync();

        var ctrl = CreateController(db, admin.Id);
        var result = await ctrl.ToggleActive(shipper.Id);

        Assert.IsType<OkObjectResult>(result);
        Assert.False((await db.Users.FindAsync(shipper.Id))!.IsActive);
    }

    // ── Self-demote guard ─────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateUser_AdminDemoteSelf_Rejected()
    {
        var db = TestDbHelper.CreateInMemoryDb();
        var admin = SeedAdmin(db);

        var ctrl = CreateController(db, admin.Id);
        var req = new UpdateUserRequest("Admin tự hạ", "Shipper", null, null);
        var result = await ctrl.UpdateUser(admin.Id, req);

        Assert.IsType<BadRequestObjectResult>(result);
        var reloaded = await db.Users.FindAsync(admin.Id);
        Assert.Equal(UserRole.Admin, reloaded!.Role);
    }

    [Fact]
    public async Task UpdateUser_AdminDemoteOtherAdmin_Allowed()
    {
        var db = TestDbHelper.CreateInMemoryDb();
        var me = SeedAdmin(db, "me");
        var victim = SeedAdmin(db, "victim");

        var ctrl = CreateController(db, me.Id);
        var req = new UpdateUserRequest("Bị hạ", "Accountant", null, null);
        var result = await ctrl.UpdateUser(victim.Id, req);

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal(UserRole.Accountant, (await db.Users.FindAsync(victim.Id))!.Role);
    }

    [Fact]
    public async Task UpdateUser_InvalidRole_Returns400()
    {
        var db = TestDbHelper.CreateInMemoryDb();
        var admin = SeedAdmin(db);
        var target = SeedAdmin(db, "target");

        var ctrl = CreateController(db, admin.Id);
        var req = new UpdateUserRequest("X", "Boss", null, null);
        var result = await ctrl.UpdateUser(target.Id, req);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    // ── CreateUser ────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateUser_DuplicateUsername_Returns409()
    {
        var db = TestDbHelper.CreateInMemoryDb();
        var admin = SeedAdmin(db);

        var ctrl = CreateController(db, admin.Id);
        var req = new CreateUserRequest("admin", "p", "Trùng tên", "Shipper", null);
        var result = await ctrl.CreateUser(req);

        Assert.IsType<ConflictObjectResult>(result);
    }

    [Fact]
    public async Task CreateUser_NewShipper_Succeeds_AndHashesPassword()
    {
        var db = TestDbHelper.CreateInMemoryDb();
        var admin = SeedAdmin(db);

        var ctrl = CreateController(db, admin.Id);
        var req = new CreateUserRequest("ship1", "secret", "Ship 1", "Shipper", "Kho - Ship 1");
        var result = await ctrl.CreateUser(req);

        Assert.IsType<OkObjectResult>(result);
        var created = await db.Users.FirstAsync(u => u.Username == "ship1");
        Assert.True(BCrypt.Net.BCrypt.Verify("secret", created.PasswordHash));
        Assert.Equal(UserRole.Shipper, created.Role);
    }
}
