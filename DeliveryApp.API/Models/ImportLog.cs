using System.ComponentModel.DataAnnotations;

namespace DeliveryApp.API.Models;

public class ImportLog
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [MaxLength(200)]
    public string? FileName { get; set; }

    public int TotalRows { get; set; }
    public int ImportedRows { get; set; }
    public int SkippedRows { get; set; }
    public int UpdatedRows { get; set; }

    [MaxLength(200)]
    public string? ImportedBy { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Order> Orders { get; set; } = new List<Order>();
}
