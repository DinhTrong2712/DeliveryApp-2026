using DeliveryApp.API.Data;
using DeliveryApp.API.Models;
using DeliveryApp.Tests.Helpers;
using OfficeOpenXml;

namespace DeliveryApp.Tests.Report;

public class ExcelExportTests
{
    private const string TestShipperName = "Kho - Mạnh giao hàng";

    private static DateTime VnDayUtc(int y, int m, int d, int h = 10) =>
        new DateTimeOffset(new DateTime(y, m, d, h, 0, 0), TimeSpan.FromHours(7)).UtcDateTime;

    /// <summary>Seed 1 ngày báo cáo điển hình: 5 đơn cho 2 shipper, đủ trạng thái.</summary>
    private static AppDbContext SeedTypicalDay(DateTime date)
    {
        var db = TestDbHelper.CreateInMemoryDb();
        var sid1 = Guid.NewGuid();
        var sid2 = Guid.NewGuid();
        var ts = VnDayUtc(date.Year, date.Month, date.Day);

        // Shipper 1 (Mạnh): 1 PaidCash, 1 Partial, 1 Unpaid
        var o1 = TestDbHelper.CreateOrder("BH001", 500_000, OrderStatus.PaidCash, sid1);
        o1.ShipperNameXlsx = TestShipperName;
        o1.AmountPaid = 500_000;
        o1.CustomerName = "Cô Lan — Tạp hoá Thái Hà";
        o1.CreatedAt = ts;
        o1.ShipperNote = "Khách thanh toán đủ tiền mặt";

        var o2 = TestDbHelper.CreateOrder("BH002", 800_000, OrderStatus.Partial, sid1);
        o2.ShipperNameXlsx = TestShipperName;
        o2.AmountPaid = 300_000;
        o2.CustomerName = "Anh Hùng — Quán nước";
        o2.CreatedAt = ts;
        o2.OriginNote = "Giao đợt 1";

        var o3 = TestDbHelper.CreateOrder("BH003", 200_000, OrderStatus.Unpaid, sid1);
        o3.ShipperNameXlsx = TestShipperName;
        o3.UnpaidReason = "Khách không có nhà";
        o3.CustomerName = "Bà Mai";
        o3.CreatedAt = ts;

        // Shipper 2 (Trường): 1 PaidTransfer, 1 Scheduled
        var o4 = TestDbHelper.CreateOrder("BH010", 1_200_000, OrderStatus.PaidTransfer, sid2);
        o4.ShipperNameXlsx = "Kho - Trường giao hàng";
        o4.AmountPaid = 1_200_000;
        o4.CustomerName = "Cửa hàng Phú Cường";
        o4.CreatedAt = ts;

        var o5 = TestDbHelper.CreateOrder("BH011", 600_000, OrderStatus.Scheduled, sid2);
        o5.ShipperNameXlsx = "Kho - Trường giao hàng";
        o5.CustomerName = "Quán cơm Bé Ba";
        o5.ScheduledDate = ts.AddDays(2);
        o5.CreatedAt = ts;

        db.Orders.AddRange(o1, o2, o3, o4, o5);
        db.SaveChanges();
        return db;
    }

    private static ExcelPackage Open(byte[] bytes) => new(new MemoryStream(bytes));

    // ── File hợp lệ ───────────────────────────────────────────────────────────

    [Fact]
    public async Task Export_FullDay_ReturnsValidXlsxBytes()
    {
        var db = SeedTypicalDay(new DateTime(2026, 6, 13));
        var bytes = await ServiceFactory.Report(db).ExportDailyReportAsync(new DateTime(2026, 6, 13));

        Assert.NotEmpty(bytes);
        // 4 byte đầu của file .xlsx luôn là "PK\x03\x04" (ZIP header).
        Assert.Equal(0x50, bytes[0]);
        Assert.Equal(0x4B, bytes[1]);

        using var pkg = Open(bytes);
        Assert.Single(pkg.Workbook.Worksheets);
    }

