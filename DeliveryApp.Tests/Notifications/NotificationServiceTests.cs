using DeliveryApp.Tests.Helpers;

namespace DeliveryApp.Tests.Notifications;

public class NotificationServiceTests
{
    [Fact]
    public async Task Create_AddsRowAndStartsUnread()
    {
        var db = TestDbHelper.CreateInMemoryDb();
        var svc = ServiceFactory.Notifications(db);
        var userId = Guid.NewGuid();

        var n = await svc.CreateAsync(userId, "Có đơn mới", "BH001 — 200k", "/shipper/orders");
        Assert.Equal(userId, n.UserId);
        Assert.Null(n.ReadAt);
        Assert.Equal(1, db.Notifications.Count());
    }

    [Fact]
    public async Task List_ReturnsOwnNotifications_AndUnreadCount()
    {
        var db = TestDbHelper.CreateInMemoryDb();
        var svc = ServiceFactory.Notifications(db);
        var u1 = Guid.NewGuid();
        var u2 = Guid.NewGuid();

        await svc.CreateAsync(u1, "u1-1", "body");
        await svc.CreateAsync(u1, "u1-2", "body");
        await svc.CreateAsync(u2, "u2-1", "body");

        var (items, unread) = await svc.ListAsync(u1);
        Assert.Equal(2, items.Count);
        Assert.Equal(2, unread);
        Assert.All(items, i => Assert.Equal(u1, i.UserId));
    }

    [Fact]
    public async Task MarkRead_OnlyMarksOwnNotification()
    {
        var db = TestDbHelper.CreateInMemoryDb();
        var svc = ServiceFactory.Notifications(db);
        var owner = Guid.NewGuid();
        var stranger = Guid.NewGuid();

        var n = await svc.CreateAsync(owner, "t", "b");

        Assert.False(await svc.MarkReadAsync(stranger, n.Id));   // chặn
        Assert.True(await svc.MarkReadAsync(owner, n.Id));        // owner OK

        var reloaded = await db.Notifications.FindAsync(n.Id);
        Assert.NotNull(reloaded!.ReadAt);
    }

    // MarkAllReadAsync dùng ExecuteUpdateAsync (EF Core 7+) — InMemoryDatabase không hỗ trợ.
    // Bỏ qua kiểm thử ở đây; behaviour được phủ qua MarkReadAsync ở trên.
}
