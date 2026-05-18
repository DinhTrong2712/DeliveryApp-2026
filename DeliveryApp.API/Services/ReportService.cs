using DeliveryApp.API.Data;
using DeliveryApp.API.DTOs.Dashboard;
using DeliveryApp.API.Models;
using Microsoft.EntityFrameworkCore;
using OfficeOpenXml;

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

    public async Task<DailyReportDto> GetDailyReportAsync(DateTime date)
    {
        var start = DateTime.SpecifyKind(date.Date, DateTimeKind.Utc);
        var end   = start.AddDays(1);
        var orders = await _db.Orders
            .Include(o => o.Shipper)
            .Where(o => o.CreatedAt >= start && o.CreatedAt < end)
            .ToListAsync();

        var byShipper = orders
            .Where(o => o.ShipperId.HasValue)
            .GroupBy(o => o.ShipperNameXlsx ?? o.Shipper?.FullName ?? "Chưa phân công")
            .Select(g => new ShipperReportDto(
                ShipperName: g.Key,
                TotalOrders: g.Count(),
                TotalAmount: g.Sum(o => o.Amount),
                CashAmount: g.Where(o => o.Status == OrderStatus.PaidCash).Sum(o => o.AmountPaid),
                TransferAmount: g.Where(o => o.Status == OrderStatus.PaidTransfer).Sum(o => o.AmountPaid),
                WaitingTransferCount: g.Count(o => o.Status == OrderStatus.WaitingTransfer),
                UnpaidAmount: g.Where(o => o.Status is OrderStatus.Unpaid or OrderStatus.Partial)
                               .Sum(o => o.Amount - o.AmountPaid),
                ScheduledAmount: g.Where(o => o.Status == OrderStatus.Scheduled)
                                  .Sum(o => o.Amount - o.AmountPaid),
                UnpaidCount: g.Count(o => o.Status == OrderStatus.Unpaid)
            )).ToList();

        var cash = orders.Where(o => o.Status == OrderStatus.PaidCash).Sum(o => o.AmountPaid);
        var transfer = orders.Where(o => o.Status == OrderStatus.PaidTransfer).Sum(o => o.AmountPaid);
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

    public async Task<byte[]> ExportDailyReportAsync(DateTime date, string? shipperName = null)
    {
        var report = await GetDailyReportAsync(date);
        ExcelPackage.LicenseContext = LicenseContext.NonCommercial;

        var rows = string.IsNullOrWhiteSpace(shipperName)
            ? report.ByShipper
            : report.ByShipper.Where(s => string.Equals(s.ShipperName, shipperName, StringComparison.OrdinalIgnoreCase)).ToList();

        var isPerShipper = !string.IsNullOrWhiteSpace(shipperName);
        var totalAmount = isPerShipper ? rows.Sum(s => s.TotalAmount) : report.TotalAmount;
        var cash = isPerShipper ? rows.Sum(s => s.CashAmount) : report.Cash;
        var transfer = isPerShipper ? rows.Sum(s => s.TransferAmount) : report.Transfer;
        var unpaid = isPerShipper ? rows.Sum(s => s.UnpaidAmount) : report.UnpaidAmount;
        var scheduled = isPerShipper ? rows.Sum(s => s.ScheduledAmount) : report.ScheduledAmount;

        using var package = new ExcelPackage();
        var sheetTitle = isPerShipper ? $"BC {shipperName} {date:dd-MM-yyyy}" : $"Báo cáo {date:dd-MM-yyyy}";
        if (sheetTitle.Length > 31) sheetTitle = sheetTitle[..31];
        var ws = package.Workbook.Worksheets.Add(sheetTitle);

        ws.Cells[1, 1].Value = isPerShipper ? $"Nhân viên: {shipperName}" : "Tổng cần thu";
        ws.Cells[1, 2].Value = isPerShipper ? null : (object)totalAmount;
        if (isPerShipper)
        {
            ws.Cells[2, 1].Value = "Tổng cần thu";
            ws.Cells[2, 2].Value = totalAmount;
            ws.Cells[3, 1].Value = "Tiền mặt thu được";
            ws.Cells[3, 2].Value = cash;
            ws.Cells[4, 1].Value = "Chuyển khoản";
            ws.Cells[4, 2].Value = transfer;
            ws.Cells[5, 1].Value = "Chưa thu được";
            ws.Cells[5, 2].Value = unpaid;
            ws.Cells[6, 1].Value = "Nợ hẹn";
            ws.Cells[6, 2].Value = scheduled;
        }
        else
        {
            ws.Cells[2, 1].Value = "Tiền mặt thu được";
            ws.Cells[2, 2].Value = cash;
            ws.Cells[3, 1].Value = "Chuyển khoản";
            ws.Cells[3, 2].Value = transfer;
            ws.Cells[4, 1].Value = "Chưa thu được";
            ws.Cells[4, 2].Value = unpaid;
            ws.Cells[5, 1].Value = "Nợ hẹn";
            ws.Cells[5, 2].Value = scheduled;
        }

        var headerRow = isPerShipper ? 8 : 7;
        ws.Cells[headerRow, 1].Value = "Nhân viên";
        ws.Cells[headerRow, 2].Value = "Tổng đơn";
        ws.Cells[headerRow, 3].Value = "Tổng cần thu";
        ws.Cells[headerRow, 4].Value = "Tiền mặt";
        ws.Cells[headerRow, 5].Value = "Chuyển khoản";
        ws.Cells[headerRow, 6].Value = "Còn lại";
        ws.Cells[headerRow, 7].Value = "Đang CK";
        ws.Cells[headerRow, 8].Value = "Chưa thu";
        ws.Cells[headerRow, 9].Value = "Nợ hẹn";

        var row = headerRow + 1;
        foreach (var s in rows)
        {
            ws.Cells[row, 1].Value = s.ShipperName;
            ws.Cells[row, 2].Value = s.TotalOrders;
            ws.Cells[row, 3].Value = s.TotalAmount;
            ws.Cells[row, 4].Value = s.CashAmount;
            ws.Cells[row, 5].Value = s.TransferAmount;
            ws.Cells[row, 6].Value = s.TotalAmount - s.CashAmount - s.TransferAmount;
            ws.Cells[row, 7].Value = s.WaitingTransferCount;
            ws.Cells[row, 8].Value = s.UnpaidAmount;
            ws.Cells[row, 9].Value = s.ScheduledAmount;
            row++;
        }

        if (isPerShipper)
        {
            var orders = await GetOrdersOfShipperAsync(date, shipperName!);
            if (orders.Count > 0)
            {
                row += 1;
                ws.Cells[row, 1].Value = "Chi tiết đơn hàng";
                row++;
                ws.Cells[row, 1].Value = "Mã đơn";
                ws.Cells[row, 2].Value = "Khách hàng";
                ws.Cells[row, 3].Value = "Tổng tiền";
                ws.Cells[row, 4].Value = "Đã thu";
                ws.Cells[row, 5].Value = "Trạng thái";
                ws.Cells[row, 6].Value = "Ghi chú";
                row++;
                foreach (var o in orders)
                {
                    ws.Cells[row, 1].Value = o.OrderCode;
                    ws.Cells[row, 2].Value = o.CustomerName;
                    ws.Cells[row, 3].Value = o.Amount;
                    ws.Cells[row, 4].Value = o.AmountPaid;
                    ws.Cells[row, 5].Value = o.Status.ToString();
                    ws.Cells[row, 6].Value = o.ShipperNote ?? o.OriginNote;
                    row++;
                }
            }
        }

        return await package.GetAsByteArrayAsync();
    }

    private async Task<List<Order>> GetOrdersOfShipperAsync(DateTime date, string shipperName)
    {
        var start = DateTime.SpecifyKind(date.Date, DateTimeKind.Utc);
        var end = start.AddDays(1);
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