    [Fact]
    public async Task Export_SheetName_FitsExcelLimit()
    {
        var db = SeedTypicalDay(new DateTime(2026, 6, 13));
        var bytes = await ServiceFactory.Report(db).ExportDailyReportAsync(new DateTime(2026, 6, 13));

        using var pkg = Open(bytes);
        var sheet = pkg.Workbook.Worksheets[0];
        Assert.True(sheet.Name.Length <= 31, $"Sheet name dài {sheet.Name.Length} ký tự, vượt giới hạn Excel 31.");
    }

    [Fact]
    public async Task Export_PerShipperWithLongName_SheetNameTruncatedSafely()
    {
        var db = SeedTypicalDay(new DateTime(2026, 6, 13));
        // Tên shipper dài → sheet name có nguy cơ > 31 ký tự.
        var bytes = await ServiceFactory.Report(db).ExportDailyReportAsync(
            new DateTime(2026, 6, 13), TestShipperName);

        using var pkg = Open(bytes);
        Assert.True(pkg.Workbook.Worksheets[0].Name.Length <= 31);
    }

    // ── Tiêu đề & metadata ────────────────────────────────────────────────────

    [Fact]
    public async Task Export_Title_ContainsReportDate()
    {
        var db = SeedTypicalDay(new DateTime(2026, 6, 13));
        var bytes = await ServiceFactory.Report(db).ExportDailyReportAsync(new DateTime(2026, 6, 13));

        using var pkg = Open(bytes);
        var ws = pkg.Workbook.Worksheets[0];

        var titleCell = ws.Cells[1, 1].Value?.ToString() ?? "";
        Assert.Contains("BÁO CÁO", titleCell);
        Assert.Contains("13/06/2026", titleCell);

        // Tiêu đề phải bold + font lớn.
        Assert.True(ws.Cells[1, 1].Style.Font.Bold);
        Assert.True(ws.Cells[1, 1].Style.Font.Size >= 14);
    }

    [Fact]
    public async Task Export_PerShipper_TitleContainsShipperName()
    {
        var db = SeedTypicalDay(new DateTime(2026, 6, 13));
        var bytes = await ServiceFactory.Report(db).ExportDailyReportAsync(
            new DateTime(2026, 6, 13), TestShipperName);

        using var pkg = Open(bytes);
        var title = pkg.Workbook.Worksheets[0].Cells[1, 1].Value?.ToString() ?? "";
        Assert.Contains("MẠNH", title.ToUpperInvariant());
    }

    [Fact]
    public async Task Export_HasCompanyInfoLine()
    {
        var db = SeedTypicalDay(new DateTime(2026, 6, 13));
        var bytes = await ServiceFactory.Report(db).ExportDailyReportAsync(new DateTime(2026, 6, 13));

        using var pkg = Open(bytes);
        var meta = pkg.Workbook.Worksheets[0].Cells[2, 1].Value?.ToString() ?? "";
        Assert.Contains("Khương Phúc", meta);
        Assert.Contains("Xuất lúc", meta);
    }

    // ── Khối tổng quan ────────────────────────────────────────────────────────

    [Fact]
    public async Task Export_SummaryBlock_HasAllKeyMetrics()
    {
        var db = SeedTypicalDay(new DateTime(2026, 6, 13));
        var bytes = await ServiceFactory.Report(db).ExportDailyReportAsync(new DateTime(2026, 6, 13));

        using var pkg = Open(bytes);
        var ws = pkg.Workbook.Worksheets[0];
        var allText = string.Join("|", AllCellTexts(ws));

        Assert.Contains("Tổng số đơn", allText);
        Assert.Contains("Tổng cần thu", allText);
        Assert.Contains("Tiền mặt thu được", allText);
        Assert.Contains("Chuyển khoản", allText);
        Assert.Contains("Còn lại chưa thu", allText);
        Assert.Contains("Nợ hẹn lại", allText);
        Assert.Contains("Chưa thu được", allText);
    }

