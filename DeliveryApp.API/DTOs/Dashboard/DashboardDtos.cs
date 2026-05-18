namespace DeliveryApp.API.DTOs.Dashboard;

public record DashboardDto(
    int TotalOrders,
    int PaidFull,
    int WaitingTransfer,
    int Partial,
    int Scheduled,
    int Unpaid,
    int UnmatchedSePay,
    decimal TotalCashToCollect,
    DateTime LastUpdated
);

public record DailyReportDto(
    // Totals
    int TotalOrders,
    decimal TotalAmount,
    // Collected
    decimal Cash,
    decimal Transfer,            // PaidTransfer only
    // Pending / outstanding
    int WaitingTransferCount,    // đơn đang chờ khớp CK
    decimal UnpaidAmount,        // Unpaid + Partial remaining
    decimal ScheduledAmount,     // Scheduled remaining
    // Legacy (kept for Dashboard page)
    decimal Debt,
    List<ShipperReportDto> ByShipper
);

public record ShipperReportDto(
    string ShipperName,
    int TotalOrders,
    decimal TotalAmount,
    decimal CashAmount,
    decimal TransferAmount,      // PaidTransfer only
    int WaitingTransferCount,
    decimal UnpaidAmount,
    decimal ScheduledAmount,
    int UnpaidCount              // kept for legacy
);
