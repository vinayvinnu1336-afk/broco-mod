using System.Net.Mail;
using System.Security.Cryptography;
using BroCoMod.Application.Common;
using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Constants;
using BroCoMod.Domain.Entities.Identity;
using BroCoMod.Domain.Enums;
using UserRole = BroCoMod.Domain.Entities.Identity.UserRole;
using BroCoMod.Infrastructure.Services.Messaging;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace BroCoMod.Infrastructure.Services;

/// <summary>
/// Advisor accounts made from the admin portal: a new account (user + ADVISOR role + AdvisorProfile), or an
/// existing customer account switched to advisor. Passwords are only ever held as a hash; a generated one is
/// returned to the admin once and emailed to the advisor, and never written to logs or audit details.
/// </summary>
public class AdminAdvisorAccountService : IAdminAdvisorAccountService
{
    public const string DefaultSpecialization = "General Automotive";
    public const int DefaultMaxAssignedRequests = 25;
    public const int MaxAssignedRequestsLimit = 200;

    private const string EmployeeCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private readonly IApplicationDbContext _context;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IAuditService _auditService;
    private readonly IEmailSender? _emailSender;
    private readonly IConfiguration? _configuration;
    private readonly ILogger<AdminAdvisorAccountService>? _logger;
    private readonly IServiceAreaService? _serviceAreas;
    private readonly INotificationService? _notifications;

    public AdminAdvisorAccountService(
        IApplicationDbContext context,
        IPasswordHasher passwordHasher,
        IAuditService auditService,
        IEmailSender? emailSender = null,
        IConfiguration? configuration = null,
        ILogger<AdminAdvisorAccountService>? logger = null,
        IServiceAreaService? serviceAreas = null,
        INotificationService? notifications = null)
    {
        _serviceAreas = serviceAreas;
        _notifications = notifications;
        _context = context;
        _passwordHasher = passwordHasher;
        _auditService = auditService;
        _emailSender = emailSender;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<CreatedAdvisorDto> CreateAdvisorAsync(
        CreateAdvisorRequest request, Guid adminId, string? ipAddress = null, CancellationToken cancellationToken = default)
    {
        var fullName = ValidName(request.FullName);
        var phoneNumber = IndianMobile.Normalize(request.MobileNumber)
            ?? throw Invalid(IndianMobile.InvalidMessage);
        var email = ValidEmail(request.Email);
        var specialization = ValidSpecialization(request.Specialization);
        var maxAssigned = ValidMaxAssigned(request.MaxAssignedRequests);
        var city = ValidCity(request.City);

        var passwordGenerated = string.IsNullOrEmpty(request.Password);
        var password = passwordGenerated ? TemporaryPassword.Generate() : request.Password!;
        if (!passwordGenerated && PasswordPolicy.Validate(password) is { } passwordProblem)
        {
            throw Invalid(passwordProblem);
        }

        await EnsureEmailAndMobileFreeAsync(email, IndianMobile.NationalNumber(phoneNumber)!, cancellationToken);

        var advisorRole = await AdvisorRoleAsync(cancellationToken);
        var hash = _passwordHasher.HashPassword(password, out var salt);
        var user = new User(email, fullName, phoneNumber, hash, salt);
        var profile = new AdvisorProfile(user.Id, await NewEmployeeCodeAsync(cancellationToken), specialization, maxAssigned, city);

        _context.Users.Add(user);
        _context.UserRoles.Add(new UserRole { User = user, Role = advisorRole });
        _context.AdvisorProfiles.Add(profile);

        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // Another request took the email between the check and the insert (unique index on NormalizedEmail).
            throw new AdvisorAccountException(AdvisorAccountErrors.EmailTaken, "This email is already used by another account.", 409);
        }

        var (emailSent, emailStatus) = await SendWelcomeEmailAsync(user, password, cancellationToken);

        var admin = await AdminEmailAsync(adminId, cancellationToken);
        await _auditService.LogAsync(
            action: "ADMIN_ADVISOR_CREATED",
            userId: adminId,
            userEmail: admin,
            entityName: nameof(AdvisorProfile),
            entityId: profile.Id.ToString(),
            details: $"Advisor '{user.FullName}' ({user.Email}, mobile ending {phoneNumber[^4..]}) created with employee code {profile.EmployeeCode} in {profile.City}. " +
                     $"Password {(passwordGenerated ? "generated" : "set by the administrator")}; welcome email {(emailSent ? "sent" : "not sent")}.",
            ipAddress: ipAddress,
            cancellationToken: cancellationToken);

        return new CreatedAdvisorDto(
            Advisor: await AdvisorDtoAsync(profile.Id, cancellationToken),
            LoginMobile: phoneNumber,
            TemporaryPassword: passwordGenerated ? password : null,
            PasswordGenerated: passwordGenerated,
            WelcomeEmailSent: emailSent,
            WelcomeEmailStatus: emailStatus);
    }

