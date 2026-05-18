using System.ComponentModel.DataAnnotations;

namespace DeliveryApp.API.Models;

public class SystemConfig
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(100)]
    public string Key { get; set; } = string.Empty;

    public string? Value { get; set; }

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