    [Fact]
    public async Task Export_Numbers_MatchUnderlyingData()
    {
        var db = SeedTypicalDay(new DateTime(2026, 6, 13));
        var bytes = await ServiceFactory.Report(db).ExportDailyReportAsync(new DateTime(2026, 6, 13));

        using var pkg = Open(bytes);
        var ws = pkg.Workbook.Worksheets[0];

        // Tìm cell có label "Tổng cần thu" rồi đọc value ô tiền tương ứng (cùng row, col 4).
        var totalAmount = FindMetricValue(ws, "Tổng cần thu");
        // Tổng 5 đơn: 500k + 800k + 200k + 1.2M + 600k = 3.3M
        Assert.Equal(3_300_000m, totalAmount);

        var cash = FindMetricValue(ws, "Tiền mặt thu được");
        Assert.Equal(500_000m, cash); // chỉ BH001

        var transfer = FindMetricValue(ws, "Chuyển khoản");
        // PaidTransfer 1.2M + Partial 300k = 1.5M (regression test cho fix vòng 1)
        Assert.Equal(1_500_000m, transfer);
    }

    // ── Định dạng tiền VND ────────────────────────────────────────────────────

    [Fact]
    public async Task Export_MoneyColumns_UseVndNumberFormat()
    {
        var db = SeedTypicalDay(new DateTime(2026, 6, 13));
        var bytes = await ServiceFactory.Report(db).ExportDailyReportAsync(new DateTime(2026, 6, 13));

        using var pkg = Open(bytes);
        var ws = pkg.Workbook.Worksheets[0];

        // Có 2 cell "Tổng cần thu": 1 trong summary (col 1) và 1 trong table header (col 3).
        // Lấy cell ở column ≥ 3 (table header), rồi assert ô data ngay dưới có format VND.
        var headerCell = FindCellAt(ws, "Tổng cần thu", minCol: 3);
        Assert.NotNull(headerCell);
        var dataCell = ws.Cells[headerCell!.Start.Row + 1, headerCell.Start.Column];
        Assert.Contains("đ", dataCell.Style.Numberformat.Format);

        // Summary block cell cũng phải có format đ ở ô giá trị (col 4 của cùng row).
        var summaryLabel = FindCellAt(ws, "Tổng cần thu", maxCol: 2);
        Assert.NotNull(summaryLabel);
        var summaryValue = ws.Cells[summaryLabel!.Start.Row, 4];
        Assert.Contains("đ", summaryValue.Style.Numberformat.Format);
    }

    // ── Bảng nhân viên ────────────────────────────────────────────────────────

    [Fact]
    public async Task Export_ShipperTable_HasHeaderAndOneRowPerShipper()
    {
        var db = SeedTypicalDay(new DateTime(2026, 6, 13));
        var bytes = await ServiceFactory.Report(db).ExportDailyReportAsync(new DateTime(2026, 6, 13));

        using var pkg = Open(bytes);
        var ws = pkg.Workbook.Worksheets[0];
        var allText = string.Join("|", AllCellTexts(ws));

        Assert.Contains("CHI TIẾT THEO NHÂN VIÊN", allText);
        Assert.Contains(TestShipperName, allText);
        Assert.Contains("Kho - Trường giao hàng", allText);
        Assert.Contains("TỔNG CỘNG", allText);
    }

    [Fact]
    public async Task Export_ShipperTable_TotalsRowSumsCorrectly()
    {
        var db = SeedTypicalDay(new DateTime(2026, 6, 13));
        var bytes = await ServiceFactory.Report(db).ExportDailyReportAsync(new DateTime(2026, 6, 13));

        using var pkg = Open(bytes);
        var ws = pkg.Workbook.Worksheets[0];

        var totalRow = FindCellWithText(ws, "TỔNG CỘNG");
        Assert.NotNull(totalRow);

        // Col 3 = Tổng cần thu, col 4 = Tiền mặt, col 5 = Chuyển khoản.
        var totalRevenue = Convert.ToDecimal(ws.Cells[totalRow!.Start.Row, 3].Value);
        var totalCash = Convert.ToDecimal(ws.Cells[totalRow.Start.Row, 4].Value);
        var totalTransfer = Convert.ToDecimal(ws.Cells[totalRow.Start.Row, 5].Value);

        Assert.Equal(3_300_000m, totalRevenue);
        Assert.Equal(500_000m, totalCash);
        Assert.Equal(1_500_000m, totalTransfer);
    }