    public async Task<PromotedAdvisorDto> PromoteToAdvisorAsync(
        PromoteToAdvisorRequest request, Guid adminId, string? ipAddress = null, CancellationToken cancellationToken = default)
    {
        var specialization = request.Specialization is null ? null : ValidSpecialization(request.Specialization);
        int? maxAssigned = request.MaxAssignedRequests is null ? null : ValidMaxAssigned(request.MaxAssignedRequests);
        var city = string.IsNullOrWhiteSpace(request.City) ? null : ValidCity(request.City);

        var user = await FindAccountForPromotionAsync(request, cancellationToken);
        var roles = user.UserRoles.Select(ur => ur.Role.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);

        if (roles.Contains(AppRoles.SuperAdmin) || roles.Any(AppRoles.IsGarageRole) || user.GarageUser != null)
        {
            throw new AdvisorAccountException(AdvisorAccountErrors.NotEligible,
                "Only customer accounts can be made advisors. This account belongs to an administrator or a garage.");
        }
        if (!roles.Contains(AppRoles.Customer) && !roles.Contains(AppRoles.Advisor))
        {
            throw new AdvisorAccountException(AdvisorAccountErrors.NotEligible, "Only customer accounts can be made advisors.");
        }

        var alreadyAdvisor = roles.Contains(AppRoles.Advisor) && !roles.Contains(AppRoles.Customer) && user.AdvisorProfile != null;
        if (alreadyAdvisor)
        {
            return new PromotedAdvisorDto(await AdvisorDtoAsync(user.AdvisorProfile!.Id, cancellationToken), AlreadyAdvisor: true);
        }

        foreach (var customerRole in user.UserRoles.Where(ur => ur.Role.Name == AppRoles.Customer).ToList())
        {
            _context.UserRoles.Remove(customerRole);
        }
        if (!roles.Contains(AppRoles.Advisor))
        {
            _context.UserRoles.Add(new UserRole { UserId = user.Id, Role = await AdvisorRoleAsync(cancellationToken) });
        }

        var profile = user.AdvisorProfile;
        if (profile == null)
        {
            profile = new AdvisorProfile(user.Id, await NewEmployeeCodeAsync(cancellationToken),
                specialization ?? DefaultSpecialization, maxAssigned ?? DefaultMaxAssignedRequests,
                city ?? ValidCity(null));
            _context.AdvisorProfiles.Add(profile);
        }
        else
        {
            if (profile.IsRemoved)
            {
                throw new AdvisorAccountException(AdvisorAccountErrors.NotEligible, "This advisor was removed and can't be made an advisor again.");
            }
            if (specialization != null || maxAssigned != null)
            {
                profile.UpdateDetails(specialization ?? profile.Specialization, maxAssigned ?? profile.MaxAssignedRequests);
            }
            if (city != null) profile.SetCity(city);
        }

        // Sessions signed in as a customer end, so the next sign-in carries the advisor role.
        var now = DateTime.UtcNow;
        var sessions = await _context.RefreshTokens
            .Where(t => t.UserId == user.Id && t.RevokedAtUtc == null && t.ExpiresAtUtc > now)
            .ToListAsync(cancellationToken);
        foreach (var session in sessions) session.Revoke("Account changed to advisor");

        await _context.SaveChangesAsync(cancellationToken);

        var admin = await AdminEmailAsync(adminId, cancellationToken);
        await _auditService.LogAsync(
            action: "ADMIN_ADVISOR_PROMOTED",
            userId: adminId,
            userEmail: admin,
            entityName: nameof(AdvisorProfile),
            entityId: profile.Id.ToString(),
            details: $"Customer account '{user.FullName}' ({user.Email}) changed to advisor with employee code {profile.EmployeeCode}.",
            ipAddress: ipAddress,
            cancellationToken: cancellationToken);

        return new PromotedAdvisorDto(await AdvisorDtoAsync(profile.Id, cancellationToken), AlreadyAdvisor: false);
    }

