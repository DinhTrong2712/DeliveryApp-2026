using DeliveryApp.API.Data;
using DeliveryApp.API.DTOs.Analysis;
using DeliveryApp.API.Models;
using Microsoft.EntityFrameworkCore;

namespace DeliveryApp.API.Services;

public class DataAnalysisService
{
    private readonly AppDbContext _db;
    private static readonly TimeSpan VietnamOffset = TimeSpan.FromHours(7);

    public DataAnalysisService(AppDbContext db)
    {
        _db = db;
    }

    private static (DateTime startUtc, DateTime endUtc) VietnamDayToUtcRange(DateTime date)
    {
        // If date is UtcNow, use it directly. If it's Date-only (Unspecified), treat as Vietnam local.
        DateTime vietnamMidnight;
        if (date.Kind == DateTimeKind.Utc)
        {
            // Convert UTC back to Vietnam midnight, then to UTC
            var vietnamOffset = TimeSpan.FromHours(7);
            var vietnamNow = new DateTimeOffset(date, TimeSpan.Zero).ToOffset(vietnamOffset).DateTime;
            vietnamMidnight = vietnamNow.Date;
        }
        else
        {
            vietnamMidnight = date.Date;
        }
        // Convert to UTC: Vietnam is UTC+7
        var startUtc = DateTime.SpecifyKind(vietnamMidnight.AddHours(-7), DateTimeKind.Utc);
        return (startUtc, startUtc.AddDays(1));
    }

    public async Task<RevenueTrendAnalysis> AnalyzeRevenueTrendAsync(DateRangeDto range)
    {
        // Ensure dates are UTC for PostgreSQL compatibility
        var startUtc = DateTime.SpecifyKind(range.Start, DateTimeKind.Utc);
        var endUtc = DateTime.SpecifyKind(range.End, DateTimeKind.Utc);

        var orders = await _db.Orders
            .Where(o => o.CreatedAt >= startUtc && o.CreatedAt < endUtc)
            .ToListAsync();

        var dailyData = orders
            .GroupBy(o => o.CreatedAt.Date)
            .Select(g => new TrendDataPoint(
                Date: g.Key,
                Revenue: g.Sum(o => o.AmountPaid),
                OrderCount: g.Count(),
                CollectedCount: g.Count(o => o.Status == OrderStatus.PaidCash ||
                                             o.Status == OrderStatus.PaidTransfer ||
                                             o.Status == OrderStatus.Partial),
                CollectionRate: g.Count() > 0
                    ? (g.Count(o => o.Status == OrderStatus.PaidCash ||
                                  o.Status == OrderStatus.PaidTransfer ||
                                  o.Status == OrderStatus.Partial) * 100m / g.Count())
                    : 0m
            ))
            .OrderBy(d => d.Date)
            .ToList();

        var totalRevenue = orders.Sum(o => o.AmountPaid);
        var previousDays = (range.End - range.Start).TotalDays;

        var previousStart = DateTime.SpecifyKind(startUtc.AddDays(-previousDays), DateTimeKind.Utc);
        var previousEnd = startUtc;

        var previousRevenue = await _db.Orders
            .Where(o => o.CreatedAt >= previousStart && o.CreatedAt < previousEnd)
            .SumAsync(o => o.AmountPaid);

        var growthRate = previousRevenue > 0
            ? ((totalRevenue - previousRevenue) / previousRevenue * 100m)
            : 0m;

        var trendDirection = growthRate switch
        {
            > 5 => "UP",
            < -5 => "DOWN",
            _ => "STABLE"
        };

        var summary = BuildTrendSummary(totalRevenue, previousRevenue, growthRate, trendDirection, dailyData);

        return new RevenueTrendAnalysis(
            Range: range,
            DailyData: dailyData,
            TotalRevenue: totalRevenue,
            PreviousRevenue: previousRevenue,
            GrowthRate: growthRate,
            TrendDirection: trendDirection,
            Summary: summary
        );
    }

