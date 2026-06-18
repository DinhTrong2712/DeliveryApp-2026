using DeliveryApp.API.DTOs.Analysis;
using DeliveryApp.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DeliveryApp.API.Controllers;

[ApiController]
[Route("api/ai")]
[Authorize(Roles = "Accountant,Admin,Shipper")]
public class AiController : ControllerBase
{
    private readonly AiChatService _ai;

    public AiController(AiChatService ai) => _ai = ai;

    [HttpPost("chat")]
    public async Task<IActionResult> Chat([FromBody] AiChatRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Question))
            return BadRequest(new { message = "Câu hỏi không được để trống" });

        if (req.Question.Length > 500)
            return BadRequest(new { message = "Câu hỏi quá dài (tối đa 500 ký tự)" });

        var result = await _ai.ChatAsync(req.Question, req.SessionId);
        return Ok(result);
    }

    [HttpPost("analyze-trend")]
    [Authorize(Roles = "Accountant,Admin")]
    public async Task<IActionResult> AnalyzeRevenueTrend([FromBody] DateRangeDto range, [FromQuery] string? sessionId = null)
    {
        if (range.Start >= range.End)
            return BadRequest(new { message = "Ngày bắt đầu phải nhỏ hơn ngày kết thúc" });

        if ((range.End - range.Start).TotalDays > 90)
            return BadRequest(new { message = "Khoảng thời gian tối đa 90 ngày" });

        var result = await _ai.AnalyzeRevenueTrendAsync(range, sessionId);
        return Ok(result);
    }

    [HttpPost("analyze-shipper")]
    [Authorize(Roles = "Accountant,Admin")]
    public async Task<IActionResult> AnalyzeShipperPerformance([FromBody] DateRangeDto range, [FromQuery] string? sessionId = null)
    {
        if (range.Start >= range.End)
            return BadRequest(new { message = "Ngày bắt đầu phải nhỏ hơn ngày kết thúc" });

        if ((range.End - range.Start).TotalDays > 90)
            return BadRequest(new { message = "Khoảng thời gian tối đa 90 ngày" });

        var result = await _ai.AnalyzeShipperPerformanceAsync(range, sessionId);
        return Ok(result);
    }

    [HttpPost("detect-anomalies")]
    [Authorize(Roles = "Accountant,Admin")]
    public async Task<IActionResult> DetectAnomalies([FromQuery] string? sessionId = null)
    {
        var result = await _ai.DetectAnomaliesAsync(sessionId);
        return Ok(result);
    }

    [HttpPost("quick-insights")]
    public async Task<IActionResult> GetQuickInsights([FromQuery] string? sessionId = null)
    {
        var result = await _ai.GetQuickInsightsAsync(sessionId);
        return Ok(result);
    }
}