    // ── Header styling ────────────────────────────────────────────────────────

    [Fact]
    public async Task Export_TableHeader_IsBoldAndColored()
    {
        var db = SeedTypicalDay(new DateTime(2026, 6, 13));
        var bytes = await ServiceFactory.Report(db).ExportDailyReportAsync(new DateTime(2026, 6, 13));

        using var pkg = Open(bytes);
        var ws = pkg.Workbook.Worksheets[0];

        var headerCell = FindCellWithText(ws, "Nhân viên", asExactHeader: true);
        Assert.NotNull(headerCell);
        var style = ws.Cells[headerCell!.Start.Row, headerCell.Start.Column].Style;

        Assert.True(style.Font.Bold);
        Assert.NotNull(style.Fill.BackgroundColor.Rgb);
        Assert.False(string.IsNullOrEmpty(style.Fill.BackgroundColor.Rgb));
    }

    // ── Chi tiết đơn (per-shipper) ────────────────────────────────────────────

    [Fact]
    public async Task Export_PerShipper_IncludesOrderDetailSection()
    {
        var db = SeedTypicalDay(new DateTime(2026, 6, 13));
        var bytes = await ServiceFactory.Report(db).ExportDailyReportAsync(
            new DateTime(2026, 6, 13), TestShipperName);

        using var pkg = Open(bytes);
        var ws = pkg.Workbook.Worksheets[0];
        var allText = string.Join("|", AllCellTexts(ws));

        Assert.Contains("CHI TIẾT", allText);
        Assert.Contains("BH001", allText);
        Assert.Contains("BH002", allText);
        Assert.Contains("BH003", allText);
        // Không lẫn đơn của shipper khác.
        Assert.DoesNotContain("BH010", allText);
        Assert.DoesNotContain("BH011", allText);
    }

    [Fact]
    public async Task Export_PerShipper_StatusDisplayedInVietnamese()
    {
        var db = SeedTypicalDay(new DateTime(2026, 6, 13));
        var bytes = await ServiceFactory.Report(db).ExportDailyReportAsync(
            new DateTime(2026, 6, 13), TestShipperName);

        using var pkg = Open(bytes);
        var ws = pkg.Workbook.Worksheets[0];
        var allText = string.Join("|", AllCellTexts(ws));

        // Tiếng Việt thân thiện thay vì enum tiếng Anh.
        Assert.Contains("Đã thu TM", allText);
        Assert.Contains("CK một phần", allText);
        Assert.Contains("Chưa thu", allText);

        // Tên khách & ghi chú phải xuất hiện.
        Assert.Contains("Cô Lan", allText);
        Assert.Contains("Khách không có nhà", allText);
    }

    [Fact]
    public async Task Export_PerShipper_OrderDetailTotalsRowSumsCorrectly()
    {
        var db = SeedTypicalDay(new DateTime(2026, 6, 13));
        var bytes = await ServiceFactory.Report(db).ExportDailyReportAsync(
            new DateTime(2026, 6, 13), TestShipperName);

        using var pkg = Open(bytes);
        var ws = pkg.Workbook.Worksheets[0];

        // Có 2 hàng TỔNG: 1 ở bảng nhân viên, 1 ở chi tiết đơn → lấy hàng dưới cùng.
        var totals = AllCellsWithText(ws, "TỔNG").OrderBy(c => c.Start.Row).ToList();
        Assert.NotEmpty(totals);
        var bottom = totals.Last();

        var totalAmount = Convert.ToDecimal(ws.Cells[bottom.Start.Row, 4].Value);
        var totalPaid = Convert.ToDecimal(ws.Cells[bottom.Start.Row, 5].Value);
        var totalRemaining = Convert.ToDecimal(ws.Cells[bottom.Start.Row, 6].Value);

        // 3 đơn của Mạnh: 500k + 800k + 200k = 1.5M; đã thu 500k + 300k + 0 = 800k.
        Assert.Equal(1_500_000m, totalAmount);
        Assert.Equal(800_000m, totalPaid);
        Assert.Equal(700_000m, totalRemaining);
    }

