using System.Net.Mail;
using BroCoMod.Application.Common;
using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Constants;
using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Entities.Identity;
using BroCoMod.Domain.Enums;
using BroCoMod.Infrastructure.Services.Messaging;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using UserRole = BroCoMod.Domain.Entities.Identity.UserRole;

namespace BroCoMod.Infrastructure.Services;

/// <summary>
/// Garages added by an administrator: the owner's account (GARAGE_OWNER), the garage and the link between them, in
/// one save. Like advisor accounts, a generated password is returned to the admin once and emailed to the owner, and
/// never written to logs or audit details. An existing customer's mobile or email is refused rather than reused.
/// </summary>
public class AdminGarageAccountService : IAdminGarageAccountService
{
    private readonly IApplicationDbContext _context;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IAuditService _auditService;
    private readonly IServiceAreaService _serviceAreas;
    private readonly IEmailSender? _emailSender;
    private readonly IConfiguration? _configuration;
    private readonly ILogger<AdminGarageAccountService>? _logger;

    public AdminGarageAccountService(
        IApplicationDbContext context,
        IPasswordHasher passwordHasher,
        IAuditService auditService,
        IServiceAreaService serviceAreas,
        IEmailSender? emailSender = null,
        IConfiguration? configuration = null,
        ILogger<AdminGarageAccountService>? logger = null)
    {
        _context = context;
        _passwordHasher = passwordHasher;
        _auditService = auditService;
        _serviceAreas = serviceAreas;
        _emailSender = emailSender;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<CreatedGarageAccountDto> CreateGarageAsync(
        CreateGarageAccountRequest request, Guid adminId, string? ipAddress = null, CancellationToken cancellationToken = default)
    {
        var garageName = CollapseSpaces(request.GarageName);
        if (garageName.Length is < 2 or > 120) throw Invalid("Garage name must be 2 to 120 characters.");
        var ownerName = CollapseSpaces(request.OwnerFullName);
        if (ownerName.Length < 2) throw Invalid("Enter the owner's full name.");
        if (ownerName.Length > 100) throw Invalid("Owner name must be 100 characters or fewer.");

        var ownerMobile = IndianMobile.Normalize(request.OwnerMobile) ?? throw Invalid(IndianMobile.InvalidMessage);
        var ownerEmail = ValidEmail(request.OwnerEmail, "Enter the owner's email.");
        var garagePhone = string.IsNullOrWhiteSpace(request.GaragePhone)
            ? ownerMobile
            : IndianMobile.Normalize(request.GaragePhone) ?? throw Invalid("Enter a valid 10-digit garage phone number.");
        var garageEmail = string.IsNullOrWhiteSpace(request.GarageEmail) ? ownerEmail : ValidEmail(request.GarageEmail, "Enter the garage email.");

        var address = (request.Address ?? string.Empty).Trim();
        if (address.Length < 5) throw Invalid("Enter the workshop address.");
        if (address.Length > 500) throw Invalid("Address must be 500 characters or fewer.");

        if (request.Latitude is not { } lat || request.Longitude is not { } lng)
            throw Invalid("Set the workshop pin: pick it on the map, search the address or enter latitude and longitude.");
        if (lat is < -90 or > 90 || lng is < -180 or > 180 || (lat == 0 && lng == 0))
            throw Invalid("The workshop pin is not a valid location.");
        var pinArea = _serviceAreas.FindLiveAreaFor(lat, lng)
            ?? throw Invalid($"The workshop pin is outside our cities. Pin it inside {LiveCitiesText()}.");
        var city = string.IsNullOrWhiteSpace(request.City)
            ? pinArea.City
            : _serviceAreas.CanonicalLiveCity(request.City) ?? throw Invalid($"Choose one of our cities: {LiveCitiesText()}.");

        var passwordGenerated = string.IsNullOrEmpty(request.Password);
        var password = passwordGenerated ? TemporaryPassword.Generate() : request.Password!;
        if (!passwordGenerated && PasswordPolicy.Validate(password) is { } passwordProblem) throw Invalid(passwordProblem);

        await EnsureEmailAndMobileFreeAsync(ownerEmail, IndianMobile.NationalNumber(ownerMobile)!, cancellationToken);
        if (IndianMobile.NationalNumber(garagePhone) != IndianMobile.NationalNumber(ownerMobile)
            && await _context.Users.IsMobileTakenAsync(IndianMobile.NationalNumber(garagePhone)!, cancellationToken: cancellationToken))
        {
            throw new AdvisorAccountException(AdvisorAccountErrors.MobileTaken,
                "The garage phone is another account's mobile number. Use the owner's mobile or a different number.", 409);
        }

        var role = await _context.Roles.FirstOrDefaultAsync(r => r.NormalizedName == AppRoles.GarageOwner, cancellationToken)
            ?? throw new InvalidOperationException("The GARAGE_OWNER role is missing from the Roles table.");

        var hash = _passwordHasher.HashPassword(password, out var salt);
        var user = new User(ownerEmail, ownerName, ownerMobile, hash, salt);
        var garage = new Garage(garageName, garageEmail, garagePhone, address, lng, lat,
            isVerified: request.Verified, isOperational: true, city: city);

        _context.Users.Add(user);
        _context.UserRoles.Add(new UserRole { User = user, Role = role });
        _context.Garages.Add(garage);
        _context.GarageUsers.Add(new GarageUser(user.Id, garage.Id, AppRoles.GarageOwner, "Owner"));

        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // Another request took the email between the check and the insert (unique index on NormalizedEmail).
            throw new AdvisorAccountException(AdvisorAccountErrors.EmailTaken, "This email is already used by another account.", 409);
        }

        var (emailSent, emailStatus) = await SendWelcomeEmailAsync(user, garage.Name, password, cancellationToken);

        await _auditService.LogAsync(
            action: "ADMIN_GARAGE_CREATED",
            userId: adminId,
            userEmail: await AdminEmailAsync(adminId, cancellationToken),
            entityName: nameof(Garage),
            entityId: garage.Id.ToString(),
            details: $"Garage '{garage.Name}' in {garage.City} created by an administrator ({(request.Verified ? "verified" : "pending verification")}), " +
                     $"owner '{user.FullName}' ({user.Email}, mobile ending {ownerMobile[^4..]}). " +
                     $"Password {(passwordGenerated ? "generated" : "set by the administrator")}; welcome email {(emailSent ? "sent" : "not sent")}.",
            ipAddress: ipAddress,
            cancellationToken: cancellationToken);

        return new CreatedGarageAccountDto(
            ToListDto(garage),
            user.Id,
            user.FullName,
            ownerMobile,
            passwordGenerated ? password : null,
            passwordGenerated,
            emailSent,
            emailStatus);
    }

