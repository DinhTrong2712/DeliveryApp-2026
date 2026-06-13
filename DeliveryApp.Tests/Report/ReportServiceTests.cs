using DeliveryApp.API.Data;
using DeliveryApp.API.Models;
using DeliveryApp.Tests.Helpers;

namespace DeliveryApp.Tests.Report;

public class ReportServiceTests
{
    private static AppDbContext SeedDb()
    {
        var db = TestDbHelper.CreateInMemoryDb();
        return db;
    }

    private static DateTime VnDayUtc(int year, int month, int day, int hour = 0, int minute = 0)
    {
        // Quy đổi giờ Vietnam (UTC+7) sang UTC để gán CreatedAt cho test.
        var local = new DateTime(year, month, day, hour, minute, 0);
        return new DateTimeOffset(local, TimeSpan.FromHours(7)).UtcDateTime;
    }

    // ── Dashboard ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Dashboard_CountsAllStatuses()
    {
        var db = SeedDb();
        db.Orders.AddRange(
            TestDbHelper.CreateOrder("A1", 100_000, OrderStatus.PaidCash),
            TestDbHelper.CreateOrder("A2", 200_000, OrderStatus.PaidTransfer),
            TestDbHelper.CreateOrder("A3", 300_000, OrderStatus.WaitingTransfer),
            TestDbHelper.CreateOrder("A4", 400_000, OrderStatus.Partial),
            TestDbHelper.CreateOrder("A5", 500_000, OrderStatus.Scheduled),
            TestDbHelper.CreateOrder("A6", 600_000, OrderStatus.Unpaid)
        );
        await db.SaveChangesAsync();

        var report = await ServiceFactory.Report(db).GetDashboardAsync();

        Assert.Equal(6, report.TotalOrders);
        Assert.Equal(2, report.PaidFull); // PaidCash + PaidTransfer
        Assert.Equal(1, report.WaitingTransfer);
        Assert.Equal(1, report.Partial);
        Assert.Equal(1, report.Scheduled);
        Assert.Equal(1, report.Unpaid);
    }

    [Fact]
    public async Task Dashboard_TotalCashIncludesOnlyPaidCash()
    {
        var db = SeedDb();
        var paidCash = TestDbHelper.CreateOrder("A1", 100_000, OrderStatus.PaidCash);
        paidCash.AmountPaid = 100_000;
        var paidTransfer = TestDbHelper.CreateOrder("A2", 200_000, OrderStatus.PaidTransfer);
        paidTransfer.AmountPaid = 200_000;
        db.Orders.AddRange(paidCash, paidTransfer);
        await db.SaveChangesAsync();

        var report = await ServiceFactory.Report(db).GetDashboardAsync();
        Assert.Equal(100_000, report.TotalCashToCollect);
    }

    // ── Daily report — Partial included in transfer (regression cho fix vòng 1) ─

    [Fact]
    public async Task DailyReport_TransferTotal_IncludesPartialAmountPaid()
    {
        var db = SeedDb();
        var date = VnDayUtc(2026, 6, 13, 10);

        var paidT = TestDbHelper.CreateOrder("BH001", 500_000, OrderStatus.PaidTransfer);
        paidT.AmountPaid = 500_000;
        paidT.CreatedAt = date;

        var partial = TestDbHelper.CreateOrder("BH002", 500_000, OrderStatus.Partial);
        partial.AmountPaid = 200_000;
        partial.CreatedAt = date;

        db.Orders.AddRange(paidT, partial);
        await db.SaveChangesAsync();

        var report = await ServiceFactory.Report(db).GetDailyReportAsync(new DateTime(2026, 6, 13));

        // Transfer = 500k (PaidTransfer) + 200k (Partial) = 700k.
        Assert.Equal(700_000, report.Transfer);
        // Debt = 300k còn lại của Partial.
        Assert.Equal(300_000, report.Debt);
    }

    [Fact]
    public async Task DailyReport_CashTotal_ExcludesPartial()
    {
        var db = SeedDb();
        var date = VnDayUtc(2026, 6, 13, 10);

        var cash = TestDbHelper.CreateOrder("BH001", 100_000, OrderStatus.PaidCash);
        cash.AmountPaid = 100_000;
        cash.CreatedAt = date;

        var partial = TestDbHelper.CreateOrder("BH002", 500_000, OrderStatus.Partial);
        partial.AmountPaid = 200_000;
        partial.CreatedAt = date;

        db.Orders.AddRange(cash, partial);
        await db.SaveChangesAsync();

        var report = await ServiceFactory.Report(db).GetDailyReportAsync(new DateTime(2026, 6, 13));
        Assert.Equal(100_000, report.Cash);
    }

