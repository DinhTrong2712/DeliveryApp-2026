using DeliveryApp.API.Data;
using DeliveryApp.API.Models;
using Microsoft.EntityFrameworkCore;

namespace DeliveryApp.Tests.Helpers;

public static class TestDbHelper
{
    public static AppDbContext CreateInMemoryDb(string dbName = "")
    {
        if (string.IsNullOrEmpty(dbName)) dbName = Guid.NewGuid().ToString();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(dbName)
            .Options;

        var db = new AppDbContext(options);
        db.Database.EnsureCreated();
        return db;
    }

    public static Order CreateOrder(string orderCode = "BH001", decimal amount = 500000,
        OrderStatus status = OrderStatus.WaitingTransfer, Guid? shipperId = null)
    {
        return new Order
        {
            Id = Guid.NewGuid(),
            OrderCode = orderCode,
            CustomerName = "Khách test",
            Amount = amount,
            AmountPaid = 0,
            Status = status,
            ShipperId = shipperId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    public static SePayTransaction CreateTransaction(decimal amount = 500000,
        string content = "CK BH001", MatchStatus matchStatus = MatchStatus.Unmatched, Guid? orderId = null)
    {
        return new SePayTransaction
        {
            Id = Guid.NewGuid(),
            TransactionCode = $"TX{DateTime.UtcNow.Ticks}",
            Amount = amount,
            Content = content,
            Gateway = "MBBank",
            AccountNumber = "123456789",
            TransactionDate = DateTime.UtcNow,
            MatchStatus = matchStatus,
            OrderId = orderId,
            CreatedAt = DateTime.UtcNow
        };
    }
}
