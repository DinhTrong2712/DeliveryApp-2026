using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DeliveryApp.API.Models;

public class Order
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(50)]
    public string OrderCode { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? RouteCode { get; set; }

    [Required, MaxLength(300)]
    public string CustomerName { get; set; } = string.Empty;

    [Column(TypeName = "decimal(18,0)")]
    public decimal Amount { get; set; }

    [MaxLength(500)]
    public string? OriginNote { get; set; }

    public Guid? ShipperId { get; set; }
    public User? Shipper { get; set; }

    /// <summary>Tên nhân viên đúng theo file Excel kế toán nhập (giữ nguyên text gốc).</summary>
    [MaxLength(200)]
    public string? ShipperNameXlsx { get; set; }

    public Guid? ImportId { get; set; }
    public ImportLog? Import { get; set; }

    public OrderStatus Status { get; set; } = OrderStatus.Pending;

    [Column(TypeName = "decimal(18,0)")]
    public decimal AmountPaid { get; set; }

    [NotMapped]
    public decimal AmountRemaining => Amount - AmountPaid;

    [MaxLength(500)]
    public string? UnpaidReason { get; set; }

    public DateTime? ScheduledDate { get; set; }
    public DateTime? DeliveredAt { get; set; }

    [MaxLength(1000)]
    public string? ShipperNote { get; set; }

    [MaxLength(1000)]
    public string? AccountantNote { get; set; }

    public DateTime? LockedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<OrderPhoto> Photos { get; set; } = new List<OrderPhoto>();
    public ICollection<OrderHistory> History { get; set; } = new List<OrderHistory>();
    public ICollection<SePayTransaction> Transactions { get; set; } = new List<SePayTransaction>();
}
