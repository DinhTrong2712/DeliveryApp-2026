using DeliveryApp.API.Data;
using DeliveryApp.API.Models;
using DeliveryApp.Tests.Helpers;

namespace DeliveryApp.Tests.Report;

/// <summary>
/// Snapshot test sinh file Excel mẫu vào docs/ để kế toán mở xem trực quan,
/// đồng thời phục vụ visual diff khi đổi layout. Đặt biến môi trường
/// EXCEL_SAMPLE=1 để bật.
/// </summary>
public class ExcelSampleGenerator
{
    private static readonly string OutDir = Path.Combine(
        AppContext.BaseDirectory, "..", "..", "..", "..", "docs", "samples");

    private static bool Enabled =>
        string.Equals(Environment.GetEnvironmentVariable("EXCEL_SAMPLE"), "1");

    [Fact]
    public async Task GenerateSamples_Always()
    {
        if (!Enabled) return; // skip mặc định để không ghi file mỗi lần CI.

        Directory.CreateDirectory(OutDir);

        var date = new DateTime(2026, 6, 13);
        var db = SeedRichDay(date);
        var svc = ServiceFactory.Report(db);

        var full = await svc.ExportDailyReportAsync(date);
        await File.WriteAllBytesAsync(Path.Combine(OutDir, "baocao_full_2026-06-13.xlsx"), full);

        var perShipper = await svc.ExportDailyReportAsync(date, "Kho - Mạnh giao hàng");
        await File.WriteAllBytesAsync(Path.Combine(OutDir, "baocao_manh_2026-06-13.xlsx"), perShipper);
    }

    private static AppDbContext SeedRichDay(DateTime date)
    {
        var db = TestDbHelper.CreateInMemoryDb();
        var ts = new DateTimeOffset(date.Date.AddHours(10), TimeSpan.FromHours(7)).UtcDateTime;
        var sid1 = Guid.NewGuid();
        var sid2 = Guid.NewGuid();
        var sid3 = Guid.NewGuid();

        DeliveryApp.API.Models.Order Make(string code, decimal amount, decimal paid,
            OrderStatus status, Guid sid, string shipperName, string customer,
            string? note = null, string? unpaidReason = null)
        {
            var o = TestDbHelper.CreateOrder(code, amount, status, sid);
            o.ShipperNameXlsx = shipperName;
            o.AmountPaid = paid;
            o.CustomerName = customer;
            o.ShipperNote = note;
            o.UnpaidReason = unpaidReason;
            o.CreatedAt = ts;
            return o;
        }

        db.Orders.AddRange(
            Make("BH001", 500_000, 500_000, OrderStatus.PaidCash, sid1, "Kho - Mạnh giao hàng", "Cô Lan — Tạp hoá Thái Hà"),
            Make("BH002", 800_000, 300_000, OrderStatus.Partial,  sid1, "Kho - Mạnh giao hàng", "Anh Hùng — Quán nước", note: "Giao đợt 1"),
            Make("BH003", 200_000, 0,       OrderStatus.Unpaid,   sid1, "Kho - Mạnh giao hàng", "Bà Mai", unpaidReason: "Khách không có nhà"),
            Make("BH010", 1_200_000, 1_200_000, OrderStatus.PaidTransfer, sid2, "Kho - Trường giao hàng", "Cửa hàng Phú Cường"),
            Make("BH011", 600_000, 0, OrderStatus.Scheduled, sid2, "Kho - Trường giao hàng", "Quán cơm Bé Ba"),
            Make("BH020", 350_000, 350_000, OrderStatus.PaidCash, sid3, "Kho - Hùng giao hàng", "Tạp hoá Hồng Hà"),
            Make("BH021", 900_000, 0, OrderStatus.WaitingTransfer, sid3, "Kho - Hùng giao hàng", "Siêu thị mini")
        );
        db.SaveChanges();
        return db;
    }
}
