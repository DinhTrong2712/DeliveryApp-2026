using System.ComponentModel.DataAnnotations;

namespace DeliveryApp.API.Models;

public class OrderPhoto
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid OrderId { get; set; }
    public Order Order { get; set; } = null!;

    [Required]
    public string Url { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? Caption { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
