using System.ComponentModel.DataAnnotations;

namespace DeliveryApp.API.Models;

public class OrderHistory
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid OrderId { get; set; }
    public Order Order { get; set; } = null!;

    [MaxLength(100)]
    public string? ChangedBy { get; set; }

    [MaxLength(100)]
    public string? FieldChanged { get; set; }

    [MaxLength(500)]
    public string? OldValue { get; set; }

    [MaxLength(500)]
    public string? NewValue { get; set; }

    [MaxLength(500)]
    public string? Reason { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
