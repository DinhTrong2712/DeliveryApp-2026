using DeliveryApp.API.Data;
using DeliveryApp.API.Hubs;
using DeliveryApp.API.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Configuration;
using Moq;

namespace DeliveryApp.Tests.Helpers;

/// <summary>
/// Centralize mock dependencies cho service tests — tránh lặp setup
/// IHubContext/IConfiguration/AuditService/NotificationService ở mỗi file test.
/// </summary>
internal static class ServiceFactory
{
    public static IHubContext<DeliveryHub> MockHub()
    {
        var hubClients = new Mock<IHubClients>();
        var clientProxy = new Mock<IClientProxy>();
        hubClients.Setup(c => c.Group(It.IsAny<string>())).Returns(clientProxy.Object);
        var hub = new Mock<IHubContext<DeliveryHub>>();
        hub.Setup(h => h.Clients).Returns(hubClients.Object);
        return hub.Object;
    }

    public static IConfiguration Config(Dictionary<string, string?>? entries = null)
    {
        var builder = new ConfigurationBuilder();
        if (entries != null) builder.AddInMemoryCollection(entries);
        return builder.Build();
    }

    public static AuditService Audit(AppDbContext db) =>
        new(db, new Mock<IHttpContextAccessor>().Object);

    public static NotificationService Notifications(AppDbContext db) =>
        new(db, MockHub());

    public static OrderService Order(AppDbContext db, IConfiguration? config = null)
    {
        var hub = MockHub();
        var cfg = config ?? Config(new Dictionary<string, string?> { ["App:LockTime"] = "23:59" });
        return new OrderService(db, hub, cfg, Audit(db), Notifications(db));
    }

    public static SePayService SePay(AppDbContext db, IConfiguration? config = null)
    {
        var hub = MockHub();
        var cfg = config ?? Config(new Dictionary<string, string?> { ["SePay:ApiKey"] = "" });
        return new SePayService(db, hub, cfg, Audit(db), Notifications(db));
    }

    public static ReportService Report(AppDbContext db) => new(db);
}