    private static string BuildTrendSummary(decimal total, decimal previous, decimal growth, string direction, List<TrendDataPoint> dailyData)
    {
        var trendText = direction switch
        {
            "UP" => "đang tăng",
            "DOWN" => "đang giảm",
            _ => "ổn định"
        };

        var peakDay = dailyData.MaxBy(d => d.Revenue);
        var lowDay = dailyData.MinBy(d => d.Revenue);

        return $"Tổng doanh thu kỳ này: {total:N0} đ ({growth:+0.0;-0.0;0}% so với kỳ trước). " +
               $"Xu hướng {trendText}. " +
               (peakDay != null ? $"Ngày cao nhất: {peakDay.Date:dd/MM} ({peakDay.Revenue:N0} đ). " : "") +
               (lowDay != null ? $"Ngày thấp nhất: {lowDay.Date:dd/MM} ({lowDay.Revenue:N0} đ)." : "");
    }

    public async Task<ShipperPerformanceAnalysis> AnalyzeShipperPerformanceAsync(DateRangeDto range)
    {
        // Ensure dates are UTC for PostgreSQL compatibility
        var startUtc = DateTime.SpecifyKind(range.Start, DateTimeKind.Utc);
        var endUtc = DateTime.SpecifyKind(range.End, DateTimeKind.Utc);

        var orders = await _db.Orders
            .Include(o => o.Shipper)
            .Where(o => o.CreatedAt >= startUtc && o.CreatedAt < endUtc && o.ShipperId.HasValue)
            .ToListAsync();

        var metrics = orders
            .GroupBy(o => o.ShipperNameXlsx ?? o.Shipper?.FullName ?? "Chưa phân công")
            .Select(g => new ShipperPerformanceMetric(
                ShipperName: g.Key,
                TotalAmount: g.Sum(o => o.Amount),
                CollectedAmount: g.Sum(o => o.AmountPaid),
                CollectionRate: g.Sum(o => o.Amount) > 0
                    ? (g.Sum(o => o.AmountPaid) / g.Sum(o => o.Amount) * 100m)
                    : 0m,
                TotalOrders: g.Count(),
                CollectedOrders: g.Count(o => o.Status == OrderStatus.PaidCash ||
                                             o.Status == OrderStatus.PaidTransfer ||
                                             o.Status == OrderStatus.Partial),
                AverageOrderValue: g.Count() > 0 ? (g.Sum(o => o.Amount) / g.Count()) : 0m,
                Rank: 0
            ))
            .OrderByDescending(m => m.CollectedAmount)
            .ToList();

        for (int i = 0; i < metrics.Count; i++)
        {
            metrics[i] = metrics[i] with { Rank = i + 1 };
        }

        var topPerformer = metrics.FirstOrDefault();
        var needsImprovement = metrics.LastOrDefault(m => m.TotalOrders >= 5);

        var summary = BuildShipperSummary(metrics, topPerformer, needsImprovement);

        return new ShipperPerformanceAnalysis(
            Range: range,
            Shippers: metrics,
            TopPerformer: topPerformer?.ShipperName ?? "",
            NeedsImprovement: needsImprovement?.ShipperName ?? "",
            Summary: summary
        );
    }

    private static string BuildShipperSummary(
        List<ShipperPerformanceMetric> metrics,
        ShipperPerformanceMetric? top,
        ShipperPerformanceMetric? needsImprovement)
    {
        if (metrics.Count == 0)
            return "Chưa có dữ liệu shipper trong kỳ này.";

        var avgRate = metrics.Average(m => m.CollectionRate);
        var summary = $"Tổng {metrics.Count} shipper. Tỉ lệ thu tiền trung bình: {avgRate:F1}%. ";

        if (top != null)
        {
            summary += $"Hiệu quả nhất: {top.ShipperName} ({top.CollectedAmount:N0} đ, {top.CollectionRate:F1}%). ";
        }

        if (needsImprovement != null)
        {
            summary += $"Cần cải thiện: {needsImprovement.ShipperName} (chỉ thu {needsImprovement.CollectionRate:F1}%). ";
        }

        return summary;
    }

