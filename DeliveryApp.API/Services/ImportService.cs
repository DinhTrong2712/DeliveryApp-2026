using System.Collections.Concurrent;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using DeliveryApp.API.Data;
using DeliveryApp.API.Models;
using Microsoft.EntityFrameworkCore;
using OfficeOpenXml;

namespace DeliveryApp.API.Services;

public class ImportPreviewItem
{
    public string OrderCode { get; set; } = string.Empty;
    public string? RouteCode { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string? ShipperName { get; set; }
    public Guid? ShipperId { get; set; }
    public decimal Amount { get; set; }
    public decimal AmountPaid { get; set; }
    public string Status { get; set; } = "Pending";
    public string? OriginNote { get; set; }
    public DateTime? ScheduledDate { get; set; }
}

public class ShipperOption
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = string.Empty;
}

public class ImportOverride
{
    public string OrderCode { get; set; } = string.Empty;
    public Guid? ShipperId { get; set; }
    public DateTime? ScheduledDate { get; set; }
}

public class ColumnMapping
{
    public string Field { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public int Column { get; set; }
    public string HeaderFound { get; set; } = string.Empty;
    public bool Required { get; set; }
}

public class ImportPreviewResponse
{
    public List<ImportPreviewItem> Preview { get; set; } = new();
    public ImportSummary Summary { get; set; } = new();
    public List<string> Warnings { get; set; } = new();
    public Guid ImportId { get; set; }
    public List<ColumnMapping> ColumnMappings { get; set; } = new();
    public int HeaderRow { get; set; } = 1;
    public string FileName { get; set; } = string.Empty;
    public List<ShipperOption> Shippers { get; set; } = new();
}

public class ImportSummary
{
    public int Total { get; set; }
    public int Matched { get; set; }
    public int Unmatched { get; set; }
    public decimal TotalAmount { get; set; }
}

internal record FieldDef(string Field, string Label, bool Required, string[] Aliases);

public class ImportService
{
    private const int PendingTtlMinutes = 30;
    private const int MaxHeaderScanRows = 5;

    private readonly AppDbContext _db;
    private readonly NotificationService _notifications;
    private static readonly ConcurrentDictionary<Guid, (ImportPreviewResponse Data, DateTime CreatedAt)> _pendingImports = new();

    private static readonly FieldDef[] FieldDefs =
    [
        new("orderCode", "Mã đơn hàng", Required: true,
            ["mã giao dịch", "mã đơn", "mã đơn hàng", "order code", "ordercode", "ma giao dich", "ma don hang", "ma don"]),

        new("routeCode", "Mã GD gộp", Required: false,
            ["mã gđ đơn gộp", "mã gd đơn gộp", "mã gđ gộp", "mã gd gộp", "mã tuyến", "route code", "routecode", "ma gd don gop", "ma tuyen", "mã chuyến", "chuyến"]),

        new("customerName", "Tên khách hàng", Required: true,
            ["tên khách hàng", "ten khach hang", "customer name", "tên kh"]),

        new("shipperName", "Tên nhân viên", Required: false,
            ["tên nhân viên", "nhân viên", "ten nhan vien", "nhan vien", "shipper", "người giao", "nguoi giao", "nv giao"]),

        new("amountPaid", "Số tiền đã thu", Required: false,
            ["số tiền thanh toán", "tiền thanh toán", "tiền đã thu", "da thu", "so tien thanh toan", "amount paid", "tien tra", "tien da thu"]),

        new("amount", "Số tiền", Required: true,
            ["số tiền", "so tien", "amount", "tổng tiền", "tong tien", "thu hộ", "thu ho", "cod", "tiền cod"]),

        new("note", "Diễn giải / Ghi chú", Required: false,
            ["diễn giải", "ghi chú", "dien giai", "ghi chu", "note", "notes", "nội dung", "noi dung", "mô tả", "mo ta"]),
    ];

    public ImportService(AppDbContext db, NotificationService notifications)
    {
        _db = db;
        _notifications = notifications;
    }

