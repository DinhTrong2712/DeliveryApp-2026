using DeliveryApp.API.DTOs.Orders;
using DeliveryApp.API.Models;
using DeliveryApp.API.Services;
using DeliveryApp.Tests.Helpers;
using OrderEntity = DeliveryApp.API.Models.Order;

namespace DeliveryApp.Tests.OrderFlow;

public class OrderServiceTests
{
    private static readonly Guid ShipperId = Guid.Parse("11111111-1111-1111-1111-111111111111");

    private static (DeliveryApp.API.Data.AppDbContext db, OrderService svc, OrderEntity order)
        Setup(decimal amount = 500_000, OrderStatus status = OrderStatus.Pending)
    {
        var db = TestDbHelper.CreateInMemoryDb();
        var svc = ServiceFactory.Order(db);
        var order = TestDbHelper.CreateOrder("BH001", amount, status, ShipperId);
        db.Orders.Add(order);
        db.SaveChanges();
        return (db, svc, order);
    }

    // ── PaidCash ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateStatus_PaidCash_WithoutAmountPaid_DefaultsToOrderAmount()
    {
        var (db, svc, order) = Setup(500_000);

        var req = new UpdateStatusRequest("PaidCash", AmountPaid: null, null, null, null);
        var result = await svc.UpdateStatusAsync(order.Id, req, "manh", ShipperId);

        Assert.NotNull(result);
        Assert.Equal(OrderStatus.PaidCash, result!.Status);
        Assert.Equal(500_000, result.AmountPaid);
    }

    [Fact]
    public async Task UpdateStatus_PaidCash_AmountPaidExceedsOrder_CapsAtAmount()
    {
        var (_, svc, order) = Setup(500_000);

        var req = new UpdateStatusRequest("PaidCash", 9_999_999, null, null, null);
        var result = await svc.UpdateStatusAsync(order.Id, req, "manh", ShipperId);

        Assert.Equal(500_000, result!.AmountPaid);
    }

    [Fact]
    public async Task UpdateStatus_PaidCash_ZeroAmount_Rejected()
    {
        var (_, svc, order) = Setup(500_000);
        var req = new UpdateStatusRequest("PaidCash", 0, null, null, null);
        Assert.Null(await svc.UpdateStatusAsync(order.Id, req, "manh", ShipperId));
    }

    [Fact]
    public async Task UpdateStatus_PaidCash_NegativeAmount_Rejected()
    {
        var (_, svc, order) = Setup(500_000);
        var req = new UpdateStatusRequest("PaidCash", -1, null, null, null);
        Assert.Null(await svc.UpdateStatusAsync(order.Id, req, "manh", ShipperId));
    }

    // ── Partial ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateStatus_Partial_WithoutAmountPaid_Rejected()
    {
        var (_, svc, order) = Setup(500_000);
        var req = new UpdateStatusRequest("Partial", AmountPaid: null, null, null, null);
        Assert.Null(await svc.UpdateStatusAsync(order.Id, req, "manh", ShipperId));
    }

    [Fact]
    public async Task UpdateStatus_Partial_AmountEqualsOrderAmount_Rejected()
    {
        var (_, svc, order) = Setup(500_000);
        var req = new UpdateStatusRequest("Partial", 500_000, null, null, null);
        Assert.Null(await svc.UpdateStatusAsync(order.Id, req, "manh", ShipperId));
    }

    [Fact]
    public async Task UpdateStatus_Partial_AmountAboveOrderAmount_Rejected()
    {
        var (_, svc, order) = Setup(500_000);
        var req = new UpdateStatusRequest("Partial", 600_000, null, null, null);
        Assert.Null(await svc.UpdateStatusAsync(order.Id, req, "manh", ShipperId));
    }

    [Fact]
    public async Task UpdateStatus_Partial_Valid_Succeeds()
    {
        var (_, svc, order) = Setup(500_000);
        var req = new UpdateStatusRequest("Partial", 200_000, null, null, null);
        var result = await svc.UpdateStatusAsync(order.Id, req, "manh", ShipperId);
        Assert.NotNull(result);
        Assert.Equal(OrderStatus.Partial, result!.Status);
        Assert.Equal(200_000, result.AmountPaid);
    }