    public async Task<AnomalyDetectionResult> DetectAnomaliesAsync()
    {
        var anomalies = new List<AnomalyItem>();
        var todayUtc = DateTime.UtcNow;
        var (todayStart, todayEnd) = VietnamDayToUtcRange(todayUtc);
        var yesterdayStart = todayStart.AddDays(-1);

        // 1. Phát hiện shipper có tỉ lệ thu tiền thấp bất thường
        var recentOrders = await _db.Orders
            .Include(o => o.Shipper)
            .Where(o => o.CreatedAt >= yesterdayStart && o.CreatedAt < todayEnd && o.ShipperId.HasValue)
            .ToListAsync();

        var shipperStats = recentOrders
            .GroupBy(o => o.ShipperNameXlsx ?? o.Shipper?.FullName ?? "Chưa phân công")
            .Where(g => g.Count() >= 5)
            .Select(g => new
            {
                Shipper = g.Key,
                Rate = g.Count(o => o.Status == OrderStatus.PaidCash ||
                                   o.Status == OrderStatus.PaidTransfer ||
                                   o.Status == OrderStatus.Partial) * 100m / g.Count()
            })
            .ToList();

        foreach (var stat in shipperStats.Where(s => s.Rate < 40m))
        {
            anomalies.Add(new AnomalyItem(
                Type: "LOW_COLLECTION",
                Description: $"Tỉ lệ thu tiền thấp bất thường ({stat.Rate:F1}%)",
                EntityName: stat.Shipper,
                Value: stat.Rate,
                DetectedDate: todayUtc,
                Severity: stat.Rate < 20 ? "HIGH" : "MEDIUM"
            ));
        }

        // 2. Phát hiện đơn nợ quá hạn (trên 3 ngày chưa scheduled)
        var overdueThreshold = todayStart.AddDays(-3);
        var overdueOrders = await _db.Orders
            .Include(o => o.Shipper)
            .Where(o => o.Status == OrderStatus.Unpaid &&
                       o.CreatedAt < overdueThreshold &&
                       o.ShipperId.HasValue)
            .Take(20)
            .ToListAsync();

        foreach (var order in overdueOrders)
        {
            var daysOverdue = (int)(todayUtc - order.CreatedAt).TotalDays;
            anomalies.Add(new AnomalyItem(
                Type: "OVERDUE",
                Description: $"Đơn nợ quá hạn ({daysOverdue} ngày)",
                EntityName: order.OrderCode,
                Value: order.Amount - order.AmountPaid,
                DetectedDate: order.CreatedAt,
                Severity: "MEDIUM"
            ));
        }

        // 3. Phát hiện giao dịch chuyển khoản chưa khớp nhiều (lưu ý nhiều ngày)
        var oldUnmatched = await _db.SePayTransactions
            .Where(t => t.MatchStatus == MatchStatus.Unmatched &&
                       t.CreatedAt < todayStart.AddDays(-2))
            .CountAsync();

        if (oldUnmatched > 5)
        {
            anomalies.Add(new AnomalyItem(
                Type: "UNMATCHED_TRANSACTIONS",
                Description: $"{oldUnmatched} giao dịch chưa khớp quá 2 ngày",
                EntityName: null,
                Value: oldUnmatched,
                DetectedDate: todayUtc.AddDays(-2),
                Severity: oldUnmatched > 20 ? "HIGH" : "MEDIUM"
            ));
        }

        // 4. Phát hiện số tiền bất thường trong SePay
        var unusualTx = await _db.SePayTransactions
            .Where(t => t.MatchStatus == MatchStatus.Unmatched && t.Amount > 5_000_000)
            .ToListAsync();

        foreach (var tx in unusualTx)
        {
            anomalies.Add(new AnomalyItem(
                Type: "UNUSUAL_AMOUNT",
                Description: $"Giao dịch chuyển khoản số tiền lớn chưa khớp",
                EntityName: tx.TransactionCode,
                Value: tx.Amount,
                DetectedDate: tx.TransactionDate,
                Severity: tx.Amount > 10_000_000 ? "HIGH" : "LOW"
            ));
        }

        var summary = anomalies.Count > 0
            ? $"Phát hiện {anomalies.Count} bất thường: {anomalies.Count(a => a.Severity == "HIGH")} nghiêm trọng."
            : "Không phát hiện bất thường đáng lo ngại.";

        return new AnomalyDetectionResult(
            AnalyzedAt: DateTime.UtcNow,
            Anomalies: anomalies.OrderByDescending(a => a.Severity).ToList(),
            TotalAnomalies: anomalies.Count,
            HighSeverityCount: anomalies.Count(a => a.Severity == "HIGH"),
            Summary: summary
        );
    }

