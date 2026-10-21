using BroCoMod.Application.Common;
using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Constants;
using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Entities.Identity;
using BroCoMod.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace BroCoMod.Infrastructure.Services;

public class GaragePortalService : IGaragePortalService
{
    /// <summary>Upper bound for unpaged garage portal lists; most recent rows are returned first.</summary>
    private const int MaxListResults = 200;

    private readonly IApplicationDbContext _context;
    private readonly IServiceAreaService? _serviceAreas;
    private readonly IAuditService? _auditService;
    private readonly INotificationService? _notifications;

    public GaragePortalService(
        IApplicationDbContext context,
        IServiceAreaService? serviceAreas = null,
        IAuditService? auditService = null,
        INotificationService? notifications = null)
    {
        _context = context;
        _serviceAreas = serviceAreas;
        _auditService = auditService;
        _notifications = notifications;
    }

    public async Task<GarageDashboardDto> GetDashboardAsync(Guid garageId, CancellationToken cancellationToken = default)
    {
        var garage = await _context.Garages
            .AsNoTracking()
            .FirstOrDefaultAsync(g => g.Id == garageId, cancellationToken);

        var garageName = garage?.Name ?? "Partner Garage";

        // Query quotes submitted strictly by this garage. Package bookings are jobs, never quotes or requests.
        var quotes = await _context.GarageQuotes
            .AsNoTracking()
            .Where(q => q.GarageId == garageId && q.ServiceRequest.ServicePackageId == null)
            .OrderByDescending(q => q.CreatedAtUtc)
            .Take(5)
            .Select(q => new GarageQuoteSummaryDto(
                q.Id,
                q.GarageRequestId,
                q.ServiceRequestId,
                q.ServiceRequest != null ? q.ServiceRequest.RequestNumber : "",
                q.ServiceRequest != null ? (q.ServiceRequest.VehicleMake + " " + q.ServiceRequest.VehicleModel) : "",
                q.QuoteNumber,
                q.VersionNumber,
                q.Status.ToString(),
                q.Currency,
                q.TotalAmount,
                q.EstimatedCompletionDays,
                q.ValidUntil,
                q.SubmittedAtUtc,
                q.CreatedAtUtc))
            .ToListAsync(cancellationToken);

        var submittedQuotesCount = await _context.GarageQuotes
            .CountAsync(q => q.GarageId == garageId && q.ServiceRequest.ServicePackageId == null, cancellationToken);

        // Query incoming dispatched requests strictly belonging to this garage
        var requests = await _context.GarageRequests
            .AsNoTracking()
            .Include(gr => gr.ServiceRequest)
            .Where(gr => gr.GarageId == garageId && gr.ServiceRequest.ServicePackageId == null)
            .OrderByDescending(gr => gr.CreatedAtUtc)
            .Take(5)
            .Select(gr => new GarageRequestSummaryDto(
                gr.ServiceRequestId,
                gr.ServiceRequest.VehicleMake,
                gr.ServiceRequest.VehicleModel,
                gr.ServiceRequest.VehicleYear,
                gr.ServiceRequest.ProblemDescription,
                gr.DistanceKm,
                gr.CreatedAtUtc,
                gr.Status.ToString()))
            .ToListAsync(cancellationToken);

        // KPI counts are aggregated in SQL over the garage's full data set, not over the 5-row previews above.
        var newRequestsCount = await _context.GarageRequests
            .CountAsync(gr => gr.GarageId == garageId &&
                              gr.ServiceRequest.ServicePackageId == null &&
                              (gr.Status == GarageRequestStatus.Pending ||
                               gr.Status == GarageRequestStatus.Notified ||
                               gr.Status == GarageRequestStatus.Viewed), cancellationToken);

        var activeJobsCount = await _context.ServiceJobs
            .CountAsync(j => j.GarageId == garageId &&
                             j.Status != ServiceJobStatus.Closed &&
                             j.Status != ServiceJobStatus.Cancelled, cancellationToken);

        return new GarageDashboardDto(
            garageId,
            garageName,
            newRequestsCount,
            submittedQuotesCount,
            activeJobsCount,
            requests,
            quotes);
    }