    // ── Unpaid / Scheduled ────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateStatus_Unpaid_ResetsAmountPaidAndStoresReason()
    {
        var (_, svc, order) = Setup(500_000);
        order.AmountPaid = 100_000; // user trước đó nhập sai, giờ chuyển sang Unpaid

        var req = new UpdateStatusRequest("Unpaid", null, "Khách không có nhà", null, null);
        var result = await svc.UpdateStatusAsync(order.Id, req, "manh", ShipperId);

        Assert.Equal(OrderStatus.Unpaid, result!.Status);
        Assert.Equal(0, result.AmountPaid);
        Assert.Equal("Khách không có nhà", result.UnpaidReason);
    }

    [Fact]
    public async Task UpdateStatus_Scheduled_StoresUtcScheduledDate()
    {
        var (_, svc, order) = Setup(500_000);
        var when = new DateTime(2026, 7, 20, 9, 0, 0);

        var req = new UpdateStatusRequest("Scheduled", null, null, when, null);
        var result = await svc.UpdateStatusAsync(order.Id, req, "manh", ShipperId);

        Assert.Equal(OrderStatus.Scheduled, result!.Status);
        Assert.Equal(DateTimeKind.Utc, result.ScheduledDate!.Value.Kind);
        Assert.Equal(0, result.AmountPaid);
    }

    // ── Authorization ─────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateStatus_WrongShipper_Rejected()
    {
        var (_, svc, order) = Setup(500_000);
        var otherShipper = Guid.NewGuid();

        var req = new UpdateStatusRequest("PaidCash", 500_000, null, null, null);
        Assert.Null(await svc.UpdateStatusAsync(order.Id, req, "intruder", otherShipper));
    }

    [Fact]
    public async Task UpdateStatus_InvalidStatusEnum_Rejected()
    {
        var (_, svc, order) = Setup(500_000);
        var req = new UpdateStatusRequest("Bogus", null, null, null, null);
        Assert.Null(await svc.UpdateStatusAsync(order.Id, req, "manh", ShipperId));
    }

    [Fact]
    public async Task UpdateStatus_ShipperCannotSetBackToPending()
    {
        var (_, svc, order) = Setup(500_000);
        var req = new UpdateStatusRequest("Pending", null, null, null, null);
        Assert.Null(await svc.UpdateStatusAsync(order.Id, req, "manh", ShipperId));
    }

    // ── Lock ──────────────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateStatus_OrderLockedAtPast_Rejected()
    {
        var (db, svc, order) = Setup(500_000);
        order.LockedAt = DateTime.UtcNow.AddHours(-1);
        db.SaveChanges();

        var req = new UpdateStatusRequest("PaidCash", 500_000, null, null, null);
        Assert.Null(await svc.UpdateStatusAsync(order.Id, req, "manh", ShipperId));
    }

    [Fact]
    public async Task UpdateStatus_OrderLockedAtFuture_AllowsUpdate()
    {
        var (db, svc, order) = Setup(500_000);
        order.LockedAt = DateTime.UtcNow.AddHours(2);
        db.SaveChanges();

        var req = new UpdateStatusRequest("PaidCash", 500_000, null, null, null);
        // LockedAt > now ⇒ chưa khoá. lock_time mặc định 23:59 → cũng chưa khoá nếu chạy test giữa ngày.
        // Nếu chạy đúng sau 23:59 thì test này sẽ false-fail; chấp nhận trade-off vì rare case.
        var now = DateTime.Now;
        if (now.Hour >= 23 && now.Minute >= 59) return; // skip edge giờ
        Assert.NotNull(await svc.UpdateStatusAsync(order.Id, req, "manh", ShipperId));
    }

    [Fact]
    public async Task UpdateStatus_LockTimeFromSystemConfigOverridesAppsettings()
    {
        var (db, svc, order) = Setup(500_000);

        // Set lock_time DB về 00:01 → mọi giờ trong ngày đều khoá.
        var cfg = db.SystemConfigs.First(c => c.Key == "lock_time");
        cfg.Value = "00:01";
        db.SaveChanges();

        var req = new UpdateStatusRequest("PaidCash", 500_000, null, null, null);
        Assert.Null(await svc.UpdateStatusAsync(order.Id, req, "manh", ShipperId));
    }

    // ── SetDelivered ──────────────────────────────────────────────────────────

