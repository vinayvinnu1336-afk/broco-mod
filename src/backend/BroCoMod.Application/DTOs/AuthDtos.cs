using System.ComponentModel.DataAnnotations;
using BroCoMod.Application.Common;

namespace BroCoMod.Application.DTOs;

public record RegisterRequest(
    string Email,
    [MinLength(PasswordPolicy.MinLength, ErrorMessage = PasswordPolicy.TooShortMessage)] string Password,
    string FullName,
    [IndianMobile] string PhoneNumber,
    string Role = "CUSTOMER",
    string? GarageName = null,
    string? Address = null,
    // Ignored for self-service sign-up: a garage owner always creates a new garage. Staff are added by an owner/admin.
    Guid? GarageId = null,
    double? Latitude = null,
    double? Longitude = null
);

/// <summary>
/// Sign in with a password and either an Indian mobile number (the main way) or an email (staff accounts
/// may have no mobile). Exactly one of <see cref="Email"/> and <see cref="MobileNumber"/> should be set;
/// when both are, the mobile number is used.
/// </summary>
public record LoginRequest(
    string? Email,
    string Password,
    string? MobileNumber = null
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
    [MinLength(PasswordPolicy.MinLength, ErrorMessage = PasswordPolicy.TooShortMessage)] string NewPassword
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
