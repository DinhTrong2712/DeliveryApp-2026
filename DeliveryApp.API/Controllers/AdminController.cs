using System.Security.Claims;
using System.Text;
using System.Text.Json;
using DeliveryApp.API.Data;
using DeliveryApp.API.DTOs.Admin;
using DeliveryApp.API.Models;
using DeliveryApp.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DeliveryApp.API.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _http;
    private readonly AuditService _audit;
    private readonly BackupService _backup;

    public AdminController(AppDbContext db, IConfiguration config, IHttpClientFactory http, AuditService audit, BackupService backup)
    {
        _db = db;
        _config = config;
        _http = http;
        _audit = audit;
        _backup = backup;
    }

    [HttpGet("users")]
    public async Task<IActionResult> GetUsers()
    {
        var users = await _db.Users
            .OrderBy(u => u.FullName)
            .Select(u => new UserListItem(u.Id, u.Username, u.FullName, u.Role.ToString(), u.XlsxName, u.IsActive, u.CreatedAt))
            .ToListAsync();
        return Ok(users);
    }

    [HttpPost("users")]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest req)
    {
        if (await _db.Users.AnyAsync(u => u.Username == req.Username))
            return Conflict(new { message = "Tên đăng nhập đã tồn tại" });

        if (!Enum.TryParse<UserRole>(req.Role, out var role))
            return BadRequest(new { message = "Vai trò không hợp lệ" });

        var user = new User
        {
            Username = req.Username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            FullName = req.FullName,
            Role = role,
            XlsxName = req.XlsxName
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        return Ok(new UserListItem(user.Id, user.Username, user.FullName, user.Role.ToString(), user.XlsxName, user.IsActive, user.CreatedAt));
    }

    [HttpPut("users/{id:guid}")]
    public async Task<IActionResult> UpdateUser(Guid id, [FromBody] UpdateUserRequest req)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound();

        if (!Enum.TryParse<UserRole>(req.Role, out var role))
            return BadRequest(new { message = "Vai trò không hợp lệ" });

        // Chống admin tự hạ vai trò → mất quyền truy cập sau lần lưu này.
        var callerId = Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var cid) ? cid : Guid.Empty;
        if (user.Id == callerId && user.Role == UserRole.Admin && role != UserRole.Admin)
            return BadRequest(new { message = "Không thể tự thay đổi vai trò Admin của chính mình" });

        user.FullName = req.FullName;
        user.Role = role;
        user.XlsxName = req.XlsxName;
        user.UpdatedAt = DateTime.UtcNow;

        if (!string.IsNullOrEmpty(req.Password))
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password);

        await _db.SaveChangesAsync();
        return Ok(new UserListItem(user.Id, user.Username, user.FullName, user.Role.ToString(), user.XlsxName, user.IsActive, user.CreatedAt));
    }

    [HttpPatch("users/{id:guid}/toggle-active")]
    public async Task<IActionResult> ToggleActive(Guid id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound();

        // Chống admin tự deactivate → không thể đăng nhập lại để bật cho mình.
        var callerId = Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var cid) ? cid : Guid.Empty;
        if (user.Id == callerId && user.IsActive)
            return BadRequest(new { message = "Không thể tự vô hiệu hoá tài khoản của chính mình" });

        // Chống vô hiệu hoá admin cuối cùng — sẽ không còn ai quản trị.
        if (user.IsActive && user.Role == UserRole.Admin)
        {
            var activeAdminCount = await _db.Users.CountAsync(u => u.Role == UserRole.Admin && u.IsActive);
            if (activeAdminCount <= 1)
                return BadRequest(new { message = "Không thể vô hiệu hoá admin cuối cùng" });
        }

        user.IsActive = !user.IsActive;
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(new { user.IsActive });
    }

    [HttpGet("config")]
    public async Task<IActionResult> GetConfig()
    {
        var configs = await _db.SystemConfigs.ToListAsync();
        var get = (string key) => configs.FirstOrDefault(c => c.Key == key)?.Value ?? "";
        return Ok(new FullConfigDto(
            get("lock_time"),
            get("qr_bank_name"),
            get("qr_account_number"),
            get("qr_account_name")
        ));
    }

    [HttpPut("config")]
    public async Task<IActionResult> UpdateConfig([FromBody] UpdateFullConfigRequest req)
    {
        var configs = await _db.SystemConfigs.ToListAsync();
        var upsert = (string key, string? value) =>
        {
            if (value == null) return;
            var cfg = configs.FirstOrDefault(c => c.Key == key);
            if (cfg != null) { cfg.Value = value; cfg.UpdatedAt = DateTime.UtcNow; }
        };
        upsert("lock_time", req.LockTime);
        upsert("qr_bank_name", req.QrBankName);
        upsert("qr_account_number", req.QrAccountNumber);
        upsert("qr_account_name", req.QrAccountName);
        await _db.SaveChangesAsync();

        await _audit.LogAsync("UPDATE_CONFIG", "SystemConfig", description: "Cập nhật cấu hình hệ thống");
        return Ok();
    }

    [HttpGet("config/sepay")]
    public async Task<IActionResult> GetSePayConfig()
    {
        var cfg = await _db.SystemConfigs.FirstOrDefaultAsync(c => c.Key == "sepay_apikey");
        return Ok(new { apiKeySet = !string.IsNullOrEmpty(cfg?.Value) });
    }

    [HttpPut("config/sepay-apikey")]
    public async Task<IActionResult> UpdateSePayApiKey([FromBody] UpdateSePayApiKeyRequest req)
    {
        var cfg = await _db.SystemConfigs.FirstOrDefaultAsync(c => c.Key == "sepay_apikey");
        if (cfg != null)
        {
            cfg.Value = req.ApiKey;
            cfg.UpdatedAt = DateTime.UtcNow;
        }
        await _db.SaveChangesAsync();

        await _audit.LogAsync("UPDATE_SEPAY_APIKEY", "SystemConfig", description: "Cập nhật SePay API key");
        return Ok();
    }

    [HttpGet("config/ai")]
    public async Task<IActionResult> GetAiConfig()
    {
        var configs = await _db.SystemConfigs
            .Where(c => c.Key == "ai_api_key" || c.Key == "ai_provider" || c.Key == "ai_model")
            .ToListAsync();
        var keyVal = configs.FirstOrDefault(c => c.Key == "ai_api_key")?.Value;
        var providerVal = configs.FirstOrDefault(c => c.Key == "ai_provider")?.Value;
        var modelVal = configs.FirstOrDefault(c => c.Key == "ai_model")?.Value;
        return Ok(new
        {
            apiKeySet = !string.IsNullOrEmpty(keyVal),
            provider = string.IsNullOrEmpty(providerVal) ? "openrouter" : providerVal,
            model = string.IsNullOrEmpty(modelVal) ? "deepseek/deepseek-chat-v3.1" : modelVal
        });
    }

    [HttpPut("config/ai-key")]
    public async Task<IActionResult> UpdateAiKey([FromBody] UpdateAiKeyRequest req)
    {
        async Task UpsertAsync(string key, string? value)
        {
            if (value == null) return;
            var cfg = await _db.SystemConfigs.FirstOrDefaultAsync(c => c.Key == key);
            if (cfg == null)
                _db.SystemConfigs.Add(new SystemConfig { Key = key, Value = value });
            else { cfg.Value = value; cfg.UpdatedAt = DateTime.UtcNow; }
        }

        if (!string.IsNullOrWhiteSpace(req.ApiKey)) await UpsertAsync("ai_api_key", req.ApiKey);
        if (!string.IsNullOrWhiteSpace(req.Provider)) await UpsertAsync("ai_provider", req.Provider);
        if (!string.IsNullOrWhiteSpace(req.Model)) await UpsertAsync("ai_model", req.Model);

        await _db.SaveChangesAsync();

        await _audit.LogAsync("UPDATE_AI_KEY", "SystemConfig", description: "Cập nhật cấu hình AI");
        return Ok();
    }

    [HttpGet("audit-logs")]
    public async Task<IActionResult> GetAuditLogs(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null, [FromQuery] string? action = null)
    {
        var q = _db.AuditLogs.AsQueryable();

        if (!string.IsNullOrEmpty(search))
        {
            var s = search.Trim().ToLower();
            var matchingOrderIds = await _db.Orders
                .Where(o => o.OrderCode.ToLower().Contains(s))
                .Select(o => (Guid?)o.Id)
                .ToListAsync();

            q = q.Where(a =>
                (a.Username != null && a.Username.ToLower().Contains(s)) ||
                (a.EntityId.HasValue && matchingOrderIds.Contains(a.EntityId)));
        }

        if (!string.IsNullOrEmpty(action))
            q = q.Where(a => a.Action == action);

        var total = await q.CountAsync();
        var logItems = await q.OrderByDescending(a => a.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        // Hydrate order codes
        var orderIds = logItems.Where(l => l.EntityId.HasValue).Select(l => l.EntityId!.Value).Distinct().ToList();
        var orderCodes = orderIds.Count > 0
            ? await _db.Orders.Where(o => orderIds.Contains(o.Id)).ToDictionaryAsync(o => o.Id, o => o.OrderCode)
            : new Dictionary<Guid, string>();

        // Hydrate user full names
        var userIds = logItems.Where(l => l.UserId.HasValue).Select(l => l.UserId!.Value).Distinct().ToList();
        var userFullNames = userIds.Count > 0
            ? await _db.Users.Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.FullName)
            : new Dictionary<Guid, string>();

        var items = logItems.Select(l => new AuditLogDto(
            l.Id,
            l.UserId.HasValue && userFullNames.ContainsKey(l.UserId.Value)
                ? userFullNames[l.UserId.Value]
                : l.Username ?? "Hệ thống",
            l.Username,
            l.Action,
            l.EntityType,
            l.EntityId.HasValue && orderCodes.ContainsKey(l.EntityId.Value)
                ? orderCodes[l.EntityId.Value] : null,
            l.OldValue,
            l.NewValue,
            l.Description,
            l.CreatedAt
        )).ToList();

        return Ok(new { items, total, page, pageSize });
    }

    // ── VietQR ────────────────────────────────────────────────────────────

    [HttpGet("config/vietqr")]
    public async Task<IActionResult> GetVietQrConfig()
    {
        var configs = await _db.SystemConfigs.ToListAsync();
        var get = (string key) => configs.FirstOrDefault(c => c.Key == key)?.Value ?? "";
        return Ok(new VietQrConfigDto(
            get("vietqr_client_id"),
            !string.IsNullOrEmpty(get("vietqr_api_key")),
            get("vietqr_bank_1"), get("vietqr_account_number_1"), get("vietqr_account_name_1"), get("vietqr_template_1"),
            get("vietqr_bank_2"), get("vietqr_account_number_2"), get("vietqr_account_name_2"), get("vietqr_template_2")
        ));
    }

    [HttpPut("config/vietqr")]
    public async Task<IActionResult> SaveVietQrConfig([FromBody] SaveVietQrRequest req)
    {
        var configs = await _db.SystemConfigs.ToListAsync();
        void Upsert(string key, string? value)
        {
            if (value == null) return;
            var cfg = configs.FirstOrDefault(c => c.Key == key);
            if (cfg != null) { cfg.Value = value; cfg.UpdatedAt = DateTime.UtcNow; }
            else _db.SystemConfigs.Add(new SystemConfig { Key = key, Value = value });
        }
        if (req.ClientId != null) Upsert("vietqr_client_id", req.ClientId);
        if (!string.IsNullOrEmpty(req.ApiKey)) Upsert("vietqr_api_key", req.ApiKey);
        Upsert("vietqr_bank_1", req.Bank1 ?? "");
        Upsert("vietqr_account_number_1", req.AccountNumber1 ?? "");
        Upsert("vietqr_account_name_1", req.AccountName1 ?? "");
        Upsert("vietqr_template_1", req.Template1 ?? "");
        Upsert("vietqr_bank_2", req.Bank2 ?? "");
        Upsert("vietqr_account_number_2", req.AccountNumber2 ?? "");
        Upsert("vietqr_account_name_2", req.AccountName2 ?? "");
        Upsert("vietqr_template_2", req.Template2 ?? "");
        await _db.SaveChangesAsync();
        return Ok();
    }

    [HttpPost("config/vietqr/generate-qr")]
    public async Task<IActionResult> GenerateQr([FromBody] GenerateQrRequest req)
    {
        var configs = await _db.SystemConfigs.ToListAsync();
        var get = (string key) => configs.FirstOrDefault(c => c.Key == key)?.Value ?? "";

        var suffix = req.AccountIndex == 2 ? "_2" : "_1";
        var accountNo = get($"vietqr_account_number{suffix}");
        var accountName = get($"vietqr_account_name{suffix}");
        var bank = get($"vietqr_bank{suffix}");
        var template = get($"vietqr_template{suffix}");
        if (string.IsNullOrWhiteSpace(template)) template = "compact2";

        if (string.IsNullOrEmpty(bank) || string.IsNullOrEmpty(accountNo))
            return BadRequest(new { message = "Chưa cấu hình tài khoản ngân hàng" });

        var amount = req.Amount > 0 ? req.Amount : 0;
        var info = Uri.EscapeDataString(req.Content ?? "");
        var nameEnc = Uri.EscapeDataString(accountName);
        var url = $"https://img.vietqr.io/image/{bank}-{accountNo}-{template}.png?amount={amount}&addInfo={info}&accountName={nameEnc}";

        return Ok(new { code = "00", desc = "OK", data = new { qrDataURL = url } });
    }

    // ── Backup ────────────────────────────────────────────────────────────

    [HttpGet("backup/list")]
    public IActionResult ListBackups()
    {
        var items = _backup.ListBackups()
            .Select(f => new { name = f.Name, size = f.Size, createdAt = f.CreatedAt });
        return Ok(new { items, retention = _backup.RetentionCount });
    }

    [HttpPost("backup/create")]
    public async Task<IActionResult> CreateBackup([FromQuery] string? label = null)
    {
        try
        {
            var name = await _backup.CreateBackupAsync(label);
            await _audit.LogAsync("Backup.Create", "Backup", description: name);
            return Ok(new { name, message = "Tạo backup thành công" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpGet("backup/file/{name}")]
    public IActionResult DownloadBackupFile(string name)
    {
        try
        {
            var path = _backup.ResolveBackupPath(name);
            var stream = System.IO.File.OpenRead(path);
            var contentType = name.EndsWith(".gz", StringComparison.OrdinalIgnoreCase)
                ? "application/gzip" : "application/sql";
            return File(stream, contentType, name);
        }
        catch (FileNotFoundException) { return NotFound(new { message = "Không tìm thấy file" }); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpDelete("backup/{name}")]
    public async Task<IActionResult> DeleteBackup(string name)
    {
        try
        {
            _backup.Delete(name);
            await _audit.LogAsync("Backup.Delete", "Backup", description: name);
            return Ok(new { message = "Đã xóa" });
        }
        catch (FileNotFoundException) { return NotFound(new { message = "Không tìm thấy file" }); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("backup/restore-server")]
    public async Task<IActionResult> RestoreFromServer([FromQuery] string name)
    {
        if (string.IsNullOrWhiteSpace(name)) return BadRequest(new { message = "Thiếu tên file" });
        try
        {
            await _backup.RestoreFromServerAsync(name);
            await _audit.LogAsync("Backup.RestoreServer", "Backup", description: name);
            return Ok(new { message = "Khôi phục thành công" });
        }
        catch (FileNotFoundException) { return NotFound(new { message = "Không tìm thấy file" }); }
        catch (Exception ex) { return StatusCode(500, new { message = ex.Message }); }
    }

    [HttpGet("backup/download")]
    public async Task<IActionResult> DownloadBackup()
    {
        try
        {
            var name = await _backup.CreateBackupAsync("manual");
            await _audit.LogAsync("Backup.Download", "Backup", description: name);
            var path = _backup.ResolveBackupPath(name);
            var stream = System.IO.File.OpenRead(path);
            return File(stream, "application/gzip", name);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpPost("backup/restore")]
    public async Task<IActionResult> RestoreBackup(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "Chưa chọn file" });

        var isCompressed = file.FileName.EndsWith(".gz", StringComparison.OrdinalIgnoreCase);
        var tempFile = Path.Combine(Path.GetTempPath(), $"upload_{Guid.NewGuid()}{(isCompressed ? ".sql.gz" : ".sql")}");
        try
        {
            await using (var fs = System.IO.File.Create(tempFile))
                await file.CopyToAsync(fs);

            await _backup.RestoreFromFileAsync(tempFile, isCompressed);
            await _audit.LogAsync("Backup.RestoreUpload", "Backup", description: file.FileName);
            return Ok(new { message = "Khôi phục thành công" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
        finally
        {
            if (System.IO.File.Exists(tempFile)) System.IO.File.Delete(tempFile);
        }
    }
}
