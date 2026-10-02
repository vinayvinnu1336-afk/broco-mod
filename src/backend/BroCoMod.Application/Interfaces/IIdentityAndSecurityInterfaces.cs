using BroCoMod.Application.DTOs;
using BroCoMod.Domain.Entities.Identity;

namespace BroCoMod.Application.Interfaces;

public interface IIdentityService
{
    Task<AuthResponse> RegisterAsync(RegisterRequest request, string? ipAddress = null, CancellationToken cancellationToken = default);
    Task<AuthResponse> LoginAsync(LoginRequest request, string? ipAddress = null, CancellationToken cancellationToken = default);
    Task<AuthResponse> RefreshTokenAsync(string refreshToken, string? ipAddress = null, CancellationToken cancellationToken = default);
    Task<bool> RevokeRefreshTokenAsync(string refreshToken, string? ipAddress = null, CancellationToken cancellationToken = default);
    Task<bool> LogoutAsync(Guid userId, string? refreshToken = null, string? ipAddress = null, CancellationToken cancellationToken = default);
    Task<string> RequestPasswordResetAsync(string email, string? ipAddress = null, CancellationToken cancellationToken = default);
    Task<bool> ResetPasswordAsync(string email, string token, string newPassword, string? ipAddress = null, CancellationToken cancellationToken = default);
    Task<UserDto> GetCurrentUserProfileAsync(Guid userId, CancellationToken cancellationToken = default);
    Task SetUserActiveStatusAsync(Guid userId, bool isActive, Guid adminUserId, string? ipAddress = null, CancellationToken cancellationToken = default);
}

public interface IPasswordHasher
{
    string HashPassword(string password, out string salt);
    bool VerifyPassword(string password, string passwordHash, string salt);
}

public interface ITokenService
{
    string GenerateAccessToken(
        User user,
        IEnumerable<string> roles,
        IEnumerable<string> permissions,
        Guid? customerId = null,
        Guid? garageId = null,
        string? garageRole = null);

    string GenerateRefreshToken();
    string HashToken(string token);
}

public interface IOtpProvider
{
    string ProviderName { get; }
    Task<string> GenerateOtpAsync(string destination, string purpose, CancellationToken cancellationToken = default);
    Task<bool> VerifyOtpAsync(string destination, string otp, string purpose, CancellationToken cancellationToken = default);
}

public interface IAuditService
{
    Task LogAsync(
        string action,
        Guid? userId = null,
        string? userEmail = null,
        string? entityName = null,
        string? entityId = null,
        string? details = null,
        string? ipAddress = null,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AdminAuditLogSummaryDto>> GetRecentAuditLogsAsync(int limit = 50, CancellationToken cancellationToken = default);
}

public interface ICurrentUserService
{
    Guid? UserId { get; }
    string? Email { get; }
    IReadOnlyList<string> Roles { get; }
    IReadOnlyList<string> Permissions { get; }
    Guid? CustomerId { get; }
    Guid? GarageId { get; }
    string? GarageRole { get; }
    bool IsAuthenticated { get; }
    bool HasPermission(string permission);
    bool IsInRole(string role);
}
