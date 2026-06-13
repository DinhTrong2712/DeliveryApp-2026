using System.Globalization;
using System.Text.Json;
using DeliveryApp.API.Data;
using DeliveryApp.API.Models;
using Microsoft.EntityFrameworkCore;

namespace DeliveryApp.API.Services;

/// <summary>
/// Sinh dữ liệu vận hành "trông thật" cho 30 ngày gần nhất — phục vụ demo & screenshot.
/// Có thể chạy nhiều lần: idempotent theo OrderCode/TransactionCode (skip nếu đã tồn tại).
/// </summary>
public static class DemoSeeder
{
    private const int DaysOfHistory = 30;
    private const int OrdersPerDay = 100;   // ~3,000 đơn / tháng
    private const int RoutesPerDay = 3;     // ~80–90 route
    private const double AutoMatchRate = 0.91;
    private const double ManualMatchRate = 0.06;
    // (Unmatched = 0.03)
    private const double PaidCashShare = 0.45;
    private const double WaitingTransferShare = 0.30; // sau đó match → PaidTransfer / Partial
    private const double UnpaidShare = 0.08;
    private const double ScheduledShare = 0.07;
    // Pending = 0.10 (đơn chưa giao trong ngày — chuyển sang ngày kế)

    private static readonly TimeSpan VnOffset = TimeSpan.FromHours(7);

    // Tên người Việt cho khách hàng (FMCG bán lẻ — chủ quán, tạp hoá).
    private static readonly string[] CustomerPrefixes = {
        "Cô", "Chú", "Anh", "Chị", "Bà", "Ông", "Em"
    };
    private static readonly string[] CustomerNames = {
        "Lan", "Hoa", "Hương", "Mai", "Linh", "Phương", "Tâm", "Thuý", "Vân",
        "Hùng", "Cường", "Dũng", "Khánh", "Long", "Nam", "Phong", "Quang", "Tuấn", "Việt",
        "Bích", "Diệu", "Hằng", "Hồng", "Huyền", "Ngọc", "Nhung", "Thảo", "Trang"
    };
    private static readonly string[] StoreSuffixes = {
        "— Tạp hoá", "— Quán nước", "— Cửa hàng tổng hợp", "— Siêu thị mini",
        "— Quán cơm", "— Quán cafe", "— Tạp hoá Phố Hương", "— Tạp hoá đầu ngõ",
        "— Cửa hàng VLXD", "— Tiệm hoa quả", "", "", ""
    };
    private static readonly string[] StreetNames = {
        "Phố Hương", "Tân Long", "Lương Ngọc Quyến", "Hoàng Văn Thụ", "Bắc Kạn",
        "Phan Đình Phùng", "Tích Lương", "Quang Trung", "Đồng Quang", "Gia Sàng"
    };

    private static readonly string[] BankNames = {
        "MBBank", "Techcombank", "VCB", "BIDV", "Agribank", "VietinBank", "ACB", "TPBank"
    };

    private static readonly string[] UnpaidReasons = {
        "Khách không có nhà",
        "Khách hẹn quay lại chiều",
        "Khách bảo hết tiền, hẹn mai",
        "Quán đóng cửa, gọi không bắt máy",
        "Sai địa chỉ, không tìm được",
        "Khách báo nhận sai hàng, từ chối",
        "Khách đi vắng cả ngày"
    };

    private static readonly string[] ShipperNotes = {
        "Khách thanh toán đầy đủ", "Giao OK, đóng gói cẩn thận", "Khách dặn lần sau giao sáng",
        "Đã giao đúng giờ hẹn", "Khách hẹn trả tiền cuối tháng", "Giao đợt 1, còn nợ ít",
        "Có hỏi thêm hàng tháng sau", null!, null!, null!, null!
    };

