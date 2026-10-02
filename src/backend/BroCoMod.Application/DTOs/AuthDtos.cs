namespace BroCoMod.Application.DTOs;

public record RegisterRequest(
    string Email,
    string Password,
    string FullName,
    string PhoneNumber,
    string Role = "CUSTOMER",
    string? GarageName = null,
    string? Address = null,
    Guid? GarageId = null
);

public record LoginRequest(
    string Email,
    string Password
);

public record AuthResponse(
    string AccessToken,
    string RefreshToken,
    int ExpiresInSeconds,
    UserDto User
);

public record UserDto(
    Guid Id,
    string Email,
    string FullName,
    string PhoneNumber,
    IReadOnlyList<string> Roles,
    IReadOnlyList<string> Permissions,
    Guid? CustomerId,
    Guid? GarageId,
    string? GarageRole,
    bool IsActive = true,
    DateTime? CreatedAtUtc = null
);

public record RefreshTokenRequest(
    string RefreshToken
);

public record RevokeTokenRequest(
    string RefreshToken
);

public record ForgotPasswordRequest(
    string Email
);

public record ResetPasswordRequest(
    string Email,
    string Token,
    string NewPassword
);

public record ApiResponse<T>(
    bool Success,
    string Message,
    T? Data = default,
    IReadOnlyList<string>? Errors = null
)
{
    public static ApiResponse<T> Ok(T data, string message = "Success") =>
        new(true, message, data, null);

    public static ApiResponse<T> Fail(string message, IEnumerable<string>? errors = null) =>
        new(false, message, default, errors?.ToList() ?? new List<string> { message });
}
