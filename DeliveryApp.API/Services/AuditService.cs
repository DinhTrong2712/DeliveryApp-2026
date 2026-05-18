using System.Security.Claims;
using DeliveryApp.API.Data;
using DeliveryApp.API.Models;

namespace DeliveryApp.API.Services;

/// <summary>
/// Helper to write AuditLog entries with caller info pulled from HttpContext.
/// Use <see cref="LogAsync"/> when audit is the only DB write (it commits).
/// Use <see cref="Add"/> inside a service that already calls SaveChanges so the audit
/// row is persisted in the same transaction as the business write.
/// </summary>
public class AuditService
{
    private readonly AppDbContext _db;
    private readonly IHttpContextAccessor _httpCtx;

    public AuditService(AppDbContext db, IHttpContextAccessor httpCtx)
    {
        _db = db;
        _httpCtx = httpCtx;
    }

    public AuditLog Add(string action, string entityType,
        Guid? entityId = null, string? oldValue = null, string? newValue = null,
        string? description = null, string? overrideUsername = null, Guid? overrideUserId = null)
    {
        var (userId, username) = ResolveCaller();
        var entry = new AuditLog
        {
            UserId = overrideUserId ?? userId,
            Username = overrideUsername ?? username,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            OldValue = oldValue,
            NewValue = newValue,
            Description = description,
        };
        _db.AuditLogs.Add(entry);
        return entry;
    }

    public async Task LogAsync(string action, string entityType,
        Guid? entityId = null, string? oldValue = null, string? newValue = null,
        string? description = null, string? overrideUsername = null, Guid? overrideUserId = null)
    {
        Add(action, entityType, entityId, oldValue, newValue, description, overrideUsername, overrideUserId);
        await _db.SaveChangesAsync();
    }

    private (Guid? userId, string? username) ResolveCaller()
    {
        var user = _httpCtx.HttpContext?.User;
        if (user?.Identity?.IsAuthenticated != true) return (null, null);

        Guid? id = Guid.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var g) ? g : null;
        var name = user.FindFirstValue(ClaimTypes.Name);
        return (id, name);
    }
}