    public static async Task RunAsync(AppDbContext db, ILogger logger, CancellationToken ct = default)
    {
        logger.LogInformation("─── DemoSeeder bắt đầu ───");
        var rng = new Random(42); // seed cố định để demo nhiều lần ra giống nhau

        // 1. Users — 1 admin (đã seed) + 1 KT + 4 shipper.
        var users = await EnsureUsersAsync(db, ct);
        var shippers = users.Where(u => u.Role == UserRole.Shipper).ToList();
        var accountant = users.First(u => u.Role == UserRole.Accountant);
        var admin = await db.Users.FirstAsync(u => u.Role == UserRole.Admin, ct);
        logger.LogInformation("  ✓ {Count} users (1 admin, 1 KT, {Shippers} shipper)", users.Count + 1, shippers.Count);

        var importedOrderCodes = new HashSet<string>(
            await db.Orders.Select(o => o.OrderCode).ToListAsync(ct));
        var existingTxCodes = new HashSet<string>(
            await db.SePayTransactions.Select(t => t.TransactionCode).ToListAsync(ct));

        var today = DateTime.UtcNow.Date;
        var totalOrders = 0;
        var totalCk = 0;
        var totalAudit = 0;

        // 2. Mỗi ngày: 1 import → ~100 đơn → trải đều thao tác trong ngày.
        for (int dayOffset = DaysOfHistory; dayOffset >= 1; dayOffset--)
        {
            var vnDate = today.AddDays(-dayOffset);
            var dayStartUtc = new DateTimeOffset(vnDate, VnOffset).UtcDateTime;
            var importAt = dayStartUtc.AddHours(8).AddMinutes(rng.Next(0, 30)); // KT import 8:00-8:30

            // Bỏ qua nếu ngày này đã có data (idempotent).
            if (await db.ImportLogs.AnyAsync(l => l.CreatedAt >= dayStartUtc && l.CreatedAt < dayStartUtc.AddDays(1), ct))
                continue;

            // 2a. Tạo ImportLog.
            var importLog = new ImportLog
            {
                Id = Guid.NewGuid(),
                FileName = $"don_hang_{vnDate:yyyy-MM-dd}.xlsx",
                TotalRows = OrdersPerDay,
                ImportedRows = OrdersPerDay,
                SkippedRows = 0,
                UpdatedRows = 0,
                ImportedBy = accountant.Username,
                CreatedAt = importAt
            };
            db.ImportLogs.Add(importLog);

            // 2b. Tạo Orders cho ngày này.
            var dayOrders = new List<Order>();
            var routeCodes = Enumerable.Range(1, RoutesPerDay)
                .Select(i => $"R{vnDate:yyMMdd}{i:D2}")
                .ToList();

            for (int i = 0; i < OrdersPerDay; i++)
            {
                var orderCode = $"BH{vnDate:yyMMdd}{i:D3}";
                if (importedOrderCodes.Contains(orderCode)) continue;

                var shipper = shippers[rng.Next(shippers.Count)];
                var amount = NextAmount(rng);
                var routeCode = rng.NextDouble() < 0.6 ? routeCodes[rng.Next(routeCodes.Count)] : null;

                var order = new Order
                {
                    Id = Guid.NewGuid(),
                    OrderCode = orderCode,
                    RouteCode = routeCode,
                    CustomerName = NextCustomerName(rng),
                    Amount = amount,
                    AmountPaid = 0,
                    ShipperId = shipper.Id,
                    ShipperNameXlsx = shipper.XlsxName,
                    ImportId = importLog.Id,
                    OriginNote = rng.NextDouble() < 0.3 ? $"Giao {StreetNames[rng.Next(StreetNames.Length)]}" : null,
                    Status = OrderStatus.Pending,
                    CreatedAt = importAt.AddMinutes(rng.Next(0, 5)),
                    UpdatedAt = importAt
                };
                dayOrders.Add(order);
                importedOrderCodes.Add(orderCode);
            }
            db.Orders.AddRange(dayOrders);

            // AuditLog cho IMPORT.
            db.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                UserId = accountant.Id,
                Username = accountant.Username,
                Action = "IMPORT",
                EntityType = "ImportLog",
                EntityId = importLog.Id,
                Description = $"Import Excel: {dayOrders.Count} mới, 0 cập nhật, 0 bỏ qua",
                CreatedAt = importAt
            });
            totalAudit++;

