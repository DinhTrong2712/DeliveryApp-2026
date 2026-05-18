using DeliveryApp.API.Models;

namespace DeliveryApp.API.DTOs.Orders;

public record OrderListItem(
    Guid Id,
    string OrderCode,
    string? RouteCode,
    string CustomerName,
    decimal Amount,
    decimal AmountPaid,
    decimal AmountRemaining,
    string Status,
    Guid? ShipperId,
    string? ShipperName,
    DateTime? DeliveredAt,
    DateTime UpdatedAt
);

public record OrderDetailDto(
    Guid Id,
    string OrderCode,
    string? RouteCode,
    string CustomerName,
    decimal Amount,
    decimal AmountPaid,
    decimal AmountRemaining,
    string Status,
    string? UnpaidReason,
    DateTime? ScheduledDate,
    DateTime? DeliveredAt,
    string? ShipperNote,
    string? AccountantNote,
    Guid? ShipperId,
    string? ShipperName,
    DateTime? LockedAt,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    List<PhotoDto> Photos,
    List<HistoryDto> History
);

public record PhotoDto(Guid Id, string Url, string? Caption, DateTime CreatedAt);

public record HistoryDto(
    Guid Id,
    string? ChangedBy,
    string? FieldChanged,
    string? OldValue,
    string? NewValue,
    string? Reason,
    DateTime CreatedAt
);

public record UpdateStatusRequest(
    string Status,
    decimal? AmountPaid,
    string? UnpaidReason,
    DateTime? ScheduledDate,
    string? Note
);

public record UpdateNoteRequest(string Note);

public record AccountantNoteRequest(string Note);

public record OverrideRequest(string Field, string Value, string Reason);

public record PagedResult<T>(List<T> Items, int Total, int Page, int PageSize);
