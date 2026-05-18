namespace DeliveryApp.API.Services;

public class BackupScheduler : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly IConfiguration _config;
    private readonly ILogger<BackupScheduler> _logger;

    public BackupScheduler(IServiceProvider services, IConfiguration config, ILogger<BackupScheduler> logger)
    {
        _services = services;
        _config = config;
        _logger = logger;
    }

    private bool Enabled => !bool.TryParse(_config["Backup:AutoEnabled"], out var b) || b;

    private TimeSpan TimeOfDay
    {
        get
        {
            var raw = _config["Backup:Time"] ?? "02:00";
            return TimeSpan.TryParse(raw, out var t) ? t : new TimeSpan(2, 0, 0);
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!Enabled)
        {
            _logger.LogInformation("BackupScheduler disabled via Backup:AutoEnabled");
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            var delay = NextRunDelay();
            _logger.LogInformation("Next auto backup in {Delay}", delay);
            try { await Task.Delay(delay, stoppingToken); }
            catch (TaskCanceledException) { return; }

            try
            {
                using var scope = _services.CreateScope();
                var backup = scope.ServiceProvider.GetRequiredService<BackupService>();
                var file = await backup.CreateBackupAsync("auto", stoppingToken);
                _logger.LogInformation("Auto backup created: {File}", file);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Auto backup failed");
            }
        }
    }

    private TimeSpan NextRunDelay()
    {
        var now = DateTime.Now;
        var target = now.Date.Add(TimeOfDay);
        if (target <= now) target = target.AddDays(1);
        return target - now;
    }
}