    private static (Dictionary<string, int> colMap, List<ColumnMapping> mappings, List<string> missing, int headerRow)
        DetectColumns(ExcelWorksheet ws, int totalCols)
    {
        var colMap = new Dictionary<string, int>();
        var mappings = new List<ColumnMapping>();

        int headerRow = 1;
        for (int r = 1; r <= Math.Min(MaxHeaderScanRows, ws.Dimension?.Rows ?? 1); r++)
        {
            var found = new Dictionary<string, int>();
            for (int c = 1; c <= totalCols; c++)
            {
                var cell = ws.Cells[r, c].Text?.Trim().ToLowerInvariant() ?? "";
                if (string.IsNullOrEmpty(cell)) continue;
                foreach (var def in FieldDefs)
                {
                    if (!found.ContainsKey(def.Field) && def.Aliases.Any(a => cell.Contains(a)))
                        found[def.Field] = c;
                }
            }
            if (found.Count >= 2)
            {
                colMap = found;
                headerRow = r;
                break;
            }
        }

        // Fallback: vị trí cột cố định theo thứ tự FieldDefs
        if (colMap.Count == 0)
        {
            for (int i = 0; i < FieldDefs.Length; i++)
                colMap[FieldDefs[i].Field] = i + 1;
            headerRow = 1;
        }

        foreach (var def in FieldDefs)
        {
            if (colMap.TryGetValue(def.Field, out var col))
            {
                mappings.Add(new ColumnMapping
                {
                    Field = def.Field,
                    Label = def.Label,
                    Column = col,
                    HeaderFound = ws.Cells[headerRow, col].Text?.Trim() ?? "",
                    Required = def.Required
                });
            }
        }

        var missing = FieldDefs
            .Where(d => d.Required && !colMap.ContainsKey(d.Field))
            .Select(d => d.Label)
            .ToList();

        return (colMap, mappings, missing, headerRow);
    }

