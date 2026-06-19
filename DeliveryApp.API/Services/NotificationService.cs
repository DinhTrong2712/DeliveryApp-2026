using DeliveryApp.API.Data;
using DeliveryApp.API.Hubs;
using DeliveryApp.API.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace DeliveryApp.API.Services;

public class NotificationService
{
    private readonly AppDbContext _db;
    private readonly IHubContext<DeliveryHub> _hub;

    public NotificationService(AppDbContext db, IHubContext<DeliveryHub> hub)
    {
        _db = db;
        _hub = hub;
    }

    public async Task<Notification?> CreateAsync(Guid userId, string title, string body, string? link = null, string? type = null)
    {
        // Check if user exists and is active
        var user = await _db.Users.FindAsync(userId);
        if (user == null || !user.IsActive)
            return null;

        var n = new Notification
        {
            UserId = userId,
            Title = title,
            Body = body,
            Link = link,
            Type = type
        };
        _db.Notifications.Add(n);
        await _db.SaveChangesAsync();

        await _hub.Clients.Group($"shipper-{userId}").SendAsync("NotificationCreated", new
        {
            id = n.Id,
            title = n.Title,
            body = n.Body,
            link = n.Link,
            type = n.Type,
            createdAt = n.CreatedAt
        });
        return n;
    }

    public async Task<(IReadOnlyList<Notification> items, int unread)> ListAsync(Guid userId, int take = 20)
    {
        var items = await _db.Notifications
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedAt)
            .Take(take)
            .ToListAsync();
        var unread = await _db.Notifications.CountAsync(n => n.UserId == userId && n.ReadAt == null);
        return (items, unread);
    }

    public async Task<bool> MarkReadAsync(Guid userId, Guid id)
    {
        var n = await _db.Notifications.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (n == null) return false;
        if (n.ReadAt == null)
        {
            n.ReadAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }
        return true;
    }

    public async Task MarkAllReadAsync(Guid userId)
    {
        var now = DateTime.UtcNow;
        await _db.Notifications
            .Where(n => n.UserId == userId && n.ReadAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.ReadAt, now));
    }
}