    // ── Empty day ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Export_NoData_StillReturnsValidFile()
    {
        var db = TestDbHelper.CreateInMemoryDb();
        var bytes = await ServiceFactory.Report(db).ExportDailyReportAsync(new DateTime(2026, 6, 13));

        Assert.NotEmpty(bytes);
        using var pkg = Open(bytes);
        var ws = pkg.Workbook.Worksheets[0];
        // Vẫn có tiêu đề + khối tổng quan với số 0.
        Assert.Contains("BÁO CÁO", ws.Cells[1, 1].Value?.ToString() ?? "");
        Assert.Equal(0m, FindMetricValue(ws, "Tổng cần thu"));
    }

    // ── Helpers đọc ô ─────────────────────────────────────────────────────────

    private static IEnumerable<string> AllCellTexts(ExcelWorksheet ws)
    {
        if (ws.Dimension == null) yield break;
        for (int r = 1; r <= ws.Dimension.End.Row; r++)
            for (int c = 1; c <= ws.Dimension.End.Column; c++)
            {
                var v = ws.Cells[r, c].Value?.ToString();
                if (!string.IsNullOrEmpty(v)) yield return v;
            }
    }

    private static ExcelRange? FindCellWithText(ExcelWorksheet ws, string text, bool asExactHeader = false)
    {
        if (ws.Dimension == null) return null;
        for (int r = 1; r <= ws.Dimension.End.Row; r++)
            for (int c = 1; c <= ws.Dimension.End.Column; c++)
            {
                var v = ws.Cells[r, c].Value?.ToString();
                if (v == null) continue;
                if (asExactHeader ? string.Equals(v, text, StringComparison.Ordinal) : v.Contains(text))
                    return ws.Cells[r, c];
            }
        return null;
    }

    private static ExcelRange? FindCellAt(ExcelWorksheet ws, string text, int minCol = 1, int maxCol = int.MaxValue)
    {
        if (ws.Dimension == null) return null;
        for (int r = 1; r <= ws.Dimension.End.Row; r++)
            for (int c = Math.Max(1, minCol); c <= Math.Min(ws.Dimension.End.Column, maxCol); c++)
            {
                var v = ws.Cells[r, c].Value?.ToString();
                if (v != null && string.Equals(v, text, StringComparison.Ordinal))
                    return ws.Cells[r, c];
            }
        return null;
    }

    private static IEnumerable<ExcelRange> AllCellsWithText(ExcelWorksheet ws, string text)
    {
        if (ws.Dimension == null) yield break;
        for (int r = 1; r <= ws.Dimension.End.Row; r++)
            for (int c = 1; c <= ws.Dimension.End.Column; c++)
            {
                var v = ws.Cells[r, c].Value?.ToString();
                if (v != null && v.Contains(text)) yield return ws.Cells[r, c];
            }
    }

    /// <summary>Tìm label trong summary block và đọc giá trị tương ứng (cùng row, col 4).</summary>
    private static decimal FindMetricValue(ExcelWorksheet ws, string label)
    {
        var cell = FindCellWithText(ws, label, asExactHeader: true);
        if (cell == null) return 0m;
        var raw = ws.Cells[cell.Start.Row, 4].Value;
        return raw == null ? 0m : Convert.ToDecimal(raw);
    }
}
