using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DeliveryApp.API.Models;

public class SePayTransaction
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>ID giao dịch từ SePay</summary>
    [Required, MaxLength(100)]
    public string TransactionCode { get; set; } = string.Empty;

    [Column(TypeName = "decimal(18,0)")]
    public decimal Amount { get; set; }

    /// <summary>Nội dung chuyển khoản (chứa mã đơn hàng)</summary>
    [MaxLength(500)]
    public string? Content { get; set; }

    /// <summary>Tên ngân hàng / cổng thanh toán</summary>
    [MaxLength(100)]
    public string? Gateway { get; set; }

    [MaxLength(50)]
    public string? AccountNumber { get; set; }

    /// <summary>Mã tham chiếu giao dịch</summary>
    [MaxLength(100)]
    public string? ReferenceCode { get; set; }

    public DateTime TransactionDate { get; set; }

    public string? RawPayload { get; set; }

    public Guid? OrderId { get; set; }
    public Order? Order { get; set; }

    public MatchStatus MatchStatus { get; set; } = MatchStatus.Unmatched;

    [MaxLength(200)]
    public string? MatchedBy { get; set; }

    public DateTime? MatchedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
