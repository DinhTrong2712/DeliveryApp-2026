using System.Diagnostics;
using System.IO.Compression;

namespace DeliveryApp.API.Services;

public record BackupFileInfo(string Name, long Size, DateTime CreatedAt);

public class BackupService
{
    private readonly IConfiguration _config;
    private readonly ILogger<BackupService> _logger;

    public BackupService(IConfiguration config, ILogger<BackupService> logger)
    {
        _config = config;
        _logger = logger;
    }

    public string BackupDirectory
    {
        get
        {
            var dir = _config["Backup:Directory"];
            if (string.IsNullOrWhiteSpace(dir))
                dir = Path.Combine(AppContext.BaseDirectory, "backups");
            Directory.CreateDirectory(dir);
            return dir;
        }
    }

    public int RetentionCount =>
        int.TryParse(_config["Backup:Retention"], out var n) && n > 0 ? n : 14;

    public IReadOnlyList<BackupFileInfo> ListBackups()
    {
        var dir = BackupDirectory;
        return new DirectoryInfo(dir)
            .EnumerateFiles("*.sql.gz")
            .Concat(new DirectoryInfo(dir).EnumerateFiles("*.sql"))
            .OrderByDescending(f => f.CreationTimeUtc)
            .Select(f => new BackupFileInfo(f.Name, f.Length, f.CreationTime))
            .ToList();
    }

    public async Task<string> CreateBackupAsync(string? label = null, CancellationToken ct = default)
    {
        var (host, port, db, user, pass) = ReadDbInfo();
        var pgDump = FindPgTool("pg_dump")
            ?? throw new InvalidOperationException("Không tìm thấy pg_dump. Đảm bảo PostgreSQL đã được cài đặt.");

        var suffix = string.IsNullOrWhiteSpace(label) ? "" : $"_{Sanitize(label)}";
        var fileName = $"backup_{DateTime.Now:yyyyMMdd_HHmmss}{suffix}.sql.gz";
        var fullPath = Path.Combine(BackupDirectory, fileName);
        var tempSql = Path.Combine(Path.GetTempPath(), $"backup_{Guid.NewGuid()}.sql");

        var psi = new ProcessStartInfo
        {
            FileName = pgDump,
            Arguments = $"-h {host} -p {port} -U {user} -d {db} -f \"{tempSql}\"",
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            Environment = { ["PGPASSWORD"] = pass }
        };

        try
        {
            using var proc = Process.Start(psi)!;
            var stderr = await proc.StandardError.ReadToEndAsync(ct);
            await proc.WaitForExitAsync(ct);
            if (proc.ExitCode != 0 || !File.Exists(tempSql))
                throw new InvalidOperationException($"pg_dump thất bại: {stderr}");

            await using (var src = File.OpenRead(tempSql))
            await using (var dst = File.Create(fullPath))
            await using (var gz = new GZipStream(dst, CompressionLevel.Optimal))
                await src.CopyToAsync(gz, ct);

            ApplyRetention();
            _logger.LogInformation("Backup created: {File} ({Size} bytes)", fileName, new FileInfo(fullPath).Length);
            return fileName;
        }
        finally
        {
            if (File.Exists(tempSql)) File.Delete(tempSql);
        }
    }

    public async Task RestoreFromFileAsync(string sourcePath, bool isCompressed, CancellationToken ct = default)
    {
        var (host, port, db, user, pass) = ReadDbInfo();
        var psql = FindPgTool("psql")
            ?? throw new InvalidOperationException("Không tìm thấy psql.");

        var tempSql = Path.Combine(Path.GetTempPath(), $"restore_{Guid.NewGuid()}.sql");
        try
        {
            if (isCompressed)
            {
                await using var src = File.OpenRead(sourcePath);
                await using var gz = new GZipStream(src, CompressionMode.Decompress);
                await using var dst = File.Create(tempSql);
                await gz.CopyToAsync(dst, ct);
            }
            else
            {
                File.Copy(sourcePath, tempSql, true);
            }

            var psi = new ProcessStartInfo
            {
                FileName = psql,
                Arguments = $"-h {host} -p {port} -U {user} -d {db} -f \"{tempSql}\"",
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
                Environment = { ["PGPASSWORD"] = pass }
            };
            using var proc = Process.Start(psi)!;
            var stderr = await proc.StandardError.ReadToEndAsync(ct);
            await proc.WaitForExitAsync(ct);
            if (proc.ExitCode != 0)
                throw new InvalidOperationException($"Khôi phục thất bại: {stderr}");
        }
        finally
        {
            if (File.Exists(tempSql)) File.Delete(tempSql);
        }
    }