    public async Task<AdminAdvisorListDto> UpdateAdvisorAsync(
        Guid id, UpdateAdvisorRequest request, Guid adminId, string? ipAddress = null, CancellationToken cancellationToken = default)
    {
        var profile = await _context.AdvisorProfiles
            .Include(a => a.User)
            .FirstOrDefaultAsync(a => a.Id == id || a.UserId == id, cancellationToken)
            ?? throw new AdvisorAccountException(AdvisorAccountErrors.NotFound, "Advisor not found.", 404);
        if (profile.IsRemoved) throw new AdvisorAccountException(AdvisorAccountErrors.NotFound, "Advisor not found.", 404);

        var fullName = request.FullName is null ? profile.User.FullName : ValidName(request.FullName);
        var specialization = request.Specialization is null ? profile.Specialization : ValidSpecialization(request.Specialization);
        var maxAssigned = request.MaxAssignedRequests is null ? profile.MaxAssignedRequests : ValidMaxAssigned(request.MaxAssignedRequests);
        var city = request.City is null ? profile.City : ValidCity(request.City);

        var changes = new List<string>();
        if (fullName != profile.User.FullName) changes.Add($"name '{profile.User.FullName}' to '{fullName}'");
        if (specialization != profile.Specialization) changes.Add($"speciality '{profile.Specialization}' to '{specialization}'");
        if (maxAssigned != profile.MaxAssignedRequests) changes.Add($"max open requests {profile.MaxAssignedRequests} to {maxAssigned}");
        // Open requests they already own stay with them (and visible to them); new ones come from the new city.
        if (city != profile.City) changes.Add($"city '{profile.City}' to '{city}'");

        if (changes.Count > 0)
        {
            if (fullName != profile.User.FullName) profile.User.UpdateProfile(fullName, profile.User.PhoneNumber);
            profile.UpdateDetails(specialization, maxAssigned);
            if (city != profile.City) profile.SetCity(city);
            await _context.SaveChangesAsync(cancellationToken);

            await _auditService.LogAsync(
                action: "ADMIN_ADVISOR_UPDATED",
                userId: adminId,
                userEmail: await AdminEmailAsync(adminId, cancellationToken),
                entityName: nameof(AdvisorProfile),
                entityId: profile.Id.ToString(),
                details: $"Advisor '{fullName}' updated: {string.Join("; ", changes)}.",
                ipAddress: ipAddress,
                cancellationToken: cancellationToken);
        }

        return await AdvisorDtoAsync(profile.Id, cancellationToken);
    }

    // ------------------------------------------------------------------ checks

