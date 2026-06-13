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
            // AppDbContext seed sẵn row sepay_apikey với Value="" — update tại chỗ
            // thay vì Add (InMemory không enforce unique index → tránh tạo 2 row trùng key
            // khiến FirstOrDefault có thể trả về row rỗng).
            var existing = db.SystemConfigs.FirstOrDefault(c => c.Key == "sepay_apikey");
            if (existing != null)
                existing.Value = storedApiKey;
            else
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
    public async Task VerifyWebhook_CorrectKey_ReturnsTrue()
    {
        var svc = CreateService(out _, storedApiKey: "secret-key-123");
        Assert.True(await svc.VerifyWebhookAsync("secret-key-123", null, null, ""));
    }

    [Fact]
    public async Task VerifyWebhook_WrongKey_ReturnsFalse()
    {
        var svc = CreateService(out _, storedApiKey: "secret-key-123");
        Assert.False(await svc.VerifyWebhookAsync("wrong-key", null, null, ""));
    }

    [Fact]
    public async Task VerifyWebhook_EmptyKey_ReturnsFalse()
    {
        var svc = CreateService(out _, storedApiKey: "secret-key-123");
        Assert.False(await svc.VerifyWebhookAsync("", null, null, ""));
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

        // Seed 1 transaction đã tồn tại với TransactionCode = "TX-DUPLICATE".
        var existingTx = new SePayTransaction
        {
            Id = Guid.NewGuid(),
            TransactionCode = "TX-DUPLICATE",
            Amount = 100000,
            Content = "test",
            TransactionDate = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
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
        Assert.Equal(1, db.SePayTransactions.Count()); // không thêm mới
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

    // ── Multi-CK: regression cho fix Partial → continuation summed ────────────

    [Fact]
    public async Task ProcessWebhook_PartialOrder_NextTransfer_SumsToFullPaid()
    {
        var svc = CreateService(out var db);
        // Đơn 500k, đã có 1 CK 200k khớp → đang Partial.
        var order = TestDbHelper.CreateOrder("BHMULTI", 500_000, OrderStatus.Partial);
        order.AmountPaid = 200_000;
        var firstTx = TestDbHelper.CreateTransaction(200_000, "BHMULTI lần 1", MatchStatus.AutoMatched, order.Id);
        firstTx.TransactionCode = "FIRST-200K";
        db.Orders.Add(order);
        db.SePayTransactions.Add(firstTx);
        await db.SaveChangesAsync();

        // Webhook CK lần 2 với mã đơn trùng. Trước fix: bỏ qua vì status != WaitingTransfer.
        var payload = new SePayWebhookPayload
        {
            Id = 1234,
            TransferType = "in",
            TransferAmount = 300_000,
            Content = "Tra tiep BHMULTI",
            ReferenceCode = "SECOND-300K"
        };
        await svc.ProcessWebhookAsync(payload, "{}");

        var updated = await db.Orders.FindAsync(order.Id);
        Assert.Equal(OrderStatus.PaidTransfer, updated!.Status);
        Assert.Equal(500_000, updated.AmountPaid); // 200k + 300k
    }

    [Fact]
    public async Task ProcessWebhook_PartialOrder_StillPartial_AfterPartialFollowup()
    {
        var svc = CreateService(out var db);
        var order = TestDbHelper.CreateOrder("BHFRAG", 1_000_000, OrderStatus.Partial);
        order.AmountPaid = 200_000;
        var firstTx = TestDbHelper.CreateTransaction(200_000, "BHFRAG", MatchStatus.AutoMatched, order.Id);
        firstTx.TransactionCode = "P1";
        db.Orders.Add(order);
        db.SePayTransactions.Add(firstTx);
        await db.SaveChangesAsync();

        var payload = new SePayWebhookPayload
        {
            Id = 5,
            TransferType = "in",
            TransferAmount = 300_000,
            Content = "BHFRAG lan 2",
            ReferenceCode = "P2"
        };
        await svc.ProcessWebhookAsync(payload, "{}");

        var updated = await db.Orders.FindAsync(order.Id);
        Assert.Equal(OrderStatus.Partial, updated!.Status);
        Assert.Equal(500_000, updated.AmountPaid);
    }

    // ── Longest-match: regression cho fix vòng 1 (DG2 ⊂ DG2001) ──────────────

    [Fact]
    public async Task ProcessWebhook_MultipleCandidates_ChoosesLongestOrderCode()
    {
        var svc = CreateService(out var db);
        var shortOrder = TestDbHelper.CreateOrder("DG2", 100_000, OrderStatus.WaitingTransfer);
        var longOrder = TestDbHelper.CreateOrder("DG2001", 200_000, OrderStatus.WaitingTransfer);
        db.Orders.AddRange(shortOrder, longOrder);
        await db.SaveChangesAsync();

        var payload = new SePayWebhookPayload
        {
            Id = 77,
            TransferType = "in",
            TransferAmount = 200_000,
            Content = "Thanh toan DG2001",
            ReferenceCode = "L1"
        };
        await svc.ProcessWebhookAsync(payload, "{}");

        var updatedShort = await db.Orders.FindAsync(shortOrder.Id);
        var updatedLong = await db.Orders.FindAsync(longOrder.Id);
        Assert.Equal(OrderStatus.WaitingTransfer, updatedShort!.Status); // không bị match nhầm
        Assert.Equal(OrderStatus.PaidTransfer, updatedLong!.Status);
    }

    // ── Unassign: regression — recompute từ các CK còn lại ────────────────────

    [Fact]
    public async Task UnassignTransaction_LeavesOtherMatchedTx_RecomputesAmountPaid()
    {
        var svc = CreateService(out var db);
        var order = TestDbHelper.CreateOrder("BHCK", 500_000, OrderStatus.PaidTransfer);
        order.AmountPaid = 500_000;

        var tx1 = TestDbHelper.CreateTransaction(200_000, "BHCK 1", MatchStatus.AutoMatched, order.Id);
        tx1.TransactionCode = "T1";
        var tx2 = TestDbHelper.CreateTransaction(300_000, "BHCK 2", MatchStatus.AutoMatched, order.Id);
        tx2.TransactionCode = "T2";

        db.Orders.Add(order);
        db.SePayTransactions.AddRange(tx1, tx2);
        await db.SaveChangesAsync();

        // Bỏ khớp tx2 (300k) → còn tx1 (200k) → đơn về Partial.
        await svc.UnassignTransactionAsync(tx2.Id, "kt");

        var updated = await db.Orders.FindAsync(order.Id);
        Assert.Equal(OrderStatus.Partial, updated!.Status);
        Assert.Equal(200_000, updated.AmountPaid); // không bị reset về 0
    }

    [Fact]
    public async Task UnassignTransaction_LastMatchedTx_ResetsToWaitingTransfer()
    {
        var svc = CreateService(out var db);
        var order = TestDbHelper.CreateOrder("BHONE", 500_000, OrderStatus.PaidTransfer);
        order.AmountPaid = 500_000;
        var tx = TestDbHelper.CreateTransaction(500_000, "BHONE", MatchStatus.AutoMatched, order.Id);
        tx.TransactionCode = "ONLY";
        db.Orders.Add(order);
        db.SePayTransactions.Add(tx);
        await db.SaveChangesAsync();

        await svc.UnassignTransactionAsync(tx.Id, "kt");

        var updated = await db.Orders.FindAsync(order.Id);
        Assert.Equal(OrderStatus.WaitingTransfer, updated!.Status);
        Assert.Equal(0, updated.AmountPaid);
    }

    // ── AssignTransaction: regression — không gán vào đơn đã PaidCash ────────

    [Fact]
    public async Task AssignTransaction_PaidCashOrder_Rejected()
    {
        var svc = CreateService(out var db);
        var order = TestDbHelper.CreateOrder("BHC", 300_000, OrderStatus.PaidCash);
        order.AmountPaid = 300_000;
        var tx = TestDbHelper.CreateTransaction(300_000, "BHC", MatchStatus.Unmatched);
        db.Orders.Add(order);
        db.SePayTransactions.Add(tx);
        await db.SaveChangesAsync();

        var ok = await svc.AssignTransactionAsync(tx.Id, order.Id, "kt");
        Assert.False(ok);

        var reloadedOrder = await db.Orders.FindAsync(order.Id);
        Assert.Equal(300_000, reloadedOrder!.AmountPaid); // không bị thay đổi
    }

    // ── HMAC verify ───────────────────────────────────────────────────────────

    [Fact]
    public async Task VerifyWebhook_ValidHmacSignature_ReturnsTrue()
    {
        var svc = CreateService(out _, storedApiKey: "hmac-secret");
        var rawBody = "{\"id\":1,\"transferAmount\":1000}";
        var timestamp = "1700000000";

        using var hmac = new System.Security.Cryptography.HMACSHA256(
            System.Text.Encoding.UTF8.GetBytes("hmac-secret"));
        var sig = Convert.ToHexString(
            hmac.ComputeHash(System.Text.Encoding.UTF8.GetBytes($"{timestamp}.{rawBody}")))
            .ToLowerInvariant();

        Assert.True(await svc.VerifyWebhookAsync(null, $"sha256={sig}", timestamp, rawBody));
    }

    [Fact]
    public async Task VerifyWebhook_TamperedBody_ReturnsFalse()
    {
        var svc = CreateService(out _, storedApiKey: "hmac-secret");
        var rawBody = "{\"id\":1}";
        var timestamp = "1700000000";

        using var hmac = new System.Security.Cryptography.HMACSHA256(
            System.Text.Encoding.UTF8.GetBytes("hmac-secret"));
        var sig = Convert.ToHexString(
            hmac.ComputeHash(System.Text.Encoding.UTF8.GetBytes($"{timestamp}.{rawBody}")))
            .ToLowerInvariant();

        // Đổi body sau khi ký → signature không khớp.
        Assert.False(await svc.VerifyWebhookAsync(null, $"sha256={sig}", timestamp, "{\"tampered\":true}"));
    }

    [Fact]
    public async Task ProcessWebhook_ContentMatchesOrderCodeButNotInWaitingState_Skipped()
    {
        var svc = CreateService(out var db);
        var order = TestDbHelper.CreateOrder("BH_DONE", 100_000, OrderStatus.PaidCash);
        order.AmountPaid = 100_000;
        db.Orders.Add(order);
        await db.SaveChangesAsync();

        var payload = new SePayWebhookPayload
        {
            Id = 9,
            TransferType = "in",
            TransferAmount = 100_000,
            Content = "BH_DONE",
            ReferenceCode = "RX"
        };
        await svc.ProcessWebhookAsync(payload, "{}");

        // Order vẫn PaidCash; tx được lưu nhưng Unmatched (đơn không ở trạng thái nhận CK).
        var tx = db.SePayTransactions.Single(t => t.TransactionCode == "RX");
        Assert.Equal(MatchStatus.Unmatched, tx.MatchStatus);
        Assert.Equal(OrderStatus.PaidCash, (await db.Orders.FindAsync(order.Id))!.Status);
    }
}
