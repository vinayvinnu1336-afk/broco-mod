using BroCoMod.Application.Common;
using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Constants;
using BroCoMod.Domain.Entities.Identity;
using NotificationChannel = BroCoMod.Domain.Enums.NotificationChannel;
using Microsoft.EntityFrameworkCore;
using BroCoMod.Infrastructure.Services.Messaging;
using Microsoft.Extensions.Logging;

namespace BroCoMod.Infrastructure.Services;

public class IdentityService : IIdentityService
{
    private readonly IApplicationDbContext _context;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ITokenService _tokenService;
    private readonly IOtpProvider _otpProvider;
    private readonly IAuditService _auditService;
    private readonly IEnumerable<INotificationProvider> _notificationProviders;
    private readonly ILogger<IdentityService> _logger;
    private readonly IOtpDelivery? _otpDelivery;
    private readonly OtpRequestLimiter? _otpLimiter;

    private const string PasswordResetPurpose = "PasswordReset";

    public IdentityService(
        IApplicationDbContext context,
        IPasswordHasher _passwordHasher,
        ITokenService tokenService,
        IOtpProvider otpProvider,
        IAuditService auditService,
        ILogger<IdentityService> logger,
        IEnumerable<INotificationProvider>? notificationProviders = null,
        IOtpDelivery? otpDelivery = null,
        OtpRequestLimiter? otpLimiter = null)
    {
        _notificationProviders = notificationProviders ?? Array.Empty<INotificationProvider>();
        _otpDelivery = otpDelivery;
        _otpLimiter = otpLimiter;
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

        // Public sign-up may only create car owners and new garage owners. Advisors, admins and garage
        // staff are created by administrators; accepting any role here would let anyone become an admin.
        var requestedRoleName = string.IsNullOrWhiteSpace(request.Role)
            ? AppRoles.Customer
            : request.Role.Trim().ToUpperInvariant();

        if (requestedRoleName != AppRoles.Customer && requestedRoleName != AppRoles.GarageOwner)
        {
            throw new InvalidOperationException("This account type cannot be created through sign-up.");
        }

        if (requestedRoleName == AppRoles.GarageOwner && string.IsNullOrWhiteSpace(request.GarageName))
        {
            throw new InvalidOperationException("Garage name is required to register a garage.");
        }

        var phoneNumber = IndianMobile.Normalize(request.PhoneNumber)
            ?? throw new InvalidOperationException(IndianMobile.InvalidMessage);

        if (PasswordPolicy.Validate(request.Password) is { } passwordProblem)
        {
            throw new InvalidOperationException(passwordProblem);
        }

        // The mobile number is how people sign in, so it must lead to exactly one active account.
        if (await _context.Users.IsMobileTakenAsync(IndianMobile.NationalNumber(phoneNumber)!, cancellationToken: cancellationToken))
        {
            throw new InvalidOperationException(IndianMobile.AlreadyRegisteredMessage);
        }

        var role = await _context.Roles
            .FirstOrDefaultAsync(r => r.NormalizedName == requestedRoleName, cancellationToken)
            ?? throw new InvalidOperationException("Registration is temporarily unavailable. Please try again later.");

        var passwordHash = _passwordHasher.HashPassword(request.Password, out var salt);
        var user = new User(
            email: request.Email,
            fullName: request.FullName,
            phoneNumber: phoneNumber,
            passwordHash: passwordHash,
            salt: salt);

        _context.Users.Add(user);

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
        else
        {
            // New garage owner: register a new garage that stays out of customer matching until an
            // administrator verifies it. Never attach the user to an existing garage from client input.
            var hasLocation = request.Latitude is >= -90 and <= 90 && request.Longitude is >= -180 and <= 180
                              && !(request.Latitude == 0 && request.Longitude == 0);
            var garage = new Domain.Entities.Garage(
                name: request.GarageName!.Trim(),
                email: request.Email.Trim(),
                phoneNumber: phoneNumber,
                address: request.Address?.Trim() ?? string.Empty,
                longitude: hasLocation ? request.Longitude!.Value : 0,
                latitude: hasLocation ? request.Latitude!.Value : 0,
                isVerified: false,
                isOperational: hasLocation);
            _context.Garages.Add(garage);

            garageId = garage.Id;
            garageRole = AppRoles.GarageOwner;
            _context.GarageUsers.Add(new GarageUser(user.Id, garage.Id, AppRoles.GarageOwner, "Owner"));
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
        var byMobile = !string.IsNullOrWhiteSpace(request.MobileNumber);
        if (!byMobile && string.IsNullOrWhiteSpace(request.Email))
        {
            throw new UnauthorizedAccessException("Enter your mobile number or email, and your password.");
        }

        // Same wording whether the account is missing or the password is wrong, so neither reveals who is registered.
        var invalidCredentials = byMobile ? "Invalid mobile number or password." : "Invalid email or password.";

        var users = _context.Users
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                    .ThenInclude(r => r.RolePermissions)
                        .ThenInclude(rp => rp.Permission)
            .Include(u => u.CustomerProfile)
            .Include(u => u.GarageUser)
            .Include(u => u.AdvisorProfile);

        User? user;
        if (byMobile)
        {
            var nationalNumber = IndianMobile.NationalNumber(request.MobileNumber);
            var matches = nationalNumber == null
                ? new List<User>()
                : await users.FindByMobileAsync(nationalNumber, cancellationToken);
            var active = matches.Where(u => u.IsActive).ToList();

            if (active.Count > 1)
            {
                // Older accounts can share a number. Never guess which one is meant; point to email sign-in.
                // Only someone who knows one of the passwords is told why, so the message cannot be used to
                // find out which numbers are registered. No account is charged a failed attempt: it is unknown
                // which one was being tried, and the rate limit still applies.
                var knowsAPassword = active.Any(u =>
                    !u.IsLockedOut() && _passwordHasher.VerifyPassword(request.Password, u.PasswordHash, u.Salt));

                await _auditService.LogAsync(
                    action: AuditActions.LoginFailed,
                    details: $"Mobile sign-in refused: number ending {nationalNumber![^4..]} is shared by {active.Count} active accounts",
                    ipAddress: ipAddress,
                    cancellationToken: cancellationToken);

                throw new UnauthorizedAccessException(knowsAPassword ? IndianMobile.SharedByAccountsMessage : invalidCredentials);
            }

            user = active.Count == 1 ? active[0] : matches.FirstOrDefault();
        }
        else
        {
            var normalizedEmail = request.Email!.Trim().ToUpperInvariant();
            user = await users.FirstOrDefaultAsync(u => u.NormalizedEmail == normalizedEmail, cancellationToken);
        }

        if (user == null)
        {
            var mobileTail = IndianMobile.NationalNumber(request.MobileNumber) is { } n ? n[^4..] : null;
            await _auditService.LogAsync(
                action: AuditActions.LoginFailed,
                userEmail: byMobile ? null : request.Email,
                details: byMobile
                    ? $"User not found for mobile {(mobileTail != null ? $"ending {mobileTail}" : "(not a valid Indian mobile)")}"
                    : "User not found",
                ipAddress: ipAddress,
                cancellationToken: cancellationToken);

            throw new UnauthorizedAccessException(invalidCredentials);
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
                details: $"Invalid password. Failed attempts: {user.FailedLoginAttempts}{(byMobile ? " (mobile sign-in)" : string.Empty)}",
                ipAddress: ipAddress,
                cancellationToken: cancellationToken);

            throw new UnauthorizedAccessException(invalidCredentials);
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
            details: $"Successful {(byMobile ? "mobile " : string.Empty)}login for roles: {string.Join(", ", roles)}",
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

        // Counted before the lookup, so the limit behaves the same for unknown addresses.
        if (_otpLimiter != null)
        {
            await _otpLimiter.AcquireAsync(PasswordResetPurpose, $"email:{normalizedEmail}", ipAddress, cancellationToken);
        }

        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.NormalizedEmail == normalizedEmail, cancellationToken);

        if (user == null)
        {
            // Same observable behaviour as a real account to prevent email enumeration.
            return string.Empty;
        }

        var otp = await _otpProvider.GenerateOtpAsync(user.Email, PasswordResetPurpose, cancellationToken);

        // Deliver the code by email (the address the user typed). It is never returned to the HTTP caller.
        var message = new NotificationMessage(
            UserId: user.Id,
            Title: "Your BroCo password reset code",
            Message: $"Your password reset code is {otp}. It expires in 10 minutes. If you did not request this, ignore this message.",
            Type: EmailTemplates.PasswordResetType,
            Channel: NotificationChannel.Email,
            Data: new Dictionary<string, string> { ["code"] = otp });
        var delivered = false;
        foreach (var provider in _notificationProviders.Where(p => p.Channel == NotificationChannel.Email))
        {
            try
            {
                delivered |= await provider.SendAsync(message, cancellationToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Could not email a password reset code to user {UserId}", user.Id);
            }
        }
        if (!delivered)
        {
            _logger.LogWarning("Password reset code for user {UserId} was not emailed (email not set up or refused). See docs/integrations-setup.md.", user.Id);
        }

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
        // Checked before the code is used up, so a too-short password can be corrected and resent.
        if (PasswordPolicy.Validate(newPassword) is { } passwordProblem)
        {
            throw new ArgumentException(passwordProblem);
        }

        var isValid = await _otpProvider.VerifyOtpAsync(email, token, PasswordResetPurpose, cancellationToken);
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

    /// <summary>The OTP store key for a mobile, kept apart from email destinations.</summary>
    public static string MobileOtpDestination(string nationalNumber) => $"mobile:{nationalNumber}";

    public async Task RequestPasswordResetByMobileAsync(
        string mobileNumber,
        string? ipAddress = null,
        CancellationToken cancellationToken = default)
    {
        var nationalNumber = IndianMobile.NationalNumber(mobileNumber)
            ?? throw new ArgumentException(IndianMobile.InvalidMessage);

        // Counted for every number, registered or not, so the limit reveals nothing and caps the SMS bill.
        if (_otpLimiter != null)
        {
            await _otpLimiter.AcquireAsync(PasswordResetPurpose, MobileOtpDestination(nationalNumber), ipAddress, cancellationToken);
        }

        var active = (await _context.Users.AsNoTracking().FindByMobileAsync(nationalNumber, cancellationToken))
            .Where(u => u.IsActive)
            .ToList();

        if (active.Count != 1)
        {
            // No account, or older accounts sharing the number: send nothing (never guess which account is meant).
            // The caller gets the same answer either way; its wording points shared numbers to email reset.
            await _auditService.LogAsync(
                action: AuditActions.PasswordResetRequested,
                details: active.Count == 0
                    ? $"Password reset by mobile ending {nationalNumber[^4..]}: no active account, nothing sent"
                    : $"Password reset by mobile ending {nationalNumber[^4..]}: shared by {active.Count} active accounts, nothing sent",
                ipAddress: ipAddress,
                cancellationToken: cancellationToken);
            return;
        }

        var user = active[0];
        var otp = await _otpProvider.GenerateOtpAsync(MobileOtpDestination(nationalNumber), PasswordResetPurpose, cancellationToken);

        string delivery;
        if (_otpDelivery == null)
        {
            delivery = "no provider";
        }
        else
        {
            var result = await _otpDelivery.SendOtpAsync(nationalNumber, otp, cancellationToken);
            delivery = result.Delivered ? result.Channel?.ToString() ?? "sent" : result.Attempts.Count == 0 ? "no provider" : "failed";
        }
        if (delivery is "no provider" or "failed")
        {
            _logger.LogWarning("Password reset code for user {UserId} could not be sent by WhatsApp or SMS ({Delivery}). See docs/integrations-setup.md.", user.Id, delivery);
        }

        await _auditService.LogAsync(
            action: AuditActions.PasswordResetRequested,
            userId: user.Id,
            userEmail: user.Email,
            details: $"Password reset code requested by mobile (delivery: {delivery})",
            ipAddress: ipAddress,
            cancellationToken: cancellationToken);
    }

    public async Task<bool> ResetPasswordByMobileAsync(
        string mobileNumber,
        string code,
        string newPassword,
        string? ipAddress = null,
        CancellationToken cancellationToken = default)
    {
        // Checked before the code is used up, so a too-short password can be corrected and resent.
        if (PasswordPolicy.Validate(newPassword) is { } passwordProblem)
        {
            throw new ArgumentException(passwordProblem);
        }

        var nationalNumber = IndianMobile.NationalNumber(mobileNumber);
        if (nationalNumber == null || string.IsNullOrWhiteSpace(code)) return false;

        // Wrong guesses count against the code (5 at most) inside the OTP store.
        if (!await _otpProvider.VerifyOtpAsync(MobileOtpDestination(nationalNumber), code, PasswordResetPurpose, cancellationToken))
        {
            return false;
        }

        var active = (await _context.Users.FindByMobileAsync(nationalNumber, cancellationToken)).Where(u => u.IsActive).ToList();
        if (active.Count != 1) return false;
        var user = active[0];

        var newHash = _passwordHasher.HashPassword(newPassword, out var newSalt);
        user.UpdatePassword(newHash, newSalt);

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
            details: "Password reset completed with a code sent to the mobile",
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