    // ── Timezone — regression cho fix vòng 2 (Vietnam UTC+7) ──────────────────

    [Fact]
    public async Task DailyReport_OrderAt6amVietnam_CountedInSameVnDay()
    {
        var db = SeedDb();
        // 06:00 sáng 13/06 giờ VN = 23:00 UTC ngày 12/06. Trước fix bị xếp sang 12/06.
        var early = TestDbHelper.CreateOrder("EARLY", 100_000, OrderStatus.PaidCash);
        early.AmountPaid = 100_000;
        early.CreatedAt = VnDayUtc(2026, 6, 13, 6);

        db.Orders.Add(early);
        await db.SaveChangesAsync();

        var report = await ServiceFactory.Report(db).GetDailyReportAsync(new DateTime(2026, 6, 13));
        Assert.Equal(1, report.TotalOrders);
        Assert.Equal(100_000, report.Cash);
    }

    [Fact]
    public async Task DailyReport_OrderAt23pmVietnam_StillCountedInSameVnDay()
    {
        var db = SeedDb();
        // 23:30 đêm 13/06 giờ VN = 16:30 UTC 13/06 — vẫn ngày 13/06 theo VN.
        var late = TestDbHelper.CreateOrder("LATE", 200_000, OrderStatus.PaidTransfer);
        late.AmountPaid = 200_000;
        late.CreatedAt = VnDayUtc(2026, 6, 13, 23, 30);

        db.Orders.Add(late);
        await db.SaveChangesAsync();

        var report = await ServiceFactory.Report(db).GetDailyReportAsync(new DateTime(2026, 6, 13));
        Assert.Equal(1, report.TotalOrders);
    }

    [Fact]
    public async Task DailyReport_OrderOutsideVnDay_NotCounted()
    {
        var db = SeedDb();
        var prevDay = TestDbHelper.CreateOrder("PREV", 100_000, OrderStatus.PaidCash);
        prevDay.AmountPaid = 100_000;
        prevDay.CreatedAt = VnDayUtc(2026, 6, 12, 23); // 23h 12/06 VN

        var nextDay = TestDbHelper.CreateOrder("NEXT", 200_000, OrderStatus.PaidCash);
        nextDay.AmountPaid = 200_000;
        nextDay.CreatedAt = VnDayUtc(2026, 6, 14, 1); // 01h 14/06 VN

        db.Orders.AddRange(prevDay, nextDay);
        await db.SaveChangesAsync();

        var report = await ServiceFactory.Report(db).GetDailyReportAsync(new DateTime(2026, 6, 13));
        Assert.Equal(0, report.TotalOrders);
    }

    // ── ByShipper grouping ────────────────────────────────────────────────────

    [Fact]
    public async Task DailyReport_GroupsByShipperNameXlsx()
    {
        var db = SeedDb();
        var sid = Guid.NewGuid();
        var a = TestDbHelper.CreateOrder("A1", 100_000, OrderStatus.PaidCash, sid);
        a.AmountPaid = 100_000;
        a.ShipperNameXlsx = "Kho - Mạnh giao hàng";
        a.CreatedAt = VnDayUtc(2026, 6, 13, 9);

        var b = TestDbHelper.CreateOrder("A2", 200_000, OrderStatus.PaidTransfer, sid);
        b.AmountPaid = 200_000;
        b.ShipperNameXlsx = "Kho - Mạnh giao hàng";
        b.CreatedAt = VnDayUtc(2026, 6, 13, 10);

        db.Orders.AddRange(a, b);
        await db.SaveChangesAsync();

        var report = await ServiceFactory.Report(db).GetDailyReportAsync(new DateTime(2026, 6, 13));
        var row = Assert.Single(report.ByShipper);
        Assert.Equal("Kho - Mạnh giao hàng", row.ShipperName);
        Assert.Equal(2, row.TotalOrders);
        Assert.Equal(100_000, row.CashAmount);
        Assert.Equal(200_000, row.TransferAmount);
    }
}