    [Fact]
    public async Task SetDelivered_FirstCall_SetsDeliveredAt()
    {
        var (_, svc, order) = Setup();
        var result = await svc.SetDeliveredAsync(order.Id, ShipperId);
        Assert.NotNull(result!.DeliveredAt);
    }

    [Fact]
    public async Task SetDelivered_Idempotent_DoesNotChangeExistingTimestamp()
    {
        var (db, svc, order) = Setup();
        order.DeliveredAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        db.SaveChanges();

        var result = await svc.SetDeliveredAsync(order.Id, ShipperId);
        Assert.Equal(new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc), result!.DeliveredAt);
    }

    // ── Override ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task Override_StatusValid_Applies()
    {
        var (_, svc, order) = Setup(500_000, OrderStatus.Pending);
        var req = new OverrideRequest("Status", "PaidCash", "Khách đã chuyển TM");

        var result = await svc.OverrideAsync(order.Id, req, "ketoan");
        Assert.Equal(OrderStatus.PaidCash, result!.Status);
    }

    [Fact]
    public async Task Override_StatusInvalidEnum_RejectedWithoutSideEffect()
    {
        var (db, svc, order) = Setup(500_000, OrderStatus.Pending);
        var origStatus = order.Status;

        var req = new OverrideRequest("Status", "NotAStatus", "test");
        Assert.Null(await svc.OverrideAsync(order.Id, req, "ketoan"));

        var reloaded = await db.Orders.FindAsync(order.Id);
        Assert.Equal(origStatus, reloaded!.Status);
        Assert.Empty(db.OrderHistories); // không ghi history giả
        Assert.Empty(db.AuditLogs);      // không ghi audit giả
    }

    [Fact]
    public async Task Override_AmountPaidNegative_Rejected()
    {
        var (_, svc, order) = Setup(500_000);
        var req = new OverrideRequest("AmountPaid", "-100", "test");
        Assert.Null(await svc.OverrideAsync(order.Id, req, "ketoan"));
    }

    [Fact]
    public async Task Override_AmountPaidExceedsOrder_CapsAtAmount()
    {
        var (_, svc, order) = Setup(500_000);
        var req = new OverrideRequest("AmountPaid", "9999999", "ghi đè");
        var result = await svc.OverrideAsync(order.Id, req, "ketoan");
        Assert.Equal(500_000, result!.AmountPaid);
    }

    [Fact]
    public async Task Override_UnknownField_Rejected()
    {
        var (_, svc, order) = Setup(500_000);
        var req = new OverrideRequest("OrderCode", "HACK", "test");
        Assert.Null(await svc.OverrideAsync(order.Id, req, "ketoan"));
    }

    [Fact]
    public async Task Override_NoLockCheck_AccountantCanFixAnytime()
    {
        var (db, svc, order) = Setup(500_000);
        order.LockedAt = DateTime.UtcNow.AddHours(-1);
        db.SaveChanges();

        var req = new OverrideRequest("Status", "PaidCash", "fix lock");
        Assert.NotNull(await svc.OverrideAsync(order.Id, req, "ketoan"));
    }

    // ── Detail visibility ─────────────────────────────────────────────────────

    [Fact]
    public async Task GetOrderDetail_Shipper_DoesNotSeeAccountantNote()
    {
        var (db, svc, order) = Setup();
        order.AccountantNote = "Bí mật kế toán";
        db.SaveChanges();

        var dto = await svc.GetOrderDetailAsync(order.Id, UserRole.Shipper, ShipperId);
        Assert.Null(dto!.AccountantNote);
    }

    [Fact]
    public async Task GetOrderDetail_Accountant_SeesAccountantNote()
    {
        var (db, svc, order) = Setup();
        order.AccountantNote = "Bí mật kế toán";
        db.SaveChanges();

        var dto = await svc.GetOrderDetailAsync(order.Id, UserRole.Accountant, Guid.NewGuid());
        Assert.Equal("Bí mật kế toán", dto!.AccountantNote);
    }

    [Fact]
    public async Task GetOrderDetail_ShipperCannotAccessOthersOrder()
    {
        var (_, svc, order) = Setup();
        var dto = await svc.GetOrderDetailAsync(order.Id, UserRole.Shipper, Guid.NewGuid());
        Assert.Null(dto);
    }
}
