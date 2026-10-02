using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Constants;
using BroCoMod.Domain.Entities.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BroCoMod.Infrastructure.Services;

public class IdentityService : IIdentityService
{
    private readonly IApplicationDbContext _context;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ITokenService _tokenService;
    private readonly IOtpProvider _otpProvider;
    private readonly IAuditService _auditService;
    private readonly ILogger<IdentityService> _logger;

    public IdentityService(
        IApplicationDbContext context,
        IPasswordHasher _passwordHasher,
        ITokenService tokenService,
        IOtpProvider otpProvider,
        IAuditService auditService,
        ILogger<IdentityService> logger)
    {
        _context = context;
        this._passwordHasher = _passwordHasher;
        _tokenService = tokenService;
        _otpProvider = otpProvider;
        _auditService = auditService;
        _logger = logger;
    }

    public async Task<AuthResponse> RegisterAsync(
        RegisterRequest request,
        string? ipAddress = null,
        CancellationToken cancellationToken = default)
    {
        var normalizedEmail = request.Email.Trim().ToUpperInvariant();
        var existingUser = await _context.Users
            .AnyAsync(u => u.NormalizedEmail == normalizedEmail, cancellationToken);

        if (existingUser)
        {
            throw new InvalidOperationException($"User with email '{request.Email}' already exists.");
        }

        var passwordHash = _passwordHasher.HashPassword(request.Password, out var salt);
        var user = new User(
            email: request.Email,
            fullName: request.FullName,
            phoneNumber: request.PhoneNumber,
            passwordHash: passwordHash,
            salt: salt);

        _context.Users.Add(user);

        // Determine requested role (default to Customer)
        var requestedRoleName = string.IsNullOrWhiteSpace(request.Role)
            ? AppRoles.Customer
            : request.Role.Trim().ToUpperInvariant();

        // Validate role exists in system
        var role = await _context.Roles
            .FirstOrDefaultAsync(r => r.NormalizedName == requestedRoleName, cancellationToken);

        if (role == null)
        {
            role = new Role(requestedRoleName);
            _context.Roles.Add(role);
        }

        _context.UserRoles.Add(new UserRole { User = user, Role = role });

        // Add role profile
        Guid? customerId = null;
        Guid? garageId = null;
        string? garageRole = null;

        if (requestedRoleName == AppRoles.Customer)
        {
            var profile = new CustomerProfile(user.Id);
            _context.CustomerProfiles.Add(profile);
            customerId = profile.Id;
        }
        else if (AppRoles.IsGarageRole(requestedRoleName))
        {
            if (request.GarageId.HasValue)
            {
                garageId = request.GarageId.Value;
                garageRole = requestedRoleName;
                var garageUser = new GarageUser(user.Id, garageId.Value, requestedRoleName, "Service Representative");
                _context.GarageUsers.Add(garageUser);
            }
        }
        else if (requestedRoleName == AppRoles.Advisor)
        {
            var advisorProfile = new AdvisorProfile(user.Id, $"ADV-{Random.Shared.Next(1000, 9999)}");
            _context.AdvisorProfiles.Add(advisorProfile);
        }

        // Fetch permissions for this role
        var permissions = AppPermissions.GetDefaultPermissionsForRole(requestedRoleName).ToList();

        // Generate tokens
        var rolesList = new List<string> { requestedRoleName };
        var accessToken = _tokenService.GenerateAccessToken(user, rolesList, permissions, customerId, garageId, garageRole);
        var rawRefreshToken = _tokenService.GenerateRefreshToken();
        var hashedRefreshToken = _tokenService.HashToken(rawRefreshToken);

        var refreshTokenEntity = new RefreshToken(
            userId: user.Id,
            tokenHash: hashedRefreshToken,
            expiresAtUtc: DateTime.UtcNow.AddDays(7));

        _context.RefreshTokens.Add(refreshTokenEntity);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: AuditActions.UserCreated,
            userId: user.Id,
            userEmail: user.Email,
            entityName: nameof(User),
            entityId: user.Id.ToString(),
            details: $"Registered with role {requestedRoleName}",
            ipAddress: ipAddress,
            cancellationToken: cancellationToken);