    /// <summary>
    /// Chuẩn hoá tên để so khớp: bỏ dấu tiếng Việt, gộp khoảng trắng quanh '-', lowercase.
    /// "Kho - Mạnh giao hàng" và "Kho-Mạnh giao hàng" → cùng "kho-manh giao hang".
    /// </summary>
    private static string NormalizeForMatch(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return string.Empty;

        var sb = new StringBuilder();
        foreach (var ch in s.Normalize(NormalizationForm.FormD))
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark)
                sb.Append(ch);
        }
        var result = sb.ToString().Normalize(NormalizationForm.FormC)
            .Replace('đ', 'd').Replace('Đ', 'D');
        result = Regex.Replace(result, @"\s*-\s*", "-");
        result = Regex.Replace(result, @"\s+", " ");
        return result.Trim().ToLowerInvariant();
    }

    private static decimal ParseAmount(string raw)
    {
        // VN format: "1.234.567" or "1,234,567" or "1.234,56"
        raw = raw.Trim();
        if (raw.Contains(',') && raw.Contains('.'))
            raw = raw.Replace(".", "").Replace(",", ".");
        else if (raw.Contains('.') && raw.LastIndexOf('.') < raw.Length - 4)
            raw = raw.Replace(".", "");
        else
            raw = raw.Replace(",", "");

        return decimal.TryParse(raw, NumberStyles.Any, CultureInfo.InvariantCulture, out var v) ? v : 0;
    }

    private static OrderStatus ComputeOrderStatus(decimal amount, decimal amountPaid, bool hasShipper) =>
        amountPaid >= amount && amount > 0 ? OrderStatus.PaidCash
        : amountPaid > 0 ? OrderStatus.Partial
        : hasShipper ? OrderStatus.Pending : OrderStatus.Unassigned;

    public async Task<ImportPreviewResponse> ParseXlsxAsync(Stream stream, string fileName, string importedBy)
    {
        ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
        var users = await _db.Users.Where(u => u.Role == UserRole.Shipper).ToListAsync();

        using var package = new ExcelPackage(stream);
        var ws = package.Workbook.Worksheets[0];
        var rows = ws.Dimension?.Rows ?? 0;
        var cols = ws.Dimension?.Columns ?? 0;

        var (colMap, mappings, missingRequired, headerRow) = DetectColumns(ws, cols);
        var warnings = new HashSet<string>();

        if (missingRequired.Count > 0)
            warnings.Add($"Không tìm thấy cột bắt buộc: {string.Join(", ", missingRequired)}. Kiểm tra lại tên header trong file.");

        string? Cell(int row, string field) =>
            colMap.TryGetValue(field, out var c) ? ws.Cells[row, c].Text?.Trim() : null;

        var preview = new List<ImportPreviewItem>();
        for (int r = headerRow + 1; r <= rows; r++)
        {
            var orderCode = Cell(r, "orderCode");
            var customerName = Cell(r, "customerName");
            if (string.IsNullOrEmpty(orderCode) || string.IsNullOrEmpty(customerName)) continue;

            var amount = ParseAmount(Cell(r, "amount") ?? "");
            if (amount <= 0) continue;
            var amountPaidRaw = Cell(r, "amountPaid") ?? "";
            var amountPaid = string.IsNullOrEmpty(amountPaidRaw) ? 0 : ParseAmount(amountPaidRaw);

            var routeCode = Cell(r, "routeCode");
            var shipperXlsxName = Cell(r, "shipperName");
            var note = Cell(r, "note");

            User? matchedShipper = null;
            if (!string.IsNullOrEmpty(shipperXlsxName))
            {
                var key = NormalizeForMatch(shipperXlsxName);
                matchedShipper = users.FirstOrDefault(u =>
                    NormalizeForMatch(u.XlsxName) == key ||
                    NormalizeForMatch(u.FullName) == key ||
                    NormalizeForMatch(u.Username) == key);

                if (matchedShipper == null)
                    warnings.Add($"Nhân viên '{shipperXlsxName}' không tìm thấy — đơn hàng sẽ không được phân công");
            }

            preview.Add(new ImportPreviewItem
            {
                OrderCode = orderCode,
                RouteCode = string.IsNullOrEmpty(routeCode) ? null : routeCode,
                CustomerName = customerName,
                ShipperName = shipperXlsxName,
                ShipperId = matchedShipper?.Id,
                Amount = amount,
                AmountPaid = amountPaid,
                Status = ComputeOrderStatus(amount, amountPaid, matchedShipper != null).ToString(),
                OriginNote = string.IsNullOrEmpty(note) ? null : note
            });
        }

        var importId = Guid.NewGuid();
        var response = new ImportPreviewResponse
        {
            Preview = preview,
            Summary = new ImportSummary
            {
                Total = preview.Count,
                Matched = preview.Count(p => p.ShipperId.HasValue),
                Unmatched = preview.Count(p => !p.ShipperId.HasValue),
                TotalAmount = preview.Sum(p => p.Amount)
            },
            Warnings = warnings.ToList(),
            ImportId = importId,
            ColumnMappings = mappings,
            HeaderRow = headerRow,
            FileName = fileName,
            Shippers = users
                .OrderBy(u => u.FullName)
                .Select(u => new ShipperOption { Id = u.Id, FullName = u.FullName })
                .ToList()
        };

        _pendingImports[importId] = (response, DateTime.UtcNow);
        PurgeStalePending();
        return response;
    }

    private static void PurgeStalePending()
    {
        var cutoff = DateTime.UtcNow.AddMinutes(-PendingTtlMinutes);
        foreach (var key in _pendingImports.Keys.ToList())
            if (_pendingImports.TryGetValue(key, out var entry) && entry.CreatedAt < cutoff)
                _pendingImports.TryRemove(key, out _);
    }

    public async Task<ImportConfirmResult> ConfirmImportAsync(Guid importId, string importedBy, List<ImportOverride>? overrides = null)
    {
        if (!_pendingImports.TryGetValue(importId, out var entry))
            throw new InvalidOperationException("Import ID không hợp lệ hoặc đã hết hạn");
        var pending = entry.Data;

        var overrideMap = overrides?
            .Where(o => !string.IsNullOrEmpty(o.OrderCode))
            .GroupBy(o => o.OrderCode)
            .ToDictionary(g => g.Key, g => g.Last())
            ?? new Dictionary<string, ImportOverride>();

        var shipperLookup = await _db.Users
            .Where(u => u.Role == UserRole.Shipper)
            .ToDictionaryAsync(u => u.Id, u => u.FullName);

        // Validate upfront — any single failure aborts the whole import.
        var duplicateCodes = pending.Preview
            .GroupBy(p => p.OrderCode)
            .Where(g => g.Count() > 1)
            .Select(g => g.Key)
            .ToList();
        if (duplicateCodes.Count > 0)
            throw new InvalidOperationException($"Có mã đơn trùng trong file: {string.Join(", ", duplicateCodes.Take(5))}. Huỷ toàn bộ import.");

        foreach (var p in pending.Preview)
        {
            if (string.IsNullOrWhiteSpace(p.OrderCode))
                throw new InvalidOperationException("Có dòng thiếu mã đơn. Huỷ toàn bộ import.");
            if (string.IsNullOrWhiteSpace(p.CustomerName))
                throw new InvalidOperationException($"Đơn {p.OrderCode} thiếu tên khách hàng. Huỷ toàn bộ import.");
            if (p.Amount <= 0)
                throw new InvalidOperationException($"Đơn {p.OrderCode} có số tiền không hợp lệ. Huỷ toàn bộ import.");

            if (overrideMap.TryGetValue(p.OrderCode, out var ov)
                && ov.ShipperId.HasValue
                && !shipperLookup.ContainsKey(ov.ShipperId.Value))
                throw new InvalidOperationException($"Đơn {p.OrderCode}: nhân viên không tồn tại. Huỷ toàn bộ import.");
        }

        // Apply overrides into preview so the returned items reflect what was saved.
        foreach (var p in pending.Preview)
        {
            if (!overrideMap.TryGetValue(p.OrderCode, out var ov)) continue;
            p.ShipperId = ov.ShipperId;
            p.ShipperName = ov.ShipperId.HasValue && shipperLookup.TryGetValue(ov.ShipperId.Value, out var name)
                ? name
                : p.ShipperName;
            p.ScheduledDate = ov.ScheduledDate;
            p.Status = ComputeOrderStatus(p.Amount, p.AmountPaid, p.ShipperId.HasValue).ToString();
        }

        var orderCodes = pending.Preview.Select(p => p.OrderCode).ToList();
        var existingOrders = await _db.Orders
            .Where(o => orderCodes.Contains(o.OrderCode))
            .ToDictionaryAsync(o => o.OrderCode);

        await using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            var log = new ImportLog
            {
                FileName = pending.FileName,
                ImportedBy = importedBy,
                TotalRows = pending.Preview.Count
            };
            _db.ImportLogs.Add(log);
            await _db.SaveChangesAsync();

            var newItems = new List<ImportPreviewItem>();
            var updatedItems = new List<ImportPreviewItem>();
            var toInsert = new List<Order>();

            foreach (var p in pending.Preview)
            {
                if (existingOrders.TryGetValue(p.OrderCode, out var existing))
                {
                    existing.ShipperNameXlsx = p.ShipperName;
                    existing.ShipperId = p.ShipperId;
                    existing.RouteCode = p.RouteCode;
                    existing.OriginNote = p.OriginNote;
                    if (p.ScheduledDate.HasValue) existing.ScheduledDate = p.ScheduledDate;
                    existing.UpdatedAt = DateTime.UtcNow;
                    if (existing.Status == OrderStatus.Pending || existing.Status == OrderStatus.Unassigned)
                        existing.Status = p.ShipperId.HasValue ? OrderStatus.Pending : OrderStatus.Unassigned;
                    updatedItems.Add(p);
                }
                else
                {
                    toInsert.Add(new Order
                    {
                        OrderCode = p.OrderCode,
                        RouteCode = p.RouteCode,
                        CustomerName = p.CustomerName,
                        Amount = p.Amount,
                        AmountPaid = p.AmountPaid,
                        OriginNote = p.OriginNote,
                        ShipperId = p.ShipperId,
                        ShipperNameXlsx = p.ShipperName,
                        ScheduledDate = p.ScheduledDate,
                        ImportId = log.Id,
                        Status = ComputeOrderStatus(p.Amount, p.AmountPaid, p.ShipperId.HasValue)
                    });
                    newItems.Add(p);
                }
            }

            _db.Orders.AddRange(toInsert);
            log.ImportedRows = toInsert.Count;
            log.SkippedRows = 0;
            log.UpdatedRows = updatedItems.Count;
            await _db.SaveChangesAsync();
            await tx.CommitAsync();

            _pendingImports.TryRemove(importId, out _);

            var newByShipper = newItems
                .Where(p => p.ShipperId.HasValue)
                .GroupBy(p => p.ShipperId!.Value);
            foreach (var g in newByShipper)
            {
                var count = g.Count();
                var sample = g.Take(3).Select(p => p.OrderCode).ToList();
                var more = count > sample.Count ? $" và {count - sample.Count} đơn khác" : "";
                var totalAmount = g.Sum(p => p.Amount);
                try
                {
                    await _notifications.CreateAsync(
                        g.Key,
                        title: $"Bạn có {count} đơn mới từ kế toán",
                        body: $"{string.Join(", ", sample)}{more} — tổng {totalAmount:N0}đ",
                        link: "/shipper/orders",
                        type: "ImportAssigned");
                }
                catch { /* notification lỗi không được làm fail import đã commit */ }
            }

            return new ImportConfirmResult
            {
                Imported = toInsert.Count,
                Updated = updatedItems.Count,
                Skipped = 0,
                Items = newItems.Concat(updatedItems).ToList()
            };
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync();
            throw new InvalidOperationException($"Import thất bại — đã huỷ toàn bộ. ({ex.Message})", ex);
        }
    }
}

public class ImportConfirmResult
{
    public int Imported { get; set; }
    public int Updated { get; set; }
    public int Skipped { get; set; }
    public List<ImportPreviewItem> Items { get; set; } = new();
}
