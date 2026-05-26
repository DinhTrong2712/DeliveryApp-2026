using DeliveryApp.API.Hubs;
using DeliveryApp.API.Models;
using DeliveryApp.API.Services;
using DeliveryApp.Tests.Helpers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Configuration;
using Moq;

namespace DeliveryApp.Tests.Payment;

public class SePayServiceTests
{
    private static SePayService CreateService(
        out DeliveryApp.API.Data.AppDbContext db,
        string? storedApiKey = null,
        string dbName = "")
    {
        db = TestDbHelper.CreateInMemoryDb(dbName.Length > 0 ? dbName : Guid.NewGuid().ToString());

        if (storedApiKey != null)
        {
            db.SystemConfigs.Add(new SystemConfig { Key = "sepay_apikey", Value = storedApiKey });
            db.SaveChanges();
        }

        var hubClients = new Mock<IHubClients>();
        var clientProxy = new Mock<IClientProxy>();
        hubClients.Setup(c => c.Group(It.IsAny<string>())).Returns(clientProxy.Object);

        var hub = new Mock<IHubContext<DeliveryHub>>();
        hub.Setup(h => h.Clients).Returns(hubClients.Object);

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["SePay:ApiKey"] = "" })
            .Build();

        var httpCtx = new Mock<IHttpContextAccessor>();
        var audit = new AuditService(db, httpCtx.Object);
        var notif = new NotificationService(db, hub.Object);

        return new SePayService(db, hub.Object, config, audit, notif);
    }

    // ── VerifyApiKey ──────────────────────────────────────────────────────────

    [Fact]
    public async Task VerifyApiKey_CorrectKey_ReturnsTrue()
    {
        var svc = CreateService(out _, storedApiKey: "secret-key-123");
        Assert.True(await svc.VerifyApiKeyAsync("secret-key-123"));
    }

    [Fact]
    public async Task VerifyApiKey_WrongKey_ReturnsFalse()
    {
        var svc = CreateService(out _, storedApiKey: "secret-key-123");
        Assert.False(await svc.VerifyApiKeyAsync("wrong-key"));
    }

    [Fact]
    public async Task VerifyApiKey_EmptyKey_ReturnsFalse()
    {
        var svc = CreateService(out _, storedApiKey: "secret-key-123");
        Assert.False(await svc.VerifyApiKeyAsync(""));
    }

    // ── ProcessWebhook - Auto match ───────────────────────────────────────────

    [Fact]
    public async Task ProcessWebhook_AutoMatch_FullAmount_OrderBecomePaidTransfer()
    {
        var svc = CreateService(out var db);
        var order = TestDbHelper.CreateOrder("BH001", 500000, OrderStatus.WaitingTransfer);
        db.Orders.Add(order);
        await db.SaveChangesAsync();

        var payload = new SePayWebhookPayload
        {
            Id = 1,
            TransferType = "in",
            TransferAmount = 500000,
            Content = "Chuyen khoan don hang BH001",
            ReferenceCode = "TX20260506001",
            Gateway = "MBBank",
            AccountNumber = "123456789",
            TransactionDate = "2026-05-06 10:00:00"
        };

        var result = await svc.ProcessWebhookAsync(payload, "{}");

        Assert.Equal("00", result);
        var updated = await db.Orders.FindAsync(order.Id);
        Assert.Equal(OrderStatus.PaidTransfer, updated!.Status);
        Assert.Equal(500000, updated.AmountPaid);
    }

    [Fact]
    public async Task ProcessWebhook_AutoMatch_PartialAmount_OrderBecomePartial()
    {
        var svc = CreateService(out var db);
        var order = TestDbHelper.CreateOrder("BH002", 500000, OrderStatus.WaitingTransfer);
        db.Orders.Add(order);
        await db.SaveChangesAsync();

        var payload = new SePayWebhookPayload
        {
            Id = 2,
            TransferType = "in",
            TransferAmount = 200000,
            Content = "TT BH002",
            ReferenceCode = "TX20260506002",
            Gateway = "VCB",
            AccountNumber = "987654321"
        };

        await svc.ProcessWebhookAsync(payload, "{}");

        var updated = await db.Orders.FindAsync(order.Id);
        Assert.Equal(OrderStatus.Partial, updated!.Status);
        Assert.Equal(200000, updated.AmountPaid);
    }

    [Fact]
    public async Task ProcessWebhook_NoMatchingOrder_TransactionSavedAsUnmatched()
    {
        var svc = CreateService(out var db);
        // Không có đơn nào trạng thái WaitingTransfer

        var payload = new SePayWebhookPayload
        {
            Id = 3,
            TransferType = "in",
            TransferAmount = 300000,
            Content = "Khong co ma don hang",
            ReferenceCode = "TX20260506003",
            Gateway = "Techcombank"
        };

        var result = await svc.ProcessWebhookAsync(payload, "{}");

        Assert.Equal("00", result);
        var tx = db.SePayTransactions.First();
        Assert.Equal(MatchStatus.Unmatched, tx.MatchStatus);
        Assert.Null(tx.OrderId);
    }

    [Fact]
    public async Task ProcessWebhook_MoneyOut_Ignored()
    {
        var svc = CreateService(out var db);

        var payload = new SePayWebhookPayload
        {
            Id = 4,
            TransferType = "out",
            TransferAmount = 100000,
            Content = "Rut tien",
            ReferenceCode = "TX20260506004"
        };

        await svc.ProcessWebhookAsync(payload, "{}");

        Assert.Empty(db.SePayTransactions);
    }

    [Fact]
    public async Task ProcessWebhook_DuplicateTransaction_Skipped()
    {
        var svc = CreateService(out var db);
        db.SePayTransactions.Add(TestDbHelper.CreateTransaction(content: "dup"));
        db.SePayTransactions.First().TransactionCode = "TX-DUP";
        // override the transaction code directly
        var existingTx = new SePayTransaction
        {
            TransactionCode = "TX-DUPLICATE",
            Amount = 100000,
            Content = "test",
            TransactionDate = DateTime.UtcNow
        };
        db.SePayTransactions.Add(existingTx);
        await db.SaveChangesAsync();

        var payload = new SePayWebhookPayload
        {
            Id = 99,
            TransferType = "in",
            TransferAmount = 100000,
            Content = "test dup",
            ReferenceCode = "TX-DUPLICATE"
        };

        var result = await svc.ProcessWebhookAsync(payload, "{}");
        Assert.Equal("02", result);
        Assert.Equal(2, db.SePayTransactions.Count()); // không thêm mới
    }

    // ── AssignTransaction ─────────────────────────────────────────────────────

    [Fact]
    public async Task AssignTransaction_ValidUnmatched_Succeeds()
    {
        var svc = CreateService(out var db);
        var order = TestDbHelper.CreateOrder("BH010", 300000, OrderStatus.WaitingTransfer);
        var tx = TestDbHelper.CreateTransaction(300000, "noi dung khac", MatchStatus.Unmatched);
        db.Orders.Add(order);
        db.SePayTransactions.Add(tx);
        await db.SaveChangesAsync();

        var ok = await svc.AssignTransactionAsync(tx.Id, order.Id, "accountant1");

        Assert.True(ok);
        var updatedTx = await db.SePayTransactions.FindAsync(tx.Id);
        var updatedOrder = await db.Orders.FindAsync(order.Id);
        Assert.Equal(MatchStatus.ManualMatched, updatedTx!.MatchStatus);
        Assert.Equal(OrderStatus.PaidTransfer, updatedOrder!.Status);
    }

    [Fact]
    public async Task AssignTransaction_AlreadyMatched_ReturnsFalse()
    {
        var svc = CreateService(out var db);
        var order = TestDbHelper.CreateOrder("BH011", 300000, OrderStatus.WaitingTransfer);
        var tx = TestDbHelper.CreateTransaction(300000, "test", MatchStatus.AutoMatched, order.Id);
        db.Orders.Add(order);
        db.SePayTransactions.Add(tx);
        await db.SaveChangesAsync();

        var ok = await svc.AssignTransactionAsync(tx.Id, order.Id, "acc");

        Assert.False(ok);
    }

    // ── UnassignTransaction ───────────────────────────────────────────────────

    [Fact]
    public async Task UnassignTransaction_Matched_ResetsToUnmatched()
    {
        var svc = CreateService(out var db);
        var order = TestDbHelper.CreateOrder("BH020", 300000, OrderStatus.PaidTransfer);
        order.AmountPaid = 300000;
        var tx = TestDbHelper.CreateTransaction(300000, "BH020", MatchStatus.ManualMatched, order.Id);
        db.Orders.Add(order);
        db.SePayTransactions.Add(tx);
        await db.SaveChangesAsync();

        var ok = await svc.UnassignTransactionAsync(tx.Id, "accountant1");

        Assert.True(ok);
        var updatedTx = await db.SePayTransactions.FindAsync(tx.Id);
        var updatedOrder = await db.Orders.FindAsync(order.Id);
        Assert.Equal(MatchStatus.Unmatched, updatedTx!.MatchStatus);
        Assert.Null(updatedTx.OrderId);
        Assert.Equal(OrderStatus.WaitingTransfer, updatedOrder!.Status);
        Assert.Equal(0, updatedOrder.AmountPaid);
    }

    [Fact]
    public async Task UnassignTransaction_NotFound_ReturnsFalse()
    {
        var svc = CreateService(out var db);
        var ok = await svc.UnassignTransactionAsync(Guid.NewGuid(), "acc");
        Assert.False(ok);
    }
}
