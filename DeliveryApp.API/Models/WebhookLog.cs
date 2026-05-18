namespace DeliveryApp.API.Models;

public class WebhookLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string? RawBody { get; set; }
    public string? Headers { get; set; }
    public string? ResponseCode { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