    public async Task RestoreFromServerAsync(string fileName, CancellationToken ct = default)
    {
        var path = ResolveBackupPath(fileName);
        await RestoreFromFileAsync(path, fileName.EndsWith(".gz", StringComparison.OrdinalIgnoreCase), ct);
    }

    public string ResolveBackupPath(string fileName)
    {
        if (fileName.Contains('/') || fileName.Contains('\\') || fileName.Contains(".."))
            throw new ArgumentException("Tên file không hợp lệ.");
        var full = Path.Combine(BackupDirectory, fileName);
        if (!File.Exists(full)) throw new FileNotFoundException("Không tìm thấy file backup.", fileName);
        return full;
    }

    public void Delete(string fileName)
    {
        var path = ResolveBackupPath(fileName);
        File.Delete(path);
    }

    private void ApplyRetention()
    {
        var keep = RetentionCount;
        var auto = new DirectoryInfo(BackupDirectory)
            .EnumerateFiles("backup_*.sql.gz")
            .OrderByDescending(f => f.CreationTimeUtc)
            .ToList();
        foreach (var old in auto.Skip(keep))
        {
            try { old.Delete(); }
            catch (Exception ex) { _logger.LogWarning(ex, "Không xóa được backup cũ {File}", old.Name); }
        }
    }

    private (string host, string port, string db, string user, string pass) ReadDbInfo()
    {
        var connStr = _config.GetConnectionString("DefaultConnection") ?? "";
        return (
            ExtractPg(connStr, "Host") ?? "localhost",
            ExtractPg(connStr, "Port") ?? "5432",
            ExtractPg(connStr, "Database") ?? "delivery_db",
            ExtractPg(connStr, "Username") ?? "postgres",
            ExtractPg(connStr, "Password") ?? ""
        );
    }

    private static string? ExtractPg(string connStr, string key)
    {
        foreach (var part in connStr.Split(';'))
        {
            var kv = part.Split('=', 2);
            if (kv.Length == 2 && kv[0].Trim().Equals(key, StringComparison.OrdinalIgnoreCase))
                return kv[1].Trim();
        }
        return null;
    }

    private static string? FindPgTool(string tool)
    {
        if (IsInPath(tool)) return tool;

        foreach (var root in new[] { @"C:\Program Files\PostgreSQL", @"C:\Program Files (x86)\PostgreSQL" })
        {
            if (!Directory.Exists(root)) continue;
            var candidates = Directory.EnumerateDirectories(root)
                .Select(d => Path.Combine(d, "bin", $"{tool}.exe"))
                .Where(File.Exists)
                .OrderByDescending(p => p, StringComparer.OrdinalIgnoreCase);
            var first = candidates.FirstOrDefault();
            if (first != null) return first;
        }
        return null;
    }

    private static bool IsInPath(string tool)
    {
        try
        {
            var p = Process.Start(new ProcessStartInfo
            {
                FileName = tool,
                Arguments = "--version",
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true
            });
            p?.WaitForExit(2000);
            return p?.ExitCode == 0;
        }
        catch { return false; }
    }

    private static string Sanitize(string s)
    {
        var safe = new string(s.Select(c => char.IsLetterOrDigit(c) ? c : '_').ToArray());
        return safe.Length > 40 ? safe[..40] : safe;
    }
}