    public async Task<QuickInsightsDto> GetQuickInsightsAsync()
    {
        var todayUtc = DateTime.UtcNow;
        var (todayStart, todayEnd) = VietnamDayToUtcRange(todayUtc);
        var weekStart = todayStart.AddDays(-7);

        var insights = new List<QuickInsight>();

        // Today's revenue
        var todayRevenue = await _db.Orders
            .Where(o => o.CreatedAt >= todayStart && o.CreatedAt < todayEnd)
            .SumAsync(o => o.AmountPaid);

        // Today's collection rate
        var todayOrders = await _db.Orders
            .Where(o => o.CreatedAt >= todayStart && o.CreatedAt < todayEnd)
            .ToListAsync();
        var todayRate = todayOrders.Count > 0
            ? (todayOrders.Count(o => o.Status == OrderStatus.PaidCash ||
                                  o.Status == OrderStatus.PaidTransfer ||
                                  o.Status == OrderStatus.Partial) * 100m / todayOrders.Count)
            : 0m;

        // Compare with yesterday
        var yesterdayStart = todayStart.AddDays(-1);
        var yesterdayRevenue = await _db.Orders
            .Where(o => o.CreatedAt >= yesterdayStart && o.CreatedAt < todayStart)
            .SumAsync(o => o.AmountPaid);

        var change = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue * 100m) : 0;

        if (change > 20)
        {
            insights.Add(new QuickInsight(
                Type: "POSITIVE",
                Message: $"Doanh thu hôm nay tăng {change:F0}% so với hôm qua",
                ActionText: "Xem chi tiết xu hướng",
                Value: change
            ));
        }
        else if (change < -20)
        {
            insights.Add(new QuickInsight(
                Type: "NEGATIVE",
                Message: $"Doanh thu hôm nay giảm {Math.Abs(change):F0}% so với hôm qua",
                ActionText: "Kiểm tra đơn pending",
                Value: change
            ));
        }

        // Unmatched transactions
        var unmatchedCount = await _db.SePayTransactions
            .CountAsync(t => t.MatchStatus == MatchStatus.Unmatched);

        if (unmatchedCount > 5)
        {
            insights.Add(new QuickInsight(
                Type: "WARNING",
                Message: $"{unmatchedCount} giao dịch chuyển khoản chưa khớp",
                ActionText: "Xem danh sách",
                Value: unmatchedCount
            ));
        }

        // Overdue orders
        var overdueCount = await _db.Orders
            .CountAsync(o => o.Status == OrderStatus.Unpaid &&
                           o.CreatedAt < todayStart.AddDays(-3));

        if (overdueCount > 0)
        {
            insights.Add(new QuickInsight(
                Type: "WARNING",
                Message: $"{overdueCount} đơn hàng nợ quá hạn",
                ActionText: "Xem danh sách",
                Value: overdueCount
            ));
        }

        // Weekly summary
        var weekRevenue = await _db.Orders
            .Where(o => o.CreatedAt >= weekStart && o.CreatedAt < todayEnd)
            .SumAsync(o => o.AmountPaid);

        insights.Add(new QuickInsight(
            Type: "INFO",
            Message: $"Doanh thu 7 ngày qua: {weekRevenue:N0} đ",
            ActionText: null,
            Value: weekRevenue
        ));

        var todayHighlight = insights.FirstOrDefault(i => i.Type == "POSITIVE")?.Message
            ?? insights.FirstOrDefault(i => i.Type == "WARNING")?.Message
            ?? $"Hôm nay thu được {todayRevenue:N0} đ";

        return new QuickInsightsDto(
            GeneratedAt: DateTime.UtcNow,
            Insights: insights.Take(5).ToList(),
            TodayHighlight: todayHighlight,
            TodayRevenue: todayRevenue,
            TodayCollectionRate: todayRate,
            UnmatchedTransactions: unmatchedCount,
            OverdueCount: overdueCount
        );
    }
}
