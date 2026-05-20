using System.Security.Claims;
using DeliveryApp.API.Data;
using DeliveryApp.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DeliveryApp.API.Controllers;

[ApiController]
[Route("api/import")]
[Authorize(Roles = "Accountant,Admin")]
public class ImportController : ControllerBase
{
    private readonly ImportService _import;
    private readonly AppDbContext _db;
    private readonly AuditService _audit;

    public ImportController(ImportService import, AppDbContext db, AuditService audit)
    {
        _import = import;
        _db = db;
        _audit = audit;
    }

    private string CallerName => User.FindFirstValue(ClaimTypes.Name) ?? "";

    [HttpPost]
    public async Task<IActionResult> Preview(IFormFile file)
    {
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
}

public record ConfirmImportRequest(Guid ImportId, List<ImportOverride>? Overrides);
