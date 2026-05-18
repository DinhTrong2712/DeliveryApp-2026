using DeliveryApp.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DeliveryApp.API.Controllers;

[ApiController]
[Route("api/reports")]
[Authorize(Roles = "Accountant,Admin")]
public class ReportsController : ControllerBase
{
    private readonly ReportService _report;

    public ReportsController(ReportService report) => _report = report;

    [HttpGet("daily")]
    public async Task<IActionResult> GetDaily([FromQuery] DateTime? date)
    {
        var result = await _report.GetDailyReportAsync(date ?? DateTime.Today);
        return Ok(result);
    }

    [HttpGet("daily/export")]
    public async Task<IActionResult> ExportDaily([FromQuery] DateTime? date, [FromQuery] string? shipper = null)
    {
        var d = date ?? DateTime.Today;
        var bytes = await _report.ExportDailyReportAsync(d, shipper);
        var name = string.IsNullOrWhiteSpace(shipper)
            ? $"baocao_{d:yyyy-MM-dd}.xlsx"
            : $"baocao_{Slug(shipper)}_{d:yyyy-MM-dd}.xlsx";
        return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name);
    }

    private static string Slug(string s) =>
        new string(s.Where(c => char.IsLetterOrDigit(c) || c == '_').ToArray());
}
