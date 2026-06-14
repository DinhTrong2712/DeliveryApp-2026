using System.Drawing;
using DeliveryApp.API.Data;
using DeliveryApp.API.DTOs.Dashboard;
using DeliveryApp.API.Models;
using Microsoft.EntityFrameworkCore;
using OfficeOpenXml;
using OfficeOpenXml.Style;

namespace DeliveryApp.API.Services;

public class ReportService
{
    private readonly AppDbContext _db;

    public ReportService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<DashboardDto> GetDashboardAsync()
    {
        var counts = await _db.Orders
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total            = g.Count(),
                PaidFull         = g.Count(o => o.Status == OrderStatus.PaidCash || o.Status == OrderStatus.PaidTransfer),
                WaitingTransfer  = g.Count(o => o.Status == OrderStatus.WaitingTransfer),
                Partial          = g.Count(o => o.Status == OrderStatus.Partial),
                Scheduled        = g.Count(o => o.Status == OrderStatus.Scheduled),
                Unpaid           = g.Count(o => o.Status == OrderStatus.Unpaid),
                TotalCash        = g.Where(o => o.Status == OrderStatus.PaidCash).Sum(o => (decimal?)o.AmountPaid) ?? 0m,
            })
            .FirstOrDefaultAsync();

        var unmatchedSePay = await _db.SePayTransactions
            .CountAsync(t => t.MatchStatus == MatchStatus.Unmatched);

        return new DashboardDto(
            TotalOrders:       counts?.Total ?? 0,
            PaidFull:          counts?.PaidFull ?? 0,
            WaitingTransfer:   counts?.WaitingTransfer ?? 0,
            Partial:           counts?.Partial ?? 0,
            Scheduled:         counts?.Scheduled ?? 0,
            Unpaid:            counts?.Unpaid ?? 0,
            UnmatchedSePay:    unmatchedSePay,
            TotalCashToCollect: counts?.TotalCash ?? 0m,
            LastUpdated:       DateTime.UtcNow
        );
    }

    // Vietnam là UTC+7 cố định (không có DST). Trước đây code dùng SpecifyKind(Utc) coi 00:00 local
    // như 00:00 UTC → khoảng báo cáo bị lệch 7 giờ, đơn tạo lúc 0–7h sáng VN bị tính sang ngày trước.
    private static readonly TimeSpan VietnamOffset = TimeSpan.FromHours(7);

    private static (DateTime startUtc, DateTime endUtc) VietnamDayToUtcRange(DateTime date)
    {
        var startUtc = new DateTimeOffset(date.Date, VietnamOffset).UtcDateTime;
        return (startUtc, startUtc.AddDays(1));
    }

    public async Task<DailyReportDto> GetDailyReportAsync(DateTime date)
    {
        var (start, end) = VietnamDayToUtcRange(date);
        var orders = await _db.Orders
            .Include(o => o.Shipper)
            .Where(o => o.CreatedAt >= start && o.CreatedAt < end)
            .ToListAsync();

        // Đơn Partial là CK đã thu được 1 phần (qua SePay) — phần đã thu phải tính vào doanh thu CK,
        // phần còn lại tính vào nợ. Trước đây bị bỏ sót khiến doanh thu hụt.
        var byShipper = orders
            .Where(o => o.ShipperId.HasValue)
            .GroupBy(o => o.ShipperNameXlsx ?? o.Shipper?.FullName ?? "Chưa phân công")
            .Select(g => new ShipperReportDto(
                ShipperName: g.Key,
                TotalOrders: g.Count(),
                TotalAmount: g.Sum(o => o.Amount),
                CashAmount: g.Where(o => o.Status == OrderStatus.PaidCash).Sum(o => o.AmountPaid),
                TransferAmount: g.Where(o => o.Status == OrderStatus.PaidTransfer || o.Status == OrderStatus.Partial)
                                  .Sum(o => o.AmountPaid),
                WaitingTransferCount: g.Count(o => o.Status == OrderStatus.WaitingTransfer),
                UnpaidAmount: g.Where(o => o.Status is OrderStatus.Unpaid or OrderStatus.Partial)
                               .Sum(o => o.Amount - o.AmountPaid),
                ScheduledAmount: g.Where(o => o.Status == OrderStatus.Scheduled)
                                  .Sum(o => o.Amount - o.AmountPaid),
                UnpaidCount: g.Count(o => o.Status == OrderStatus.Unpaid)
            )).ToList();

        var cash = orders.Where(o => o.Status == OrderStatus.PaidCash).Sum(o => o.AmountPaid);
        var transfer = orders.Where(o => o.Status == OrderStatus.PaidTransfer || o.Status == OrderStatus.Partial)
                             .Sum(o => o.AmountPaid);
        var debt = orders.Where(o => o.Status is OrderStatus.Unpaid or OrderStatus.Partial)
                         .Sum(o => o.Amount - o.AmountPaid);

        return new DailyReportDto(
            TotalOrders: orders.Count,
            TotalAmount: orders.Sum(o => o.Amount),
            Cash: cash,
            Transfer: transfer,
            WaitingTransferCount: orders.Count(o => o.Status == OrderStatus.WaitingTransfer),
            UnpaidAmount: debt,
            ScheduledAmount: orders.Where(o => o.Status == OrderStatus.Scheduled)
                                   .Sum(o => o.Amount - o.AmountPaid),
            Debt: debt,
            ByShipper: byShipper
        );
    }

    // Định dạng số tiền VND: 1234567 → "1,234,567 đ"
    private const string VndFormat = "#,##0\" đ\"";

    // Mã hex màu thương hiệu (cam Khương Phúc).
    private static readonly Color BrandPrimary = ColorTranslator.FromHtml("#F26B2C");
    private static readonly Color BrandHeader = ColorTranslator.FromHtml("#FFF1E6");
    private static readonly Color BorderColor = ColorTranslator.FromHtml("#D1D5DB");
    private static readonly Color SubtleGray = ColorTranslator.FromHtml("#F3F4F6");

    private static string ComposeNote(string? shipperNote, string? unpaidReason)
    {
        var parts = new List<string>();
        if (!string.IsNullOrWhiteSpace(shipperNote)) parts.Add(shipperNote.Trim());
        if (!string.IsNullOrWhiteSpace(unpaidReason)) parts.Add($"Lý do: {unpaidReason.Trim()}");
        return string.Join(" — ", parts);
    }

    private static string ToVietnameseStatus(OrderStatus s) => s switch
    {
        OrderStatus.Unassigned       => "Chưa phân",
        OrderStatus.Pending          => "Chờ giao",
        OrderStatus.WaitingTransfer  => "Chờ CK",
        OrderStatus.PaidCash         => "Đã thu TM",
        OrderStatus.PaidTransfer     => "Đã CK",
        OrderStatus.Partial          => "CK một phần",
        OrderStatus.Scheduled        => "Hẹn lại",
        OrderStatus.Unpaid           => "Chưa thu",
        _                            => s.ToString()
    };

    public async Task<byte[]> ExportDailyReportAsync(DateTime date, string? shipperName = null)
    {
        var report = await GetDailyReportAsync(date);
        ExcelPackage.LicenseContext = LicenseContext.NonCommercial;

        var isPerShipper = !string.IsNullOrWhiteSpace(shipperName);
        var rows = isPerShipper
            ? report.ByShipper.Where(s => string.Equals(s.ShipperName, shipperName, StringComparison.OrdinalIgnoreCase)).ToList()
            : report.ByShipper;

        var totalOrders = isPerShipper ? rows.Sum(s => s.TotalOrders) : report.TotalOrders;
        var totalAmount = isPerShipper ? rows.Sum(s => s.TotalAmount) : report.TotalAmount;
        var cash        = isPerShipper ? rows.Sum(s => s.CashAmount)  : report.Cash;
        var transfer    = isPerShipper ? rows.Sum(s => s.TransferAmount) : report.Transfer;
        var unpaid      = isPerShipper ? rows.Sum(s => s.UnpaidAmount) : report.UnpaidAmount;
        var scheduled   = isPerShipper ? rows.Sum(s => s.ScheduledAmount) : report.ScheduledAmount;
        var remaining   = totalAmount - cash - transfer;

        using var package = new ExcelPackage();

        // Tên sheet tối đa 31 ký tự (giới hạn Excel).
        var sheetTitle = isPerShipper ? $"BC {shipperName} {date:dd-MM-yyyy}" : $"Báo cáo {date:dd-MM-yyyy}";
        if (sheetTitle.Length > 31) sheetTitle = sheetTitle[..31];
        var ws = package.Workbook.Worksheets.Add(sheetTitle);
        ws.View.ShowGridLines = false;

        // ── Hàng tiêu đề ─────────────────────────────────────────────────────
        var title = isPerShipper
            ? $"BÁO CÁO DOANH THU — {shipperName!.ToUpperInvariant()} — NGÀY {date:dd/MM/yyyy}"
            : $"BÁO CÁO DOANH THU CUỐI NGÀY — {date:dd/MM/yyyy}";

        ws.Cells[1, 1, 1, 12].Merge = true;
        ws.Cells[1, 1].Value = title;
        ws.Cells[1, 1].Style.Font.Size = 16;
        ws.Cells[1, 1].Style.Font.Bold = true;
        ws.Cells[1, 1].Style.Font.Color.SetColor(Color.White);
        ws.Cells[1, 1].Style.Fill.PatternType = ExcelFillStyle.Solid;
        ws.Cells[1, 1].Style.Fill.BackgroundColor.SetColor(BrandPrimary);
        ws.Cells[1, 1].Style.HorizontalAlignment = ExcelHorizontalAlignment.Center;
        ws.Cells[1, 1].Style.VerticalAlignment = ExcelVerticalAlignment.Center;
        ws.Row(1).Height = 28;

        ws.Cells[2, 1, 2, 12].Merge = true;
        ws.Cells[2, 1].Value = $"Công ty TNHH Khương Phúc — NPP Hương Cường   |   Xuất lúc {DateTime.Now:HH:mm dd/MM/yyyy}";
        ws.Cells[2, 1].Style.Font.Italic = true;
        ws.Cells[2, 1].Style.Font.Color.SetColor(Color.Gray);
        ws.Cells[2, 1].Style.HorizontalAlignment = ExcelHorizontalAlignment.Center;

        // ── Khối tổng quan ───────────────────────────────────────────────────
        var summaryStart = 4;
        var totalCollected = cash + transfer;
        var rate = totalAmount > 0 ? (totalCollected / totalAmount * 100) : 0m;
        var totalDebt = totalAmount - totalCollected;

        WriteSummaryBlock(ws, summaryStart, new (string Label, decimal Value, bool IsCount, bool IsPercent)[]
        {
            ("Tổng số đơn",       totalOrders,  true,  false),
            ("Tổng cần thu",      totalAmount,  false, false),
            ("Tiền mặt thu được", cash,         false, false),
            ("Chuyển khoản",      transfer,     false, false),
            ("Tổng đã thu",       totalCollected, false, false),
            ("Tỉ lệ (%)",         rate,         false, true),
            ("Tổng công nợ",      totalDebt,    false, false),
            ("Còn lại chưa thu",  remaining,    false, false),
            ("Nợ hẹn lại",        scheduled,    false, false),
            ("Chưa thu được",     unpaid,       false, false),
        });

        // ── Tiêu đề khối nhân viên ──────────────────────────────────────────
        var sectionRow = summaryStart + 8;
        ws.Cells[sectionRow, 1, sectionRow, 12].Merge = true;
        ws.Cells[sectionRow, 1].Value = "CHI TIẾT THEO NHÂN VIÊN";
        ws.Cells[sectionRow, 1].Style.Font.Bold = true;
        ws.Cells[sectionRow, 1].Style.Font.Size = 12;
        ws.Cells[sectionRow, 1].Style.Fill.PatternType = ExcelFillStyle.Solid;
        ws.Cells[sectionRow, 1].Style.Fill.BackgroundColor.SetColor(SubtleGray);

        // Header bảng nhân viên.
        var headerRow = sectionRow + 1;
        string[] headers = ["Nhân viên", "Số đơn", "Tổng cần thu", "Tiền mặt",
                            "Chuyển khoản", "Còn lại", "Đang CK", "Chưa thu", "Nợ hẹn",
                            "Tổng đã thu", "Tỉ lệ (%)", "Tổng công nợ"];
        for (int c = 0; c < headers.Length; c++)
        {
            ws.Cells[headerRow, c + 1].Value = headers[c];
        }
        StyleHeaderRow(ws, headerRow, 12);

        // Dữ liệu từng shipper.
        var row = headerRow + 1;
        foreach (var s in rows.OrderByDescending(s => s.TotalAmount))
        {
            var totalCollected = s.CashAmount + s.TransferAmount; // Tổng đã thu
            var rate = s.TotalAmount > 0 ? (totalCollected / s.TotalAmount * 100) : 0m; // Tỉ lệ %
            var totalDebt = s.TotalAmount - totalCollected; // Tổng công nợ

            ws.Cells[row, 1].Value = s.ShipperName;
            ws.Cells[row, 2].Value = s.TotalOrders;
            ws.Cells[row, 3].Value = s.TotalAmount;
            ws.Cells[row, 4].Value = s.CashAmount;
            ws.Cells[row, 5].Value = s.TransferAmount;
            ws.Cells[row, 6].Value = s.TotalAmount - s.CashAmount - s.TransferAmount;
            ws.Cells[row, 7].Value = s.WaitingTransferCount;
            ws.Cells[row, 8].Value = s.UnpaidAmount;
            ws.Cells[row, 9].Value = s.ScheduledAmount;
            ws.Cells[row, 10].Value = totalCollected; // Tổng đã thu
            ws.Cells[row, 11].Value = rate; // Tỉ lệ %
            ws.Cells[row, 12].Value = totalDebt; // Tổng công nợ
            row++;
        }

        // Hàng tổng cộng.
        if (rows.Count > 0)
        {
            var sumTotalCollected = rows.Sum(s => s.CashAmount + s.TransferAmount);
            var sumTotalAmount = rows.Sum(s => s.TotalAmount);
            var sumRate = sumTotalAmount > 0 ? (sumTotalCollected / sumTotalAmount * 100) : 0m;
            var sumTotalDebt = sumTotalAmount - sumTotalCollected;

            ws.Cells[row, 1].Value = "TỔNG CỘNG";
            ws.Cells[row, 2].Value = rows.Sum(s => s.TotalOrders);
            ws.Cells[row, 3].Value = sumTotalAmount;
            ws.Cells[row, 4].Value = rows.Sum(s => s.CashAmount);
            ws.Cells[row, 5].Value = rows.Sum(s => s.TransferAmount);
            ws.Cells[row, 6].Value = rows.Sum(s => s.TotalAmount - s.CashAmount - s.TransferAmount);
            ws.Cells[row, 7].Value = rows.Sum(s => s.WaitingTransferCount);
            ws.Cells[row, 8].Value = rows.Sum(s => s.UnpaidAmount);
            ws.Cells[row, 9].Value = rows.Sum(s => s.ScheduledAmount);
            ws.Cells[row, 10].Value = sumTotalCollected; // Tổng đã thu
            ws.Cells[row, 11].Value = sumRate; // Tỉ lệ %
            ws.Cells[row, 12].Value = sumTotalDebt; // Tổng công nợ
            ws.Cells[row, 1, row, 12].Style.Font.Bold = true;
            ws.Cells[row, 1, row, 12].Style.Fill.PatternType = ExcelFillStyle.Solid;
            ws.Cells[row, 1, row, 12].Style.Fill.BackgroundColor.SetColor(BrandHeader);
        }

        var tableLastRow = row;
        // Format tiền tệ cho các cột tiền (cột 3..6, 8..10, 12) trong bảng nhân viên.
        var moneyCols = new[] { 3, 4, 5, 6, 8, 9, 10, 12 };
        foreach (var c in moneyCols)
            ws.Cells[headerRow + 1, c, tableLastRow, c].Style.Numberformat.Format = VndFormat;

        // Format tỉ lệ % cho cột 11
        ws.Cells[headerRow + 1, 11, tableLastRow, 11].Style.Numberformat.Format = "0.00\"%\"";

        // Đường viền cho bảng.
        ApplyBorders(ws.Cells[headerRow, 1, tableLastRow, 12]);

        // ── Chi tiết đơn (chỉ khi xuất theo nhân viên) ─────────────────────
        if (isPerShipper)
        {
            var orders = await GetOrdersOfShipperAsync(date, shipperName!);
            if (orders.Count > 0)
            {
                var detailSection = tableLastRow + 2;
                ws.Cells[detailSection, 1, detailSection, 9].Merge = true;
                ws.Cells[detailSection, 1].Value = $"CHI TIẾT {orders.Count} ĐƠN HÀNG";
                ws.Cells[detailSection, 1].Style.Font.Bold = true;
                ws.Cells[detailSection, 1].Style.Font.Size = 12;
                ws.Cells[detailSection, 1].Style.Fill.PatternType = ExcelFillStyle.Solid;
                ws.Cells[detailSection, 1].Style.Fill.BackgroundColor.SetColor(SubtleGray);

                var detailHeader = detailSection + 1;
                string[] dh = ["STT", "Mã đơn", "Khách hàng", "Tổng tiền", "Đã thu",
                                "Còn lại", "Trạng thái", "Ghi chú shipper", "Diễn giải nhập"];
                for (int c = 0; c < dh.Length; c++)
                    ws.Cells[detailHeader, c + 1].Value = dh[c];
                StyleHeaderRow(ws, detailHeader, 9);

                var dr = detailHeader + 1;
                var stt = 1;
                foreach (var o in orders.OrderBy(o => o.OrderCode))
                {
                    ws.Cells[dr, 1].Value = stt++;
                    ws.Cells[dr, 2].Value = o.OrderCode;
                    ws.Cells[dr, 3].Value = o.CustomerName;
                    ws.Cells[dr, 4].Value = o.Amount;
                    ws.Cells[dr, 5].Value = o.AmountPaid;
                    ws.Cells[dr, 6].Value = o.Amount - o.AmountPaid;
                    ws.Cells[dr, 7].Value = ToVietnameseStatus(o.Status);
                    // Gộp ShipperNote + UnpaidReason (lý do chưa thu) để 1 ô vẫn đủ ngữ cảnh
                    // mà không phải thêm cột riêng — UnpaidReason chỉ có khi status = Unpaid.
                    ws.Cells[dr, 8].Value = ComposeNote(o.ShipperNote, o.UnpaidReason);
                    ws.Cells[dr, 9].Value = o.OriginNote;
                    dr++;
                }

                // Tổng cộng chi tiết đơn.
                ws.Cells[dr, 1, dr, 3].Merge = true;
                ws.Cells[dr, 1].Value = "TỔNG";
                ws.Cells[dr, 4].Value = orders.Sum(o => o.Amount);
                ws.Cells[dr, 5].Value = orders.Sum(o => o.AmountPaid);
                ws.Cells[dr, 6].Value = orders.Sum(o => o.Amount - o.AmountPaid);
                ws.Cells[dr, 1, dr, 9].Style.Font.Bold = true;
                ws.Cells[dr, 1, dr, 9].Style.Fill.PatternType = ExcelFillStyle.Solid;
                ws.Cells[dr, 1, dr, 9].Style.Fill.BackgroundColor.SetColor(BrandHeader);

                foreach (var c in new[] { 4, 5, 6 })
                    ws.Cells[detailHeader + 1, c, dr, c].Style.Numberformat.Format = VndFormat;
                ws.Cells[detailHeader + 1, 1, dr, 1].Style.HorizontalAlignment = ExcelHorizontalAlignment.Center;
                ws.Cells[detailHeader + 1, 7, dr - 1, 7].Style.HorizontalAlignment = ExcelHorizontalAlignment.Center;
                ws.Cells[detailHeader + 1, 8, dr - 1, 9].Style.WrapText = true;

                ApplyBorders(ws.Cells[detailHeader, 1, dr, 9]);
            }
        }

        // Auto-fit cột cho gọn.
        ws.Cells[ws.Dimension.Address].AutoFitColumns(8, 40);
        // Giữ STT hẹp + Trạng thái vừa đủ.
        if (isPerShipper)
        {
            ws.Column(1).Width = Math.Min(ws.Column(1).Width, 6);
            ws.Column(7).Width = Math.Max(ws.Column(7).Width, 14);
        }
        // Set chiều rộng cho 3 cột mới: Tổng đã thu, Tỉ lệ, Tổng công nợ
        ws.Column(10).Width = 14; // Tổng đã thu
        ws.Column(11).Width = 10; // Tỉ lệ %
        ws.Column(12).Width = 14; // Tổng công nợ

        return await package.GetAsByteArrayAsync();
    }

    // ── Helpers vẽ Excel ──────────────────────────────────────────────────────

    private static void WriteSummaryBlock(ExcelWorksheet ws, int startRow,
        IReadOnlyList<(string Label, decimal Value, bool IsCount, bool IsPercent)> entries)
    {
        ws.Cells[startRow, 1, startRow, 12].Merge = true;
        ws.Cells[startRow, 1].Value = "TỔNG QUAN";
        ws.Cells[startRow, 1].Style.Font.Bold = true;
        ws.Cells[startRow, 1].Style.Font.Size = 12;
        ws.Cells[startRow, 1].Style.Fill.PatternType = ExcelFillStyle.Solid;
        ws.Cells[startRow, 1].Style.Fill.BackgroundColor.SetColor(SubtleGray);

        var r = startRow + 1;
        foreach (var e in entries)
        {
            ws.Cells[r, 1, r, 3].Merge = true;
            ws.Cells[r, 1].Value = e.Label;
            ws.Cells[r, 1].Style.Font.Bold = true;
            ws.Cells[r, 1].Style.Indent = 1;

            ws.Cells[r, 4, r, 5].Merge = true;
            ws.Cells[r, 4].Value = e.Value;
            if (e.IsCount)
                ws.Cells[r, 4].Style.Numberformat.Format = "#,##0\" đơn\"";
            else if (e.IsPercent)
                ws.Cells[r, 4].Style.Numberformat.Format = "0.00\"%\"";
            else
                ws.Cells[r, 4].Style.Numberformat.Format = VndFormat;
            ws.Cells[r, 4].Style.HorizontalAlignment = ExcelHorizontalAlignment.Right;
            r++;
        }
        ApplyBorders(ws.Cells[startRow + 1, 1, r - 1, 5]);
    }

    private static void StyleHeaderRow(ExcelWorksheet ws, int row, int colCount)
    {
        var range = ws.Cells[row, 1, row, colCount];
        range.Style.Font.Bold = true;
        range.Style.Font.Color.SetColor(Color.White);
        range.Style.Fill.PatternType = ExcelFillStyle.Solid;
        range.Style.Fill.BackgroundColor.SetColor(BrandPrimary);
        range.Style.HorizontalAlignment = ExcelHorizontalAlignment.Center;
        range.Style.VerticalAlignment = ExcelVerticalAlignment.Center;
        ws.Row(row).Height = 22;
    }

    private static void ApplyBorders(ExcelRange range)
    {
        var border = range.Style.Border;
        border.Top.Style = ExcelBorderStyle.Thin;
        border.Bottom.Style = ExcelBorderStyle.Thin;
        border.Left.Style = ExcelBorderStyle.Thin;
        border.Right.Style = ExcelBorderStyle.Thin;
        border.Top.Color.SetColor(BorderColor);
        border.Bottom.Color.SetColor(BorderColor);
        border.Left.Color.SetColor(BorderColor);
        border.Right.Color.SetColor(BorderColor);
    }

    private async Task<List<Order>> GetOrdersOfShipperAsync(DateTime date, string shipperName)
    {
        var (start, end) = VietnamDayToUtcRange(date);
        var all = await _db.Orders
            .Include(o => o.Shipper)
            .Where(o => o.CreatedAt >= start && o.CreatedAt < end && o.ShipperId.HasValue)
            .OrderBy(o => o.OrderCode)
            .ToListAsync();
        return all
            .Where(o => string.Equals(o.ShipperNameXlsx ?? o.Shipper?.FullName ?? "", shipperName, StringComparison.OrdinalIgnoreCase))
            .ToList();
    }
}