    /// <summary>
    /// The email (unique across all accounts) and mobile (one active account each) must be free. When the one
    /// account holding them is a plain customer account, the error says so, so the admin can promote it instead.
    /// </summary>
    private async Task EnsureEmailAndMobileFreeAsync(string email, string nationalNumber, CancellationToken cancellationToken)
    {
        var normalizedEmail = email.ToUpperInvariant();
        var byEmail = await AccountsWithRoles()
            .FirstOrDefaultAsync(u => u.NormalizedEmail == normalizedEmail, cancellationToken);
        var byMobile = await AccountsWithRoles()
            .Where(u => u.IsActive)
            .FindByMobileAsync(nationalNumber, cancellationToken);

        if (byEmail is { IsActive: false })
        {
            throw new AdvisorAccountException(AdvisorAccountErrors.EmailTaken,
                "This email belongs to a deactivated account. Use a different email, or reactivate that account.", 409);
        }

        var holders = byMobile.Concat(byEmail is null ? Array.Empty<User>() : new[] { byEmail })
            .DistinctBy(u => u.Id)
            .ToList();
        if (holders.Count == 0) return;

        if (holders.Count > 1)
        {
            throw new AdvisorAccountException(AdvisorAccountErrors.EmailTaken,
                "This email and this mobile number already belong to two different accounts. Use a different email and mobile number.", 409);
        }

        var holder = holders[0];
        var matchedBy = byEmail?.Id == holder.Id
            ? (byMobile.Any(u => u.Id == holder.Id) ? "email and mobile" : "email")
            : "mobile";
        var roles = holder.UserRoles.Select(ur => ur.Role.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);

        if (roles.Contains(AppRoles.Advisor))
        {
            throw new AdvisorAccountException(AdvisorAccountErrors.AlreadyAdvisor,
                $"{holder.FullName} is already an advisor with this {matchedBy}.", 409);
        }

        if (IsCustomerOnly(holder, roles))
        {
            throw new AdvisorAccountException(AdvisorAccountErrors.ExistingCustomer,
                $"{holder.FullName} already has a customer account with this {matchedBy}. You can make that account an advisor instead.",
                409,
                new ExistingCustomerAccountDto(holder.Id, holder.FullName, holder.Email, holder.PhoneNumber, matchedBy));
        }

        throw matchedBy == "mobile"
            ? new AdvisorAccountException(AdvisorAccountErrors.MobileTaken, "This mobile number is already used by another account.", 409)
            : new AdvisorAccountException(AdvisorAccountErrors.EmailTaken, "This email is already used by another account.", 409);
    }

    private async Task<User> FindAccountForPromotionAsync(PromoteToAdvisorRequest request, CancellationToken cancellationToken)
    {
        User? user;
        if (!string.IsNullOrWhiteSpace(request.Email))
        {
            var normalizedEmail = request.Email.Trim().ToUpperInvariant();
            user = await AccountsWithRoles().FirstOrDefaultAsync(u => u.NormalizedEmail == normalizedEmail, cancellationToken);
        }
        else if (!string.IsNullOrWhiteSpace(request.MobileNumber))
        {
            var national = IndianMobile.NationalNumber(request.MobileNumber) ?? throw Invalid(IndianMobile.InvalidMessage);
            var matches = await AccountsWithRoles().Where(u => u.IsActive).FindByMobileAsync(national, cancellationToken);
            if (matches.Count > 1)
            {
                throw new AdvisorAccountException(AdvisorAccountErrors.NotEligible,
                    "This mobile number is linked to more than one account. Use the account's email instead.");
            }
            user = matches.FirstOrDefault();
        }
        else
        {
            throw Invalid("Enter the email or mobile number of the customer account.");
        }

        if (user == null)
        {
            throw new AdvisorAccountException(AdvisorAccountErrors.NotFound, "No account found with these details.", 404);
        }
        if (!user.IsActive)
        {
            throw new AdvisorAccountException(AdvisorAccountErrors.NotEligible, "This account is deactivated. Reactivate it first.");
        }
        return user;
    }

    private static bool IsCustomerOnly(User user, IReadOnlySet<string> roles) =>
        user.GarageUser == null && roles.Count > 0 && roles.All(r => r == AppRoles.Customer);

    private IQueryable<User> AccountsWithRoles() => _context.Users
        .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
        .Include(u => u.GarageUser)
        .Include(u => u.AdvisorProfile);

    private static AdvisorAccountException Invalid(string message) =>
        new(AdvisorAccountErrors.Validation, message);