    public async Task<GarageProfileDto> GetProfileAsync(Guid garageId, CancellationToken cancellationToken = default)
    {
        var garage = await _context.Garages
            .AsNoTracking()
            .FirstOrDefaultAsync(g => g.Id == garageId, cancellationToken);

        if (garage == null)
        {
            throw new KeyNotFoundException($"Garage not found for ID: {garageId}");
        }

        // Fetch team members strictly belonging to this garage
        var teamMembers = await _context.GarageUsers
            .AsNoTracking()
            .Include(gu => gu.User)
            .Where(gu => gu.GarageId == garageId)
            .Select(gu => new GarageUserDto(
                gu.User.Id,
                gu.User.FullName,
                gu.User.Email,
                gu.RoleName,
                gu.Title))
            .ToListAsync(cancellationToken);

        return ToProfileDto(garage, teamMembers);
    }

    private static GarageProfileDto ToProfileDto(Garage garage, IReadOnlyList<GarageUserDto> teamMembers) => new(
        garage.Id,
        garage.Name,
        garage.Email,
        garage.PhoneNumber,
        garage.Address,
        garage.Location.X,
        garage.Location.Y,
        garage.IsActive,
        teamMembers,
        garage.Status.ToString(),
        garage.IsVerified,
        garage.UpdatedAtUtc);