            // 2c. Mỗi đơn → phân bổ trạng thái + audit + SePay tx.
            foreach (var o in dayOrders)
            {
                var roll = rng.NextDouble();
                var actionTime = dayStartUtc.AddHours(9 + rng.NextDouble() * 9); // 9h-18h VN

                if (roll < PaidCashShare)
                {
                    SetPaidCash(db, o, actionTime, o.Amount);
                    totalAudit++;
                }
                else if (roll < PaidCashShare + WaitingTransferShare)
                {
                    // WaitingTransfer → có 1 SePay CK đến match.
                    SetWaitingTransfer(db, o, actionTime);
                    totalAudit++;

                    // 60% full payment, 30% partial + tiếp tục, 10% còn waiting.
                    var ckRoll = rng.NextDouble();
                    var ckArrive = actionTime.AddMinutes(rng.Next(15, 180));
                    if (ckArrive >= dayStartUtc.AddHours(20)) ckArrive = dayStartUtc.AddHours(19, 30, 0);

                    if (ckRoll < 0.6)
                    {
                        // CK đủ.
                        var amount = o.Amount;
                        var tx = CreateSePayTx(rng, o, amount, ckArrive, existingTxCodes);
                        if (tx != null)
                        {
                            ApplyMatch(db, o, tx, AutoMatchRate, ManualMatchRate, accountant.Username, rng, ckArrive, out var audit);
                            totalAudit += audit;
                            totalCk++;
                        }
                    }
                    else if (ckRoll < 0.9)
                    {
                        // Partial 50-70%.
                        var partAmount = Math.Round(o.Amount * (decimal)(0.5 + rng.NextDouble() * 0.2) / 1000) * 1000;
                        var tx = CreateSePayTx(rng, o, partAmount, ckArrive, existingTxCodes);
                        if (tx != null)
                        {
                            ApplyMatch(db, o, tx, AutoMatchRate, ManualMatchRate, accountant.Username, rng, ckArrive, out var audit);
                            totalAudit += audit;
                            totalCk++;
                        }
                    }
                    // else: còn waiting → đơn vẫn ở WaitingTransfer
                }
                else if (roll < PaidCashShare + WaitingTransferShare + UnpaidShare)
                {
                    SetUnpaid(db, o, actionTime, rng);
                    totalAudit++;
                }
                else if (roll < PaidCashShare + WaitingTransferShare + UnpaidShare + ScheduledShare)
                {
                    SetScheduled(db, o, actionTime, rng);
                    totalAudit++;
                }
                // else: giữ Pending (đơn chưa giao xong)
            }

            // 2d. Một số SePay tx "rác" — chuyển khoản đến mà không match đơn nào (unmatched).
            var unmatchedCount = rng.Next(1, 4);
            for (int k = 0; k < unmatchedCount; k++)
            {
                var amount = NextAmount(rng);
                var ckAt = dayStartUtc.AddHours(10 + rng.NextDouble() * 8);
                var txCode = $"TX-NOISE-{vnDate:yyMMdd}-{k:D2}";
                if (existingTxCodes.Contains(txCode)) continue;
                db.SePayTransactions.Add(new SePayTransaction
                {
                    Id = Guid.NewGuid(),
                    TransactionCode = txCode,
                    Amount = amount,
                    Content = "Chuyen tien sai noi dung",
                    Gateway = BankNames[rng.Next(BankNames.Length)],
                    AccountNumber = "1019283746",
                    TransactionDate = ckAt,
                    MatchStatus = MatchStatus.Unmatched,
                    RawPayload = "{}",
                    CreatedAt = ckAt
                });
                existingTxCodes.Add(txCode);
                totalCk++;
            }

