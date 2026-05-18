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
}
