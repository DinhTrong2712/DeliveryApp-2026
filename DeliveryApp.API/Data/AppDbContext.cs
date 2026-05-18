using DeliveryApp.API.Models;
using Microsoft.EntityFrameworkCore;

namespace DeliveryApp.API.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderPhoto> OrderPhotos => Set<OrderPhoto>();
    public DbSet<SePayTransaction> SePayTransactions => Set<SePayTransaction>();
    public DbSet<OrderHistory> OrderHistories => Set<OrderHistory>();
    public DbSet<WebhookLog> WebhookLogs => Set<WebhookLog>();
    public DbSet<ImportLog> ImportLogs => Set<ImportLog>();
    public DbSet<SystemConfig> SystemConfigs => Set<SystemConfig>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<Notification> Notifications => Set<Notification>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(e =>
        {
            e.HasIndex(u => u.Username).IsUnique();
            e.Property(u => u.Role).HasConversion<string>();
        });

        modelBuilder.Entity<Order>(e =>
        {
            e.HasIndex(o => o.OrderCode).IsUnique();
            e.Property(o => o.Status).HasConversion<string>();
            e.HasOne(o => o.Shipper).WithMany(u => u.Orders)
                .HasForeignKey(o => o.ShipperId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne(o => o.Import).WithMany(i => i.Orders)
                .HasForeignKey(o => o.ImportId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<SePayTransaction>(e =>
        {
            e.HasIndex(t => t.TransactionCode).IsUnique();
            e.Property(t => t.MatchStatus).HasConversion<string>();
            e.HasOne(t => t.Order).WithMany(o => o.Transactions)
                .HasForeignKey(t => t.OrderId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<SystemConfig>(e =>
        {
            e.HasIndex(s => s.Key).IsUnique();
        });

        modelBuilder.Entity<AuditLog>(e =>
        {
            e.HasIndex(a => a.CreatedAt);
            e.HasIndex(a => a.UserId);
        });

        modelBuilder.Entity<Notification>(e =>
        {
            e.HasIndex(n => new { n.UserId, n.ReadAt });
            e.HasIndex(n => n.CreatedAt);
            e.HasOne(n => n.User).WithMany().HasForeignKey(n => n.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        // Seed admin user
        var adminId = Guid.Parse("00000000-0000-0000-0000-000000000001");
        modelBuilder.Entity<User>().HasData(new User
        {
            Id = adminId,
            Username = "admin",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123"),
            FullName = "Quản trị viên",
            Role = UserRole.Admin,
            IsActive = true,
            CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc)
        });

        modelBuilder.Entity<SystemConfig>().HasData(
            new SystemConfig { Id = Guid.Parse("00000000-0000-0000-0000-000000000010"), Key = "lock_time", Value = "23:59", UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
            new SystemConfig { Id = Guid.Parse("00000000-0000-0000-0000-000000000011"), Key = "sepay_apikey", Value = "", UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
            new SystemConfig { Id = Guid.Parse("00000000-0000-0000-0000-000000000012"), Key = "qr_bank_name", Value = "", UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
            new SystemConfig { Id = Guid.Parse("00000000-0000-0000-0000-000000000013"), Key = "qr_account_number", Value = "", UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
            new SystemConfig { Id = Guid.Parse("00000000-0000-0000-0000-000000000014"), Key = "qr_account_name", Value = "", UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) }
        );
    }
}
