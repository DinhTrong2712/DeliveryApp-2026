namespace DeliveryApp.API.DTOs.Analysis;

public record DateRangeDto(DateTime Start, DateTime End);

public record TrendDataPoint(
    DateTime Date,
    decimal Revenue,
    int OrderCount,
    int CollectedCount,
    decimal CollectionRate
);

public record RevenueTrendAnalysis(
    DateRangeDto Range,
    List<TrendDataPoint> DailyData,
    decimal TotalRevenue,
    decimal PreviousRevenue,
    decimal GrowthRate,
    string TrendDirection, // "UP", "DOWN", "STABLE"
    string Summary
);

public record ShipperPerformanceMetric(
    string ShipperName,
    decimal TotalAmount,
    decimal CollectedAmount,
    decimal CollectionRate,
    int TotalOrders,
    int CollectedOrders,
    decimal AverageOrderValue,
    int Rank
);

public record ShipperPerformanceAnalysis(
    DateRangeDto Range,
    List<ShipperPerformanceMetric> Shippers,
    string TopPerformer,
    string NeedsImprovement,
    string Summary
);

public record AnomalyItem(
    string Type, // "HIGH_UNPAID", "LOW_COLLECTION", "UNUSUAL_AMOUNT", "OVERDUE"
    string Description,
    string? EntityName, // shipper name, order code, etc.
    decimal? Value,
    DateTime? DetectedDate,
    string Severity // "LOW", "MEDIUM", "HIGH"
);

public record AnomalyDetectionResult(
    DateTime AnalyzedAt,
    List<AnomalyItem> Anomalies,
    int TotalAnomalies,
    int HighSeverityCount,
    string Summary
);

public record QuickInsight(
    string Type,
    string Message,
    string? ActionText,
    decimal? Value
);

public record QuickInsightsDto(
    DateTime GeneratedAt,
    List<QuickInsight> Insights,
    string TodayHighlight,
    decimal TodayRevenue,
    decimal TodayCollectionRate,
    int UnmatchedTransactions,
    int OverdueCount
);

public record AiAnalysisResponse(
    bool Success,
    string? Analysis,
    string? Error,
    object? Data,
    string SessionId
);