    private static string ValidName(string? value)
    {
        var name = string.Join(' ', (value ?? string.Empty).Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
        if (name.Length < 2) throw Invalid("Enter the advisor's full name.");
        if (name.Length > 200) throw Invalid("Name must be 200 characters or fewer.");
        return name;
    }

    private static string ValidEmail(string? value)
    {
        var email = (value ?? string.Empty).Trim();
        if (email.Length == 0) throw Invalid("Enter the advisor's email.");
        if (email.Length > 256
            || !MailAddress.TryCreate(email, out var parsed)
            || !string.Equals(parsed.Address, email, StringComparison.OrdinalIgnoreCase)
            || !parsed.Host.Contains('.'))
        {
            throw Invalid("Enter a valid email address.");
        }
        return email.ToLowerInvariant();
    }

    private static string ValidSpecialization(string? value)
    {
        var specialization = (value ?? string.Empty).Trim();
        if (specialization.Length == 0) return DefaultSpecialization;
        if (specialization.Length > 100) throw Invalid("Speciality must be 100 characters or fewer.");
        return specialization;
    }

    private static int ValidMaxAssigned(int? value)
    {
        var max = value ?? DefaultMaxAssignedRequests;
        if (max is < 1 or > MaxAssignedRequestsLimit)
        {
            throw Invalid($"Max open requests must be between 1 and {MaxAssignedRequestsLimit}.");
        }
        return max;
    }

    /// <summary>One of the live service areas, in its configured spelling.</summary>
    private string ValidCity(string? value)
    {
        var city = (value ?? string.Empty).Trim();
        if (city.Length == 0) throw Invalid("Choose the city the advisor works in.");
        if (_serviceAreas == null) return city.Length <= AdvisorProfile.CityMaxLength ? city : throw Invalid("City is too long.");
        return _serviceAreas.CanonicalLiveCity(city)
            ?? throw Invalid($"Choose one of our cities: {string.Join(", ", _serviceAreas.GetAreas().Where(a => a.IsLive).Select(a => a.City))}.");
    }

    // ------------------------------------------------------------------ remove

    private static bool IsOpen(ServiceRequestStatus status) =>
        status != ServiceRequestStatus.Completed && status != ServiceRequestStatus.Cancelled;

    private async Task<AdvisorProfile> RemovableAdvisorAsync(Guid id, Guid adminId, CancellationToken cancellationToken)
    {
        var profile = await _context.AdvisorProfiles
            .Include(a => a.User).ThenInclude(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(a => a.Id == id || a.UserId == id, cancellationToken);
        if (profile == null || profile.IsRemoved)
        {
            throw new AdvisorAccountException(AdvisorAccountErrors.NotFound, "Advisor not found.", 404);
        }
        if (profile.UserId == adminId)
        {
            throw new AdvisorAccountException(AdvisorAccountErrors.CannotRemoveSelf, "You can't remove your own account.");
        }
        if (profile.User.UserRoles.Any(ur => ur.Role.Name == AppRoles.SuperAdmin) || profile.User.UserRoles.All(ur => ur.Role.Name != AppRoles.Advisor))
        {
            throw new AdvisorAccountException(AdvisorAccountErrors.NotEligible, "Only advisor accounts can be removed here.");
        }
        return profile;
    }

    public async Task<AdvisorRemovalPreviewDto> GetRemovalPreviewAsync(Guid id, Guid adminId, CancellationToken cancellationToken = default)
    {
        var profile = await RemovableAdvisorAsync(id, adminId, cancellationToken);
        var open = await _context.ServiceRequests.CountAsync(sr =>
            sr.AssignedAdvisorId == profile.Id && sr.Status != ServiceRequestStatus.Completed && sr.Status != ServiceRequestStatus.Cancelled, cancellationToken);
        var others = (await AdvisorAssignment.GetEligibleLoadsAsync(_context, cancellationToken))
            .Count(l => l.AdvisorId != profile.Id && string.Equals(l.City, profile.City, StringComparison.OrdinalIgnoreCase));
        return new AdvisorRemovalPreviewDto(profile.Id, profile.User.FullName, profile.City, open, others);
    }

    public async Task<RemovedAdvisorDto> RemoveAdvisorAsync(Guid id, Guid adminId, string? ipAddress = null, CancellationToken cancellationToken = default)
    {
        var profile = await RemovableAdvisorAsync(id, adminId, cancellationToken);

        var openRequests = await _context.ServiceRequests
            .Where(sr => sr.AssignedAdvisorId == profile.Id && sr.Status != ServiceRequestStatus.Completed && sr.Status != ServiceRequestStatus.Cancelled)
            .OrderBy(sr => sr.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        // The same capacity-aware picker new bookings use: the request's city first, another city only when it has nobody.
        var loads = (await AdvisorAssignment.GetEligibleLoadsAsync(_context, cancellationToken))
            .Where(l => l.AdvisorId != profile.Id)
            .ToList();
        var moved = new Dictionary<Guid, int>();
        var outsideCity = 0;
        var unassigned = 0;
        foreach (var request in openRequests.Where(r => IsOpen(r.Status)))
        {
            var city = request.City.Length > 0 ? request.City : profile.City;
            var next = AdvisorAssignment.Pick(loads, city);
            if (next == null)
            {
                request.ReleaseResponsibleAdvisor();
                unassigned++;
                continue;
            }

            request.SetResponsibleAdvisor(next.Value);
            moved[next.Value] = moved.GetValueOrDefault(next.Value) + 1;
            var index = loads.FindIndex(l => l.AdvisorId == next.Value);
            if (!string.Equals(loads[index].City, city, StringComparison.OrdinalIgnoreCase)) outsideCity++;
            loads[index] = loads[index] with { OpenRequests = loads[index].OpenRequests + 1 };
        }

        // Signed out everywhere and never able to sign in again; nothing else about the account is changed.
        profile.MarkRemoved();
        profile.User.SetActive(false);
        var now = DateTime.UtcNow;
        var sessions = await _context.RefreshTokens
            .Where(t => t.UserId == profile.UserId && t.RevokedAtUtc == null && t.ExpiresAtUtc > now)
            .ToListAsync(cancellationToken);
        foreach (var session in sessions) session.Revoke("Advisor removed by an administrator");

        await _context.SaveChangesAsync(cancellationToken);

        var reassignments = await _context.AdvisorProfiles.AsNoTracking()
            .Where(a => moved.Keys.Contains(a.Id))
            .Select(a => new { a.Id, a.UserId, a.User.FullName, a.City })
            .ToListAsync(cancellationToken);
        var summary = reassignments
            .Select(a => new AdvisorReassignmentDto(a.Id, a.FullName, a.City, moved[a.Id]))
            .OrderByDescending(r => r.RequestsCount).ThenBy(r => r.FullName)
            .ToList();

        var details = $"Advisor '{profile.User.FullName}' ({profile.User.Email}, {profile.City}) removed. " +
                      (openRequests.Count == 0
                          ? "They had no open requests."
                          : $"{openRequests.Count - unassigned} open request(s) reassigned" +
                            (summary.Count > 0 ? $": {string.Join(", ", summary.Select(r => $"{r.RequestsCount} to {r.FullName} ({r.City})"))}" : string.Empty) +
                            (unassigned > 0 ? $"; {unassigned} left without an advisor (no active advisor available)" : string.Empty) + ".");
        await _auditService.LogAsync(
            action: "ADMIN_ADVISOR_REMOVED",
            userId: adminId,
            userEmail: await AdminEmailAsync(adminId, cancellationToken),
            entityName: nameof(AdvisorProfile),
            entityId: profile.Id.ToString(),
            details: details,
            ipAddress: ipAddress,
            cancellationToken: cancellationToken);

        if (_notifications != null)
        {
            foreach (var r in reassignments)
            {
                try
                {
                    await _notifications.SendInAppNotificationAsync(r.UserId, "Bookings moved to you",
                        $"{moved[r.Id]} open booking{(moved[r.Id] == 1 ? " was" : "s were")} moved to you from an advisor who left.",
                        "AdvisorReassigned", cancellationToken: cancellationToken);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    _logger?.LogWarning(ex, "Could not notify advisor {AdvisorId} about reassigned requests.", r.Id);
                }
            }
        }

        return new RemovedAdvisorDto(profile.Id, profile.User.FullName, profile.City,
            openRequests.Count - unassigned, outsideCity, unassigned, summary);
    }

    // ------------------------------------------------------------------ helpers

    private async Task<Role> AdvisorRoleAsync(CancellationToken cancellationToken) =>
        await _context.Roles.FirstOrDefaultAsync(r => r.NormalizedName == AppRoles.Advisor, cancellationToken)
        ?? throw new InvalidOperationException("The ADVISOR role is missing from the Roles table.");

    private async Task<string> NewEmployeeCodeAsync(CancellationToken cancellationToken)
    {
        for (var attempt = 0; attempt < 10; attempt++)
        {
            var code = "ADV-" + new string(Enumerable.Range(0, 6)
                .Select(_ => EmployeeCodeAlphabet[RandomNumberGenerator.GetInt32(EmployeeCodeAlphabet.Length)])
                .ToArray());
            if (!await _context.AdvisorProfiles.AnyAsync(a => a.EmployeeCode == code, cancellationToken)) return code;
        }
        throw new InvalidOperationException("Could not pick a unique employee code.");
    }

    private async Task<string> AdminEmailAsync(Guid adminId, CancellationToken cancellationToken) =>
        await _context.Users.Where(u => u.Id == adminId).Select(u => u.Email).FirstOrDefaultAsync(cancellationToken) ?? "Admin";

    private async Task<(bool Sent, string Status)> SendWelcomeEmailAsync(User user, string password, CancellationToken cancellationToken)
    {
        if (_emailSender is not { IsConfigured: true })
        {
            return (false, "Email is not set up, so no welcome email was sent.");
        }

        var siteUrl = _configuration is null ? null : MessagingSettings.PublicSiteUrl(_configuration);
        var rendered = EmailTemplates.AdvisorWelcome(user.FullName, user.PhoneNumber, user.Email, password, siteUrl);
        try
        {
            var result = await _emailSender.SendAsync(
                new EmailMessage(user.Email, user.FullName, rendered.Subject, rendered.Html, rendered.Text, "ADVISOR_WELCOME"),
                cancellationToken);
            return result.Success
                ? (true, $"Welcome email sent to {user.Email}.")
                : (false, "The welcome email could not be sent. Share the sign-in details yourself.");
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Only the exception type: the message could echo the request, which holds the password.
            _logger?.LogWarning("Advisor welcome email to user {UserId} failed: {Error}", user.Id, ex.GetType().Name);
            return (false, "The welcome email could not be sent. Share the sign-in details yourself.");
        }
    }

    private async Task<AdminAdvisorListDto> AdvisorDtoAsync(Guid advisorProfileId, CancellationToken cancellationToken) =>
        await _context.AdvisorProfiles
            .AsNoTracking()
            .Where(a => a.Id == advisorProfileId)
            .Select(a => new AdminAdvisorListDto(
                a.Id,
                a.UserId,
                a.User.FullName,
                a.User.Email,
                a.EmployeeCode,
                a.Specialization,
                a.User.IsActive,
                _context.ServiceRequests.Count(sr => sr.AssignedAdvisorId == a.Id && sr.Status != ServiceRequestStatus.Completed && sr.Status != ServiceRequestStatus.Cancelled),
                _context.AdvisorRequestNotes.Count(n => n.AdvisorId == a.Id),
                _context.ServiceJobs.Count(j => j.ServiceRequest.AssignedAdvisorId == a.Id && j.Status != ServiceJobStatus.Closed && j.Status != ServiceJobStatus.Cancelled),
                a.CreatedAtUtc,
                a.User.PhoneNumber,
                a.MaxAssignedRequests,
                a.City))
            .FirstAsync(cancellationToken);
}
