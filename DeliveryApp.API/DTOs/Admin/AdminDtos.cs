namespace DeliveryApp.API.DTOs.Admin;

public record CreateUserRequest(
    string Username,
    string Password,
    string FullName,
    string Role,
    string? XlsxName
);

public record UpdateUserRequest(
    string FullName,
    string Role,
    string? XlsxName,
    string? Password
);

public record UserListItem(
    Guid Id,
    string Username,
    string FullName,
    string Role,
    string? XlsxName,
    bool IsActive,
    DateTime CreatedAt
);

public record SystemConfigDto(string LockTime, string? WebhookUrl);

public record FullConfigDto(string LockTime, string QrBankName, string QrAccountNumber, string QrAccountName);

public record UpdateConfigRequest(string? LockTime, string? WebhookUrl);

public record UpdateFullConfigRequest(string? LockTime, string? QrBankName, string? QrAccountNumber, string? QrAccountName);

public record UpdateSePayApiKeyRequest(string ApiKey);

public record UpdateAiKeyRequest(string ApiKey, string? Provider, string? Model);

public record TestWebhookResponse(bool Success, int LatencyMs, bool SignatureValid, string? Error);

public record VietQrConfigDto(
    string ClientId,
    bool ApiKeySet,
    string Bank1, string AccountNumber1, string AccountName1, string Template1,
    string Bank2, string AccountNumber2, string AccountName2, string Template2
);

public record SaveVietQrRequest(
    string? ClientId,
    string? ApiKey,
    string? Bank1, string? AccountNumber1, string? AccountName1, string? Template1,
    string? Bank2, string? AccountNumber2, string? AccountName2, string? Template2
);

public record GenerateQrRequest(int AccountIndex, decimal Amount, string Content);

public record AuditLogDto(
    Guid Id,
    string PerformedBy,
    string? Username,
    string Action,
    string EntityType,
    string? OrderCode,
    string? OldValue,
    string? NewValue,
    string? Description,
    DateTime CreatedAt
);
