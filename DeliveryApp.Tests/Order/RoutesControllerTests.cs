using System.Security.Claims;
using DeliveryApp.API.Controllers;
using DeliveryApp.API.Data;
using DeliveryApp.API.Models;
using DeliveryApp.Tests.Helpers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace DeliveryApp.Tests.OrderFlow;

public class RoutesControllerTests
{
    private static RoutesController CreateController(AppDbContext db, string callerName = "ketoan")
    {
        var ctrl = new RoutesController(db, ServiceFactory.Audit(db));
        var identity = new ClaimsIdentity(new[] { new Claim(ClaimTypes.Name, callerName) }, "test");
        ctrl.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
        };
        return ctrl;
    }

    // ── UpdateShipper: regression — không reset trạng thái đơn đã thanh toán ──

    [Fact]
    public async Task UpdateShipper_SkipsPaidCashOrders_ButReassignsPending()
    {
        var db = TestDbHelper.CreateInMemoryDb();
        var oldShipperId = Guid.NewGuid();
        var newShipper = new User
        {
            Id = Guid.NewGuid(),
            Username = "newguy",
            PasswordHash = "x",
            FullName = "Mới",
            Role = UserRole.Shipper,
            IsActive = true
        };
        db.Users.Add(newShipper);

        // 1 đơn PaidCash + 1 đơn Pending — cùng RouteCode.
        var paid = TestDbHelper.CreateOrder("BH001", 100_000, OrderStatus.PaidCash, oldShipperId);
        paid.RouteCode = "R1";
        paid.AmountPaid = 100_000;

        var pending = TestDbHelper.CreateOrder("BH002", 200_000, OrderStatus.Pending, oldShipperId);
        pending.RouteCode = "R1";

        db.Orders.AddRange(paid, pending);
        await db.SaveChangesAsync();

        var ctrl = CreateController(db);
        var result = await ctrl.UpdateShipper("R1", new UpdateRouteRequest(newShipper.Id));
        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(ok.Value);

        var reloadedPaid = await db.Orders.FindAsync(paid.Id);
        var reloadedPending = await db.Orders.FindAsync(pending.Id);

        // Đơn đã PaidCash giữ nguyên shipper & status.
        Assert.Equal(oldShipperId, reloadedPaid!.ShipperId);
        Assert.Equal(OrderStatus.PaidCash, reloadedPaid.Status);
        Assert.Equal(100_000, reloadedPaid.AmountPaid);

        // Đơn Pending được gán cho shipper mới.
        Assert.Equal(newShipper.Id, reloadedPending!.ShipperId);
        Assert.Equal(OrderStatus.Pending, reloadedPending.Status);
    }

    [Fact]
    public async Task UpdateShipper_SkipsWaitingTransferToPreserveSepayMatch()
    {
        var db = TestDbHelper.CreateInMemoryDb();
        var shipper = new User
        {
            Id = Guid.NewGuid(), Username = "x", PasswordHash = "x", FullName = "X",
            Role = UserRole.Shipper, IsActive = true
        };
        db.Users.Add(shipper);

        var waiting = TestDbHelper.CreateOrder("BHW", 500_000, OrderStatus.WaitingTransfer, Guid.NewGuid());
        waiting.RouteCode = "R-W";
        db.Orders.Add(waiting);
        await db.SaveChangesAsync();

        var ctrl = CreateController(db);
        await ctrl.UpdateShipper("R-W", new UpdateRouteRequest(shipper.Id));

        var reloaded = await db.Orders.FindAsync(waiting.Id);
        Assert.Equal(OrderStatus.WaitingTransfer, reloaded!.Status); // không reset
    }

    [Fact]
    public async Task UpdateShipper_RouteNotFound_Returns404()
    {
        var db = TestDbHelper.CreateInMemoryDb();
        var ctrl = CreateController(db);
        var result = await ctrl.UpdateShipper("NOT_EXIST", new UpdateRouteRequest(null));
        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task UpdateShipper_InvalidShipper_Returns400()
    {
        var db = TestDbHelper.CreateInMemoryDb();
        db.Orders.Add(new() {
            OrderCode = "BH-X", CustomerName = "k", Amount = 100, RouteCode = "RX",
            Status = OrderStatus.Pending, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var ctrl = CreateController(db);
        var result = await ctrl.UpdateShipper("RX", new UpdateRouteRequest(Guid.NewGuid()));
        Assert.IsType<BadRequestObjectResult>(result);
    }

    // ── GetRoutes: timezone — regression cho fix vòng 2 ───────────────────────

    [Fact]
    public async Task GetRoutes_FromFilter_UsesVietnamLocalDate()
    {
        var db = TestDbHelper.CreateInMemoryDb();
        var inside = TestDbHelper.CreateOrder("BH-IN", 100, OrderStatus.Pending);
        inside.RouteCode = "R1";
        // 06h sáng 13/06 VN → 23h 12/06 UTC. Filter "from=13/06" trước fix sẽ loại đơn này.
        inside.CreatedAt = new DateTimeOffset(new DateTime(2026, 6, 13, 6, 0, 0), TimeSpan.FromHours(7)).UtcDateTime;
        db.Orders.Add(inside);
        await db.SaveChangesAsync();

        var ctrl = CreateController(db);
        var result = await ctrl.GetRoutes(from: new DateTime(2026, 6, 13), to: null, search: null);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(ok.Value);
        var json = System.Text.Json.JsonSerializer.Serialize(ok.Value);
        Assert.Contains("R1", json);
    }

    // ── DeleteRoute ───────────────────────────────────────────────────────────

    [Fact]
    public async Task DeleteRoute_RemovesAllOrdersInRoute()
    {
        var db = TestDbHelper.CreateInMemoryDb();
        var a = TestDbHelper.CreateOrder("A", 100, OrderStatus.Pending);
        a.RouteCode = "DEL";
        var b = TestDbHelper.CreateOrder("B", 200, OrderStatus.Pending);
        b.RouteCode = "DEL";
        var c = TestDbHelper.CreateOrder("C", 300, OrderStatus.Pending);
        c.RouteCode = "KEEP";
        db.Orders.AddRange(a, b, c);
        await db.SaveChangesAsync();

        var ctrl = CreateController(db);
        var result = await ctrl.DeleteRoute("DEL");
        Assert.IsType<OkObjectResult>(result);

        Assert.Equal(1, db.Orders.Count());
        Assert.NotNull(await db.Orders.FindAsync(c.Id));
    }
}