            totalOrders += dayOrders.Count;
            await db.SaveChangesAsync(ct);
            logger.LogInformation("  • {Date}: {Orders} đơn, {Audits} thao tác tích luỹ",
                vnDate.ToString("dd/MM/yyyy"), dayOrders.Count, totalAudit);
        }

        logger.LogInformation("─── Hoàn tất ───");
        logger.LogInformation("  Tổng: {Orders} đơn, {Ck} SePay tx, {Audit} audit logs",
            totalOrders, totalCk, totalAudit);
    }

    // ── Status setters ────────────────────────────────────────────────────────

    private static void SetPaidCash(AppDbContext db, Order o, DateTime at, decimal paid)
    {
        var old = o.Status.ToString();
        o.Status = OrderStatus.PaidCash;
        o.AmountPaid = paid;
        o.DeliveredAt = at;
        o.UpdatedAt = at;
        db.OrderHistories.Add(new OrderHistory
        {
            OrderId = o.Id, ChangedBy = "shipper", FieldChanged = "Status",
            OldValue = old, NewValue = "PaidCash", CreatedAt = at
        });
        db.AuditLogs.Add(new AuditLog
        {
            UserId = o.ShipperId, Username = $"shipper-{o.ShipperId?.ToString()[..6]}",
            Action = "COLLECT_CASH", EntityType = "Order", EntityId = o.Id,
            OldValue = old, NewValue = "PaidCash",
            Description = $"{o.OrderCode}: {old} → PaidCash", CreatedAt = at
        });
    }

    private static void SetWaitingTransfer(AppDbContext db, Order o, DateTime at)
    {
        var old = o.Status.ToString();
        o.Status = OrderStatus.WaitingTransfer;
        o.UpdatedAt = at;
        db.OrderHistories.Add(new OrderHistory
        {
            OrderId = o.Id, ChangedBy = "shipper", FieldChanged = "Status",
            OldValue = old, NewValue = "WaitingTransfer", CreatedAt = at
        });
        db.AuditLogs.Add(new AuditLog
        {
            UserId = o.ShipperId, Username = $"shipper-{o.ShipperId?.ToString()[..6]}",
            Action = "UPDATE_STATUS", EntityType = "Order", EntityId = o.Id,
            OldValue = old, NewValue = "WaitingTransfer", CreatedAt = at
        });
    }

    private static void SetUnpaid(AppDbContext db, Order o, DateTime at, Random rng)
    {
        var old = o.Status.ToString();
        o.Status = OrderStatus.Unpaid;
        o.UnpaidReason = UnpaidReasons[rng.Next(UnpaidReasons.Length)];
        o.UpdatedAt = at;
        db.OrderHistories.Add(new OrderHistory
        {
            OrderId = o.Id, ChangedBy = "shipper", FieldChanged = "Status",
            OldValue = old, NewValue = "Unpaid", Reason = o.UnpaidReason, CreatedAt = at
        });
        db.AuditLogs.Add(new AuditLog
        {
            UserId = o.ShipperId, Username = $"shipper-{o.ShipperId?.ToString()[..6]}",
            Action = "UPDATE_STATUS", EntityType = "Order", EntityId = o.Id,
            OldValue = old, NewValue = "Unpaid",
            Description = $"{o.OrderCode}: lý do {o.UnpaidReason}", CreatedAt = at
        });
    }

    private static void SetScheduled(AppDbContext db, Order o, DateTime at, Random rng)
    {
        var old = o.Status.ToString();
        o.Status = OrderStatus.Scheduled;
        o.ScheduledDate = at.AddDays(rng.Next(1, 4));
        o.UpdatedAt = at;
        db.OrderHistories.Add(new OrderHistory
        {
            OrderId = o.Id, ChangedBy = "shipper", FieldChanged = "Status",
            OldValue = old, NewValue = "Scheduled", CreatedAt = at
        });
        db.AuditLogs.Add(new AuditLog
        {
            UserId = o.ShipperId, Username = $"shipper-{o.ShipperId?.ToString()[..6]}",
            Action = "UPDATE_STATUS", EntityType = "Order", EntityId = o.Id,
            OldValue = old, NewValue = "Scheduled", CreatedAt = at
        });
    }

    // ── SePay ─────────────────────────────────────────────────────────────────

    private static SePayTransaction? CreateSePayTx(Random rng, Order o, decimal amount, DateTime at, HashSet<string> existing)
    {
        var code = $"FT{at:yyyyMMddHHmmss}{rng.Next(100, 999)}";
        if (existing.Contains(code)) return null;
        existing.Add(code);

        return new SePayTransaction
        {
            Id = Guid.NewGuid(),
            TransactionCode = code,
            Amount = amount,
            Content = $"Thanh toan don hang {o.OrderCode}",
            Gateway = BankNames[rng.Next(BankNames.Length)],
            AccountNumber = "1019283746",
            TransactionDate = at,
            ReferenceCode = code,
            RawPayload = JsonSerializer.Serialize(new
            {
                id = rng.Next(1000000, 9999999),
                transferType = "in",
                transferAmount = amount,
                content = $"Thanh toan don hang {o.OrderCode}"
            }),
            CreatedAt = at
        };
    }

    private static void ApplyMatch(AppDbContext db, Order o, SePayTransaction tx,
        double autoRate, double manualRate, string accountantUsername, Random rng, DateTime at, out int auditCount)
    {
        auditCount = 0;
        var roll = rng.NextDouble();
        bool isAuto = roll < autoRate;
        bool isManual = !isAuto && roll < autoRate + manualRate;

        if (!isAuto && !isManual)
        {
            // Unmatched: tx vẫn lưu nhưng không liên kết đơn.
            tx.MatchStatus = MatchStatus.Unmatched;
            db.SePayTransactions.Add(tx);
            return;
        }

        tx.OrderId = o.Id;
        tx.MatchStatus = isAuto ? MatchStatus.AutoMatched : MatchStatus.ManualMatched;
        tx.MatchedBy = isAuto ? "sepay-webhook" : accountantUsername;
        tx.MatchedAt = isAuto ? at.AddSeconds(rng.Next(2, 8)) : at.AddMinutes(rng.Next(5, 120));
        db.SePayTransactions.Add(tx);

        // Cập nhật trạng thái đơn.
        var oldStatus = o.Status.ToString();
        if (tx.Amount >= o.Amount)
        {
            o.Status = OrderStatus.PaidTransfer;
            o.AmountPaid = o.Amount;
        }
        else
        {
            o.Status = OrderStatus.Partial;
            o.AmountPaid = tx.Amount;
        }
        o.UpdatedAt = tx.MatchedAt.Value;

        db.OrderHistories.Add(new OrderHistory
        {
            OrderId = o.Id, ChangedBy = tx.MatchedBy, FieldChanged = "Status",
            OldValue = oldStatus, NewValue = o.Status.ToString(),
            Reason = isAuto ? $"SePay auto-match: {tx.TransactionCode}" : $"Manual match: {tx.TransactionCode}",
            CreatedAt = tx.MatchedAt.Value
        });

        db.AuditLogs.Add(new AuditLog
        {
            UserId = isAuto ? null : (Guid?)null,
            Username = tx.MatchedBy,
            Action = isAuto ? "AUTO_MATCH" : "MANUAL_MATCH",
            EntityType = "SePayTransaction",
            EntityId = tx.Id,
            NewValue = o.OrderCode,
            Description = $"Khớp {tx.TransactionCode} → {o.OrderCode} ({tx.Amount:N0}đ)",
            CreatedAt = tx.MatchedAt.Value
        });
        auditCount = 1;
    }

    // ── Users ─────────────────────────────────────────────────────────────────

    private static async Task<List<User>> EnsureUsersAsync(AppDbContext db, CancellationToken ct)
    {
        var preset = new[]
        {
            ("ketoan",   "ketoan123", "Nguyễn Thị Lan",  UserRole.Accountant, (string?)null),
            ("manh",     "shipper123", "Trần Văn Mạnh",   UserRole.Shipper,    "Kho - Mạnh giao hàng"),
            ("truong",   "shipper123", "Lê Văn Trường",   UserRole.Shipper,    "Kho - Trường giao hàng"),
            ("hung",     "shipper123", "Phạm Văn Hùng",   UserRole.Shipper,    "Kho - Hùng giao hàng"),
            ("hieu",     "shipper123", "Nguyễn Văn Hiệu", UserRole.Shipper,    "Kho - Hiệu giao hàng"),
        };

        var created = new List<User>();
        foreach (var (username, password, fullName, role, xlsxName) in preset)
        {
            var existing = await db.Users.FirstOrDefaultAsync(u => u.Username == username, ct);
            if (existing != null)
            {
                created.Add(existing);
                continue;
            }
            var u = new User
            {
                Id = Guid.NewGuid(),
                Username = username,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
                FullName = fullName,
                Role = role,
                XlsxName = xlsxName,
                IsActive = true,
                CreatedAt = DateTime.UtcNow.AddDays(-DaysOfHistory - 5),
                UpdatedAt = DateTime.UtcNow.AddDays(-DaysOfHistory - 5)
            };
            db.Users.Add(u);
            created.Add(u);
        }
        await db.SaveChangesAsync(ct);
        return created;
    }

    // ── Random data ──────────────────────────────────────────────────────────

    /// <summary>Số tiền đơn FMCG: 80% trong 100k-800k, 15% 800k-2M, 5% 2M-5M.</summary>
    private static decimal NextAmount(Random rng)
    {
        var roll = rng.NextDouble();
        decimal amount = roll < 0.8 ? rng.Next(100, 800) * 1000
                       : roll < 0.95 ? rng.Next(800, 2000) * 1000
                       : rng.Next(2000, 5000) * 1000;
        // Làm tròn 1k.
        return amount;
    }

    private static string NextCustomerName(Random rng)
    {
        var prefix = CustomerPrefixes[rng.Next(CustomerPrefixes.Length)];
        var name = CustomerNames[rng.Next(CustomerNames.Length)];
        var suffix = StoreSuffixes[rng.Next(StoreSuffixes.Length)];
        return $"{prefix} {name} {suffix}".Trim();
    }
}

// Workaround: DateTime constructor with hour, minute, second.
internal static class DateTimeOffsetExtensions
{
    public static DateTime AddHours(this DateTime dt, int hours, int minutes, int seconds)
        => dt.AddHours(hours).AddMinutes(minutes).AddSeconds(seconds);
}