    public async Task<AdminGarageListDto> UpdateGarageCityAsync(
        Guid garageId, string city, Guid adminId, string? ipAddress = null, CancellationToken cancellationToken = default)
    {
        var garage = await _context.Garages.FirstOrDefaultAsync(g => g.Id == garageId, cancellationToken)
            ?? throw new AdvisorAccountException(AdvisorAccountErrors.NotFound, "Garage not found.", 404);
        var newCity = _serviceAreas.CanonicalLiveCity(city) ?? throw Invalid($"Choose one of our cities: {LiveCitiesText()}.");

        if (newCity != garage.City)
        {
            var previous = garage.City;
            garage.SetCity(newCity);
            await _context.SaveChangesAsync(cancellationToken);
            await _auditService.LogAsync(
                action: "ADMIN_GARAGE_CITY_CHANGED",
                userId: adminId,
                userEmail: await AdminEmailAsync(adminId, cancellationToken),
                entityName: nameof(Garage),
                entityId: garage.Id.ToString(),
                details: $"Garage '{garage.Name}' moved from {(previous.Length > 0 ? previous : "no city")} to {newCity}.",
                ipAddress: ipAddress,
                cancellationToken: cancellationToken);
        }

        var activeJobs = await _context.ServiceJobs.CountAsync(j => j.GarageId == garage.Id && j.Status != ServiceJobStatus.Closed && j.Status != ServiceJobStatus.Cancelled, cancellationToken);
        var quotes = await _context.GarageQuotes.CountAsync(q => q.GarageId == garage.Id, cancellationToken);
        return ToListDto(garage, activeJobs, quotes);
    }

    // ------------------------------------------------------------------ helpers