    public async Task<GarageProfileDto> UpdateProfileAsync(
        Guid garageId,
        Guid userId,
        UpdateGarageProfileRequest request,
        string? ipAddress = null,
        CancellationToken cancellationToken = default)
    {
        // The garage id comes from the caller's token, so an owner can only ever reach their own garage.
        var garage = await _context.Garages.FirstOrDefaultAsync(g => g.Id == garageId, cancellationToken)
            ?? throw new KeyNotFoundException("Garage not found.");

        var name = (request.Name ?? string.Empty).Trim();
        if (name.Length is < 2 or > 120)
            throw new ArgumentException("Garage name must be 2 to 120 characters.");
        var phone = IndianMobile.Normalize(request.PhoneNumber)
            ?? throw new ArgumentException(IndianMobile.InvalidMessage);
        var email = (request.Email ?? string.Empty).Trim();
        if (email.Length is 0 or > 200 || !new System.ComponentModel.DataAnnotations.EmailAddressAttribute().IsValid(email))
            throw new ArgumentException("Enter a valid email address.");
        var address = (request.Address ?? string.Empty).Trim();
        if (address.Length > 500)
            throw new ArgumentException("Address must be 500 characters or fewer.");
        if (address.Length < 5)
            throw new ArgumentException("Enter the workshop address.");

        var hadLocation = !(garage.Location.X == 0 && garage.Location.Y == 0);
        var locationChanged = false;
        if (request.Latitude is { } lat && request.Longitude is { } lng)
        {
            if (lat is < -90 or > 90 || lng is < -180 or > 180 || (lat == 0 && lng == 0))
                throw new ArgumentException("The workshop pin is not a valid location.");
            // About 1 m: re-saving the same pin from a rounded client value is not a move.
            locationChanged = Math.Abs(lat - garage.Location.Y) > 0.00001 || Math.Abs(lng - garage.Location.X) > 0.00001;
            if (locationChanged && _serviceAreas != null && _serviceAreas.FindLiveAreaFor(lat, lng) == null)
            {
                var cities = _serviceAreas.GetAreas().Where(a => a.IsLive).Select(a => a.City).ToList();
                var liveCities = cities.Count > 1 ? $"{string.Join(", ", cities.SkipLast(1))} and {cities[^1]}" : string.Join("", cities);
                throw new ArgumentException($"We currently serve only {liveCities}. Please pin your workshop inside {(cities.Count > 1 ? "one of these cities" : liveCities)}.");
            }
        }
        else if (request.Latitude.HasValue || request.Longitude.HasValue)
        {
            throw new ArgumentException("Send both latitude and longitude for the workshop pin.");
        }

        User? user = null;
        string? yourName = null;
        if (request.YourFullName != null)
        {
            yourName = request.YourFullName.Trim();
            if (yourName.Length is < 2 or > 100)
                throw new ArgumentException("Your name must be 2 to 100 characters.");
            // Only a member of this garage can be renamed through it.
            user = await _context.GarageUsers
                .Where(gu => gu.GarageId == garageId && gu.UserId == userId)
                .Select(gu => gu.User)
                .FirstOrDefaultAsync(cancellationToken);
        }

        var changed = new List<string>();
        var nameChanged = name != garage.Name;
        if (nameChanged) changed.Add("name");
        if (phone != garage.PhoneNumber)
        {
            // The garage's number may be the owner's or a teammate's own mobile, but not another account's:
            // customers and other garages sign in with theirs.
            var nationalNumber = IndianMobile.NationalNumber(phone)!;
            if (nationalNumber != IndianMobile.NationalNumber(garage.PhoneNumber))
            {
                var memberIds = await _context.GarageUsers
                    .Where(gu => gu.GarageId == garageId)
                    .Select(gu => gu.UserId)
                    .ToListAsync(cancellationToken);
                if (await _context.Users.IsMobileTakenAsync(nationalNumber, memberIds, cancellationToken))
                    throw new ArgumentException(IndianMobile.AlreadyRegisteredMessage);
            }
            changed.Add("phone");
        }
        if (!string.Equals(email, garage.Email, StringComparison.Ordinal)) changed.Add("email");
        if (address != garage.Address) changed.Add("address");
        if (locationChanged) changed.Add("workshop location");
        var renameUser = user != null && yourName != user.FullName;
        if (renameUser) changed.Add("your name");

        if (changed.Count > 0)
        {
            var previousName = garage.Name;
            garage.UpdateProfile(name, email, phone, address);
            if (locationChanged)
            {
                garage.UpdateLocation(request.Longitude!.Value, request.Latitude!.Value);
                // A pin moved into another city moves the garage to that city's advisors and bookings.
                if (_serviceAreas?.ResolveCity(request.Latitude, request.Longitude, address) is { } newCity) garage.SetCity(newCity);
                // A verified garage that had no pin was kept out of matching; now it has one.
                if (!hadLocation && !garage.IsOperational && garage.Status == GarageStatus.Verified) garage.SetOperational(true);
            }
            if (renameUser) user!.UpdateProfile(yourName!, user.PhoneNumber);

            try
            {
                await _context.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateConcurrencyException)
            {
                throw new InvalidOperationException("Your garage was changed by someone else at the same time. Reload and try again.");
            }

            if (_auditService != null)
            {
                // Field names only, like the customer profile: the audit trail is not a second copy of the data.
                await _auditService.LogAsync(
                    action: AuditActions.GarageProfileUpdated,
                    userId: userId == Guid.Empty ? null : userId,
                    entityName: nameof(Garage),
                    entityId: garage.Id.ToString(),
                    details: $"Garage updated its profile: {string.Join(", ", changed)}" +
                             (nameChanged ? $" (previous name: {previousName})" : string.Empty),
                    ipAddress: ipAddress,
                    cancellationToken: cancellationToken);
            }

            // A verified garage keeps its status, but admins should re-check a new name or workshop pin.
            if (garage.Status == GarageStatus.Verified && (nameChanged || locationChanged) && _notifications != null)
            {
                var what = nameChanged && locationChanged ? "name and location" : nameChanged ? "name" : "location";
                var message = nameChanged
                    ? $"{previousName} is now {garage.Name}{(locationChanged ? " and moved its workshop pin" : string.Empty)}. Please re-check the listing."
                    : $"{garage.Name} moved its workshop pin. Please re-check the listing.";
                var adminIds = await _context.Users.AsNoTracking()
                    .Where(u => u.IsActive && u.UserRoles.Any(ur => ur.Role.Name == AppRoles.SuperAdmin))
                    .Select(u => u.Id)
                    .ToListAsync(cancellationToken);
                foreach (var adminId in adminIds)
                {
                    await _notifications.SendInAppNotificationAsync(adminId, $"Garage changed its {what}", message,
                        GarageProfileChangedNotification, garage.Id, nameof(Garage), cancellationToken: cancellationToken);
                }
            }
        }

        var teamMembers = await _context.GarageUsers
            .AsNoTracking()
            .Where(gu => gu.GarageId == garageId)
            .Select(gu => new GarageUserDto(gu.User.Id, gu.User.FullName, gu.User.Email, gu.RoleName, gu.Title))
            .ToListAsync(cancellationToken);
        return ToProfileDto(garage, teamMembers);
    }

