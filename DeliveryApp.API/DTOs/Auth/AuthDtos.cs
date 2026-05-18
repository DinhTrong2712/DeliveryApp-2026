namespace DeliveryApp.API.DTOs.Auth;

public record LoginRequest(string Username, string Password);

public record LoginResponse(string Token, DateTime ExpiresAt, UserDto User);

public record RefreshRequest(string Token);

public record UserDto(Guid Id, string FullName, string Role);