    private async Task EnsureEmailAndMobileFreeAsync(string email, string nationalNumber, CancellationToken cancellationToken)
    {
        var normalizedEmail = email.ToUpperInvariant();
        var byEmail = await AccountsWithRoles().FirstOrDefaultAsync(u => u.NormalizedEmail == normalizedEmail, cancellationToken);
        if (byEmail != null)
        {
            throw new AdvisorAccountException(AdvisorAccountErrors.EmailTaken,
                !byEmail.IsActive
                    ? "This email belongs to a deactivated account. Use a different email."
                    : IsCustomerOnly(byEmail)
                        ? $"{byEmail.FullName} already has a customer account with this email. A garage owner needs their own account: use a different email."
                        : "This email is already used by another account.",
                409);
        }

        var byMobile = await AccountsWithRoles().Where(u => u.IsActive).FindByMobileAsync(nationalNumber, cancellationToken);
        if (byMobile.Count > 0)
        {
            var holder = byMobile[0];
            throw new AdvisorAccountException(AdvisorAccountErrors.MobileTaken,
                byMobile.Count == 1 && IsCustomerOnly(holder)
                    ? $"{holder.FullName} already has a customer account with this mobile number. A garage owner needs their own account: use a different mobile number."
                    : "This mobile number is already used by another account.",
                409);
        }
    }

    private IQueryable<User> AccountsWithRoles() => _context.Users
        .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
        .Include(u => u.GarageUser);

    private static bool IsCustomerOnly(User user) =>
        user.GarageUser == null && user.UserRoles.Count > 0 && user.UserRoles.All(ur => ur.Role.Name == AppRoles.Customer);

    private string LiveCitiesText()
    {
        var cities = _serviceAreas.GetAreas().Where(a => a.IsLive).Select(a => a.City).ToList();
        return cities.Count > 1 ? $"{string.Join(", ", cities.SkipLast(1))} or {cities[^1]}" : string.Join("", cities);
    }

    private static AdminGarageListDto ToListDto(Garage g, int activeJobs = 0, int quotes = 0) => new(
        g.Id, g.Name, g.Email, g.PhoneNumber, g.Address, g.ServiceRadiusKm, g.Status, g.IsActive, g.IsOperational,
        g.CreatedAtUtc, g.StatusChangedAtUtc, g.StatusReason, activeJobs, quotes, g.City);

    private static string CollapseSpaces(string? value) =>
        string.Join(' ', (value ?? string.Empty).Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));

    private static AdvisorAccountException Invalid(string message) => new(AdvisorAccountErrors.Validation, message);

    private static string ValidEmail(string? value, string missingMessage)
    {
        var email = (value ?? string.Empty).Trim();
        if (email.Length == 0) throw Invalid(missingMessage);
        if (email.Length > 200
            || !MailAddress.TryCreate(email, out var parsed)
            || !string.Equals(parsed.Address, email, StringComparison.OrdinalIgnoreCase)
            || !parsed.Host.Contains('.'))
        {
            throw Invalid("Enter a valid email address.");
        }
        return email.ToLowerInvariant();
    }

    private async Task<string> AdminEmailAsync(Guid adminId, CancellationToken cancellationToken) =>
        await _context.Users.Where(u => u.Id == adminId).Select(u => u.Email).FirstOrDefaultAsync(cancellationToken) ?? "Admin";

    private async Task<(bool Sent, string Status)> SendWelcomeEmailAsync(User user, string garageName, string password, CancellationToken cancellationToken)
    {
        if (_emailSender is not { IsConfigured: true })
        {
            return (false, "Email is not set up, so no welcome email was sent.");
        }

        var siteUrl = _configuration is null ? null : MessagingSettings.PublicSiteUrl(_configuration);
        var rendered = EmailTemplates.GarageWelcome(user.FullName, garageName, user.PhoneNumber, user.Email, password, siteUrl);
        try
        {
            var result = await _emailSender.SendAsync(
                new EmailMessage(user.Email, user.FullName, rendered.Subject, rendered.Html, rendered.Text, "GARAGE_WELCOME"),
                cancellationToken);
            return result.Success
                ? (true, $"Welcome email sent to {user.Email}.")
                : (false, "The welcome email could not be sent. Share the sign-in details yourself.");
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Only the exception type: the message could echo the request, which holds the password.
            _logger?.LogWarning("Garage welcome email to user {UserId} failed: {Error}", user.Id, ex.GetType().Name);
            return (false, "The welcome email could not be sent. Share the sign-in details yourself.");
        }
    }
}