        return new AuthResponse(
            AccessToken: accessToken,
            RefreshToken: rawRefreshToken,
            ExpiresInSeconds: 3600,
            User: new UserDto(
                user.Id,
                user.Email,
                user.FullName,
                user.PhoneNumber,
                rolesList,
                permissions,
                customerId,
                garageId,
                garageRole,
                user.IsActive,
                user.CreatedAtUtc));
    }

    public async Task<AuthResponse> LoginAsync(
        LoginRequest request,
        string? ipAddress = null,
        CancellationToken cancellationToken = default)
    {
        var normalizedEmail = request.Email.Trim().ToUpperInvariant();
        var user = await _context.Users
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                    .ThenInclude(r => r.RolePermissions)
                        .ThenInclude(rp => rp.Permission)
            .Include(u => u.CustomerProfile)
            .Include(u => u.GarageUser)
            .Include(u => u.AdvisorProfile)
            .FirstOrDefaultAsync(u => u.NormalizedEmail == normalizedEmail, cancellationToken);

        if (user == null)
        {
            await _auditService.LogAsync(
                action: AuditActions.LoginFailed,
                userEmail: request.Email,
                details: "User not found",
                ipAddress: ipAddress,
                cancellationToken: cancellationToken);

            throw new UnauthorizedAccessException("Invalid email or password.");
        }

        if (!user.IsActive)
        {
            await _auditService.LogAsync(
                action: AuditActions.LoginFailed,
                userId: user.Id,
                userEmail: user.Email,
                details: "Account is disabled",
                ipAddress: ipAddress,
                cancellationToken: cancellationToken);

            throw new UnauthorizedAccessException("Account is disabled. Please contact support.");
        }

        if (user.IsLockedOut())
        {
            await _auditService.LogAsync(
                action: AuditActions.LoginFailed,
                userId: user.Id,
                userEmail: user.Email,
                details: $"Account locked out until {user.LockoutEndUtc} UTC",
                ipAddress: ipAddress,
                cancellationToken: cancellationToken);

            throw new UnauthorizedAccessException("Account is temporarily locked due to multiple failed login attempts. Please try again later.");
        }

        var isPasswordValid = _passwordHasher.VerifyPassword(request.Password, user.PasswordHash, user.Salt);
        if (!isPasswordValid)
        {
            user.RecordFailedLogin(maxFailedAttempts: 5, lockoutMinutes: 15);
            await _context.SaveChangesAsync(cancellationToken);

            await _auditService.LogAsync(
                action: AuditActions.LoginFailed,
                userId: user.Id,
                userEmail: user.Email,
                details: $"Invalid password. Failed attempts: {user.FailedLoginAttempts}",
                ipAddress: ipAddress,
                cancellationToken: cancellationToken);

            throw new UnauthorizedAccessException("Invalid email or password.");
        }

        user.RecordSuccessfulLogin();

        var roles = user.UserRoles.Select(ur => ur.Role.Name).Distinct().ToList();
        var permissions = user.UserRoles
            .SelectMany(ur => ur.Role.RolePermissions.Select(rp => rp.Permission.Code))
            .Distinct()
            .ToList();

        // If no explicit DB role permissions configured yet, map from standard role definition
        if (!permissions.Any())
        {
            foreach (var role in roles)
            {
                permissions.AddRange(AppPermissions.GetDefaultPermissionsForRole(role));
            }
            permissions = permissions.Distinct().ToList();
        }

        Guid? customerId = user.CustomerProfile?.Id;
        Guid? garageId = user.GarageUser?.GarageId;
        string? garageRole = user.GarageUser?.RoleName;

        var accessToken = _tokenService.GenerateAccessToken(user, roles, permissions, customerId, garageId, garageRole);
        var rawRefreshToken = _tokenService.GenerateRefreshToken();
        var hashedRefreshToken = _tokenService.HashToken(rawRefreshToken);

        var refreshTokenEntity = new RefreshToken(
            userId: user.Id,
            tokenHash: hashedRefreshToken,
            expiresAtUtc: DateTime.UtcNow.AddDays(7));

        _context.RefreshTokens.Add(refreshTokenEntity);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: AuditActions.Login,
            userId: user.Id,
            userEmail: user.Email,
            details: $"Successful login for roles: {string.Join(", ", roles)}",
            ipAddress: ipAddress,
            cancellationToken: cancellationToken);

        return new AuthResponse(
            AccessToken: accessToken,
            RefreshToken: rawRefreshToken,
            ExpiresInSeconds: 3600,
            User: new UserDto(
                user.Id,
                user.Email,
                user.FullName,
                user.PhoneNumber,
                roles,
                permissions,
                customerId,
                garageId,
                garageRole,
                user.IsActive,
                user.CreatedAtUtc));
    }

    public async Task<AuthResponse> RefreshTokenAsync(
        string refreshToken,
        string? ipAddress = null,
        CancellationToken cancellationToken = default)
    {
        var incomingHash = _tokenService.HashToken(refreshToken);

        var existingToken = await _context.RefreshTokens
            .Include(rt => rt.User)
                .ThenInclude(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
                        .ThenInclude(r => r.RolePermissions)
                            .ThenInclude(rp => rp.Permission)
            .Include(rt => rt.User)
                .ThenInclude(u => u.CustomerProfile)
            .Include(rt => rt.User)
                .ThenInclude(u => u.GarageUser)
            .FirstOrDefaultAsync(rt => rt.TokenHash == incomingHash, cancellationToken);

        if (existingToken == null)
        {
            throw new UnauthorizedAccessException("Invalid refresh token.");
        }

        // Token reuse detection: if a revoked token is used, someone may have compromised it!
        if (existingToken.IsRevoked)
        {
            await _auditService.LogAsync(
                action: AuditActions.RefreshTokenRevoked,
                userId: existingToken.UserId,
                userEmail: existingToken.User?.Email,
                details: "Suspicious token reuse detected! Revoking all user tokens.",
                ipAddress: ipAddress,
                cancellationToken: cancellationToken);

            // Revoke all remaining active tokens for this user for security
            var userTokens = await _context.RefreshTokens
                .Where(rt => rt.UserId == existingToken.UserId && rt.RevokedAtUtc == null)
                .ToListAsync(cancellationToken);

            foreach (var t in userTokens)
            {
                t.Revoke("Compromised token family reuse detected");
            }
            await _context.SaveChangesAsync(cancellationToken);

            throw new UnauthorizedAccessException("Invalid refresh token: token has been revoked.");
        }

        if (existingToken.IsExpired)
        {
            throw new UnauthorizedAccessException("Refresh token has expired.");
        }

        var user = existingToken.User;
        if (!user.IsActive)
        {
            throw new UnauthorizedAccessException("User is inactive.");
        }

        // Rotate token
        var newRawRefreshToken = _tokenService.GenerateRefreshToken();
        var newHashedRefreshToken = _tokenService.HashToken(newRawRefreshToken);

        existingToken.Revoke("Rotated during token refresh", newHashedRefreshToken);

        var newRefreshToken = new RefreshToken(
            userId: user.Id,
            tokenHash: newHashedRefreshToken,
            expiresAtUtc: DateTime.UtcNow.AddDays(7));

        _context.RefreshTokens.Add(newRefreshToken);

        var roles = user.UserRoles.Select(ur => ur.Role.Name).Distinct().ToList();
        var permissions = user.UserRoles
            .SelectMany(ur => ur.Role.RolePermissions.Select(rp => rp.Permission.Code))
            .Distinct()
            .ToList();

        if (!permissions.Any())
        {
            foreach (var role in roles)
            {
                permissions.AddRange(AppPermissions.GetDefaultPermissionsForRole(role));
            }
            permissions = permissions.Distinct().ToList();
        }

        Guid? customerId = user.CustomerProfile?.Id;
        Guid? garageId = user.GarageUser?.GarageId;
        string? garageRole = user.GarageUser?.RoleName;

        var newAccessToken = _tokenService.GenerateAccessToken(user, roles, permissions, customerId, garageId, garageRole);

        await _context.SaveChangesAsync(cancellationToken);

        return new AuthResponse(
            AccessToken: newAccessToken,
            RefreshToken: newRawRefreshToken,
            ExpiresInSeconds: 3600,
            User: new UserDto(
                user.Id,
                user.Email,
                user.FullName,
                user.PhoneNumber,
                roles,
                permissions,
                customerId,
                garageId,
                garageRole,
                user.IsActive,
                user.CreatedAtUtc));
    }

    public async Task<bool> RevokeRefreshTokenAsync(
        string refreshToken,
        string? ipAddress = null,
        CancellationToken cancellationToken = default)
    {
        var tokenHash = _tokenService.HashToken(refreshToken);
        var token = await _context.RefreshTokens
            .FirstOrDefaultAsync(rt => rt.TokenHash == tokenHash, cancellationToken);

        if (token == null || token.IsRevoked)
        {
            return false;
        }

        token.Revoke("Explicit revocation by user request");
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: AuditActions.RefreshTokenRevoked,
            userId: token.UserId,
            details: "Refresh token revoked",
            ipAddress: ipAddress,
            cancellationToken: cancellationToken);

        return true;
    }

    public async Task<bool> LogoutAsync(
        Guid userId,
        string? refreshToken = null,
        string? ipAddress = null,
        CancellationToken cancellationToken = default)
    {
        if (!string.IsNullOrWhiteSpace(refreshToken))
        {
            var hash = _tokenService.HashToken(refreshToken);
            var token = await _context.RefreshTokens
                .FirstOrDefaultAsync(rt => rt.TokenHash == hash && rt.UserId == userId, cancellationToken);
            token?.Revoke("User logout");
        }
        else
        {
            // Revoke all active tokens for this user
            var activeTokens = await _context.RefreshTokens
                .Where(rt => rt.UserId == userId && rt.RevokedAtUtc == null)
                .ToListAsync(cancellationToken);

            foreach (var t in activeTokens)
            {
                t.Revoke("User global logout");
            }
        }

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: AuditActions.Logout,
            userId: userId,
            details: "User logged out",
            ipAddress: ipAddress,
            cancellationToken: cancellationToken);

        return true;
    }

    public async Task<string> RequestPasswordResetAsync(
        string email,
        string? ipAddress = null,
        CancellationToken cancellationToken = default)
    {
        var normalizedEmail = email.Trim().ToUpperInvariant();
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.NormalizedEmail == normalizedEmail, cancellationToken);

        if (user == null)
        {
            // Return dummy OTP to prevent email enumeration attacks
            return "123456";
        }

        var otp = await _otpProvider.GenerateOtpAsync(user.Email, "PasswordReset", cancellationToken);

        await _auditService.LogAsync(
            action: AuditActions.PasswordResetRequested,
            userId: user.Id,
            userEmail: user.Email,
            details: "Password reset OTP requested",
            ipAddress: ipAddress,
            cancellationToken: cancellationToken);

        return otp;
    }

    public async Task<bool> ResetPasswordAsync(
        string email,
        string token,
        string newPassword,
        string? ipAddress = null,
        CancellationToken cancellationToken = default)
    {
        var isValid = await _otpProvider.VerifyOtpAsync(email, token, "PasswordReset", cancellationToken);
        if (!isValid)
        {
            return false;
        }

        var normalizedEmail = email.Trim().ToUpperInvariant();
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.NormalizedEmail == normalizedEmail, cancellationToken);

        if (user == null)
        {
            return false;
        }

        var newHash = _passwordHasher.HashPassword(newPassword, out var newSalt);
        user.UpdatePassword(newHash, newSalt);

        // Revoke all active tokens for security
        var activeTokens = await _context.RefreshTokens
            .Where(rt => rt.UserId == user.Id && rt.RevokedAtUtc == null)
            .ToListAsync(cancellationToken);

        foreach (var t in activeTokens)
        {
            t.Revoke("Password reset performed");
        }

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: AuditActions.PasswordResetCompleted,
            userId: user.Id,
            userEmail: user.Email,
            details: "Password reset completed successfully",
            ipAddress: ipAddress,
            cancellationToken: cancellationToken);

        return true;
    }

    public async Task<UserDto> GetCurrentUserProfileAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await _context.Users
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                    .ThenInclude(r => r.RolePermissions)
                        .ThenInclude(rp => rp.Permission)
            .Include(u => u.CustomerProfile)
            .Include(u => u.GarageUser)
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user == null)
        {
            throw new KeyNotFoundException($"User with ID {userId} not found.");
        }

        var roles = user.UserRoles.Select(ur => ur.Role.Name).Distinct().ToList();
        var permissions = user.UserRoles
            .SelectMany(ur => ur.Role.RolePermissions.Select(rp => rp.Permission.Code))
            .Distinct()
            .ToList();

        if (!permissions.Any())
        {
            foreach (var role in roles)
            {
                permissions.AddRange(AppPermissions.GetDefaultPermissionsForRole(role));
            }
            permissions = permissions.Distinct().ToList();
        }

        return new UserDto(
            user.Id,
            user.Email,
            user.FullName,
            user.PhoneNumber,
            roles,
            permissions,
            user.CustomerProfile?.Id,
            user.GarageUser?.GarageId,
            user.GarageUser?.RoleName,
            user.IsActive,
            user.CreatedAtUtc);
    }

    public async Task SetUserActiveStatusAsync(
        Guid userId,
        bool isActive,
        Guid adminUserId,
        string? ipAddress = null,
        CancellationToken cancellationToken = default)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user == null)
        {
            throw new KeyNotFoundException($"User with ID {userId} not found.");
        }

        user.SetActive(isActive);

        if (!isActive)
        {
            var activeTokens = await _context.RefreshTokens
                .Where(rt => rt.UserId == user.Id && rt.RevokedAtUtc == null)
                .ToListAsync(cancellationToken);

            foreach (var t in activeTokens)
            {
                t.Revoke("Account suspended by administrator");
            }
        }

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: isActive ? AuditActions.AccountActivated : AuditActions.AccountSuspended,
            userId: user.Id,
            userEmail: user.Email,
            details: $"Status updated to Active={isActive} by Admin {adminUserId}",
            ipAddress: ipAddress,
            cancellationToken: cancellationToken);
    }
}
