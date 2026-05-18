using DeliveryApp.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DeliveryApp.API.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize(Roles = "Accountant,Admin")]
public class DashboardController : ControllerBase
{
    private readonly ReportService _report;

    public DashboardController(ReportService report) => _report = report;

    [HttpGet]
    public async Task<IActionResult> GetDashboard()
    {
        var result = await _report.GetDashboardAsync();
        return Ok(result);
    }
}
