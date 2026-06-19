using System.Security.Claims;
using DeliveryApp.API.Data;
using DeliveryApp.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace DeliveryApp.API.Controllers;

[ApiController]
[Route("api/import")]
[Authorize(Roles = "Accountant,Admin")]
public class ImportController : ControllerBase
{
    private readonly ImportService _import;
    private readonly AppDbContext _db;
    private readonly AuditService _audit;
    private readonly IConfiguration _config;

    public ImportController(ImportService import, AppDbContext db, AuditService audit, IConfiguration config)
    {
        _import = import;
        _db = db;
        _audit = audit;
        _config = config;
    }

    private string CallerName => User.FindFirstValue(ClaimTypes.Name) ?? "";

    [HttpPost]
    [RequestSizeLimit(20 * 1024 * 1024)] // 20 MB
    public async Task<IActionResult> Preview(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "Chưa chọn file" });
        if (!file.FileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Chỉ hỗ trợ file .xlsx" });

        using var stream = file.OpenReadStream();
        var result = await _import.ParseXlsxAsync(stream, file.FileName, CallerName);
        return Ok(result);
    }

    [HttpPost("confirm")]
    public async Task<IActionResult> Confirm([FromBody] ConfirmImportRequest req)
    {
        try
        {
            var result = await _import.ConfirmImportAsync(req.ImportId, CallerName, req.Overrides);
            await _audit.LogAsync("IMPORT", "ImportLog",
                description: $"Import Excel: {result.Imported} mới, {result.Updated} cập nhật, {result.Skipped} bỏ qua");
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("logs")]
    public async Task<IActionResult> GetLogs()
    {
        var logs = await _db.ImportLogs
            .OrderByDescending(l => l.CreatedAt)
            .Take(50)
            .ToListAsync();
        return Ok(logs);
    }

    [HttpPost("import-sql")]
    [RequestSizeLimit(100 * 1024 * 1024)] // 100MB
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ImportSql(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "File không được để trống" });

        if (!file.FileName.EndsWith(".sql", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Chỉ chấp nhận file .sql" });

        try
        {
            var connectionString = _config.GetConnectionString("DefaultConnection");
            using var connection = new Npgsql.NpgsqlConnection(connectionString);
            await connection.OpenAsync();

            using var stream = file.OpenReadStream();
            using var reader = new StreamReader(stream);
            var sql = await reader.ReadToEndAsync();

            // Execute COPY commands directly
            var lines = sql.Split('\n');
            var currentCopy = new List<string>();
            var inCopy = false;
            var executed = 0;
            var skipped = 0;
            var errors = new List<string>();

            foreach (var line in lines)
            {
                if (line.StartsWith("COPY public."))
                {
                    inCopy = true;
                    currentCopy.Add(line);
                }
                else if (inCopy && line.Trim() == "\\.")
                {
                    currentCopy.Add(line);
                    inCopy = false;
                    // Execute COPY command
                    try
                    {
                        using var cmd = new Npgsql.NpgsqlCommand(string.Join("\n", currentCopy), connection);
                        cmd.CommandTimeout = 300;
                        await cmd.ExecuteNonQueryAsync();
                        executed++;
                    }
                    catch (Exception ex)
                    {
                        errors.Add($"COPY error: {ex.Message}");
                        skipped++;
                    }
                    currentCopy.Clear();
                }
                else if (inCopy)
                {
                    currentCopy.Add(line);
                }
                else if (!line.StartsWith("--") && !string.IsNullOrWhiteSpace(line))
                {
                    // Skip SET, SELECT (read-only), and setval statements
                    if (line.TrimStart().StartsWith("SET", StringComparison.OrdinalIgnoreCase) ||
                        line.TrimStart().StartsWith("SELECT", StringComparison.OrdinalIgnoreCase) ||
                        line.Contains("setval", StringComparison.OrdinalIgnoreCase))
                        continue;

                    try
                    {
                        using var cmd = new Npgsql.NpgsqlCommand(line, connection);
                        cmd.CommandTimeout = 120;
                        await cmd.ExecuteNonQueryAsync();
                        executed++;
                    }
                    catch (Exception ex)
                    {
                        errors.Add($"SQL error: {ex.Message}");
                        skipped++;
                    }
                }
            }

            await _audit.LogAsync("IMPORT_SQL", "SystemConfig",
                description: $"Import SQL file: {file.FileName}, executed: {executed}, skipped: {skipped}, errors: {errors.Count}");

            return Ok(new { message = "Import hoàn tất", executed, skipped, errors });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }
}

public record ConfirmImportRequest(Guid ImportId, List<ImportOverride>? Overrides);