    public const string GarageProfileChangedNotification = "GARAGE_PROFILE_CHANGED";

    public async Task<IReadOnlyList<GarageRequestSummaryDto>> GetRequestsAsync(Guid garageId, CancellationToken cancellationToken = default)
    {
        // Enforce garage data boundary: only requests dispatched to this garage
        return await _context.GarageRequests
            .AsNoTracking()
            .Include(gr => gr.ServiceRequest)
            .Where(gr => gr.GarageId == garageId)
            .OrderByDescending(gr => gr.CreatedAtUtc)
            .Take(50)
            .Select(gr => new GarageRequestSummaryDto(
                gr.ServiceRequestId,
                gr.ServiceRequest.VehicleMake,
                gr.ServiceRequest.VehicleModel,
                gr.ServiceRequest.VehicleYear,
                gr.ServiceRequest.ProblemDescription,
                gr.DistanceKm,
                gr.CreatedAtUtc,
                gr.Status.ToString()))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<GarageQuoteSummaryDto>> GetQuotesAsync(Guid garageId, CancellationToken cancellationToken = default)
    {
        // STRICT DATA ISOLATION: Only quotes from this garage, never exposing competitors or customer quotations
        return await _context.GarageQuotes
            .AsNoTracking()
            .Where(q => q.GarageId == garageId)
            .OrderByDescending(q => q.CreatedAtUtc)
            .Take(MaxListResults)
            .Select(q => new GarageQuoteSummaryDto(
                q.Id,
                q.GarageRequestId,
                q.ServiceRequestId,
                q.ServiceRequest != null ? q.ServiceRequest.RequestNumber : "",
                q.ServiceRequest != null ? (q.ServiceRequest.VehicleMake + " " + q.ServiceRequest.VehicleModel) : "",
                q.QuoteNumber,
                q.VersionNumber,
                q.Status.ToString(),
                q.Currency,
                q.TotalAmount,
                q.EstimatedCompletionDays,
                q.ValidUntil,
                q.SubmittedAtUtc,
                q.CreatedAtUtc))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<GarageConfirmedBookingDto>> GetConfirmedBookingsAsync(Guid garageId, CancellationToken cancellationToken = default)
    {
        // STRICT DATA ISOLATION: only confirmed assignments belonging to this garage
        return await _context.GarageAssignments
            .AsNoTracking()
            .Include(ga => ga.ServiceRequest)
            .Include(ga => ga.SelectedQuote)
            .Where(ga => ga.GarageId == garageId && ga.Status == BroCoMod.Domain.Enums.GarageAssignmentStatus.Confirmed)
            .OrderByDescending(ga => ga.UpdatedAtUtc ?? ga.AssignedAtUtc)
            .Take(MaxListResults)
            .Select(ga => new GarageConfirmedBookingDto(
                ga.Id,
                ga.ServiceRequestId,
                ga.ServiceRequest != null ? ga.ServiceRequest.RequestNumber : string.Empty,
                ga.ServiceRequest != null ? ga.ServiceRequest.VehicleMake : string.Empty,
                ga.ServiceRequest != null ? ga.ServiceRequest.VehicleModel : string.Empty,
                ga.ServiceRequest != null ? ga.ServiceRequest.VehicleYear : 0,
                ga.ServiceRequest != null ? ga.ServiceRequest.VehicleLicensePlate : string.Empty,
                ga.ServiceRequest != null ? ga.ServiceRequest.ProblemDescription : string.Empty,
                ga.UpdatedAtUtc ?? ga.AssignedAtUtc,
                ga.SelectedQuote != null ? ga.SelectedQuote.TotalAmount : 0m,
                ga.SelectedQuote != null ? ga.SelectedQuote.QuoteNumber : string.Empty
            ))
            .ToListAsync(cancellationToken);
    }
}
