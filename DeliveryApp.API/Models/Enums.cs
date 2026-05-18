namespace DeliveryApp.API.Models;

public enum UserRole
{
    Admin,
    Accountant,
    Shipper
}

public enum OrderStatus
{
    Unassigned,
    Pending,
    WaitingTransfer,
    PaidCash,
    PaidTransfer,
    Partial,
    Scheduled,
    Unpaid
}

public enum MatchStatus
{
    Unmatched,
    AutoMatched,
    ManualMatched
}

