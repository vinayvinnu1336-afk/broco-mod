using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Constants;
using BroCoMod.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace BroCoMod.Infrastructure.Services;

/// <summary>
/// The signed-in advisor's city, looked up once per request. Only users with the ADVISOR role and without
/// SUPER_ADMIN are restricted; an advisor without a profile sees nothing.
/// </summary>
public sealed class AdvisorCityScope : IAdvisorCityScope
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;
    private bool _loaded;
    private AdvisorCityRestriction? _restriction;

    public AdvisorCityScope(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<AdvisorCityRestriction?> GetRestrictionAsync(CancellationToken ct = default)
    {
        if (_loaded) return _restriction;

        if (_currentUser.IsAuthenticated && _currentUser.UserId is { } userId
            && _currentUser.IsInRole(AppRoles.Advisor) && !_currentUser.IsInRole(AppRoles.SuperAdmin))
        {
            var profile = await _context.AdvisorProfiles.AsNoTracking()
                .Where(a => a.UserId == userId)
                .Select(a => new { a.Id, a.City })
                .FirstOrDefaultAsync(ct);
            _restriction = profile == null
                ? new AdvisorCityRestriction(Guid.Empty, string.Empty)
                : new AdvisorCityRestriction(profile.Id, profile.City);
        }

        _loaded = true;
        return _restriction;
    }

    public async Task<string?> EffectiveCityAsync(string? requestedCity, CancellationToken ct = default)
    {
        var restriction = await GetRestrictionAsync(ct);
        if (restriction != null) return restriction.City;
        return string.IsNullOrWhiteSpace(requestedCity) ? null : requestedCity.Trim();
    }

    public async Task<bool> CanAccessRequestAsync(Guid serviceRequestId, CancellationToken ct = default)
    {
        var r = await GetRestrictionAsync(ct);
        if (r == null) return true;
        var request = await _context.ServiceRequests.AsNoTracking()
            .Where(sr => sr.Id == serviceRequestId)
            .Select(sr => new { sr.City, sr.AssignedAdvisorId })
            .FirstOrDefaultAsync(ct);
        return request == null || CityScoping.Allows(r, request.City, request.AssignedAdvisorId);
    }

    public Task<bool> CanAccessCustomerQuotationAsync(Guid customerQuotationId, CancellationToken ct = default) =>
        CanAccessViaRequestAsync(_context.CustomerQuotations.Where(x => x.Id == customerQuotationId).Select(x => (Guid?)x.ServiceRequestId), ct);

    public Task<bool> CanAccessGarageQuoteAsync(Guid garageQuoteId, CancellationToken ct = default) =>
        CanAccessViaRequestAsync(_context.GarageQuotes.Where(x => x.Id == garageQuoteId).Select(x => (Guid?)x.ServiceRequestId), ct);

    public Task<bool> CanAccessJobAsync(Guid serviceJobId, CancellationToken ct = default) =>
        CanAccessViaRequestAsync(_context.ServiceJobs.Where(x => x.Id == serviceJobId).Select(x => (Guid?)x.ServiceRequestId), ct);

    public Task<bool> CanAccessAdditionalWorkAsync(Guid additionalWorkRequestId, CancellationToken ct = default) =>
        CanAccessViaRequestAsync(_context.AdditionalWorkRequests.Where(x => x.Id == additionalWorkRequestId).Select(x => (Guid?)x.ServiceJob.ServiceRequestId), ct);

    public async Task<bool> CanAccessCommissionAsync(Guid commissionId, CancellationToken ct = default)
    {
        var r = await GetRestrictionAsync(ct);
        if (r == null) return true;
        var garageCity = await _context.GarageCommissions.AsNoTracking()
            .Where(c => c.Id == commissionId)
            .Select(c => c.Garage!.City)
            .FirstOrDefaultAsync(ct);
        return garageCity == null || garageCity == r.City;
    }

    public async Task<bool> CanAccessGarageAsync(Guid garageId, CancellationToken ct = default)
    {
        var r = await GetRestrictionAsync(ct);
        if (r == null) return true;
        var city = await _context.Garages.AsNoTracking().Where(g => g.Id == garageId).Select(g => g.City).FirstOrDefaultAsync(ct);
        return city == null || city == r.City;
    }

    private async Task<bool> CanAccessViaRequestAsync(IQueryable<Guid?> requestId, CancellationToken ct)
    {
        if (await GetRestrictionAsync(ct) == null) return true;
        var id = await requestId.FirstOrDefaultAsync(ct);
        return id == null || await CanAccessRequestAsync(id.Value, ct);
    }
}

/// <summary>Query filters for the advisor city restriction and the admin City filter.</summary>
public static class CityScoping
{
    public static bool Allows(AdvisorCityRestriction r, string requestCity, Guid? assignedAdvisorId) =>
        requestCity == r.City || (assignedAdvisorId.HasValue && assignedAdvisorId.Value == r.AdvisorProfileId);

    /// <summary>Requests the advisor may see; everything when <paramref name="r"/> is null.</summary>
    public static IQueryable<ServiceRequest> VisibleTo(this IQueryable<ServiceRequest> query, AdvisorCityRestriction? r) =>
        r == null ? query : query.Where(sr => sr.City == r.City || sr.AssignedAdvisorId == r.AdvisorProfileId);

    /// <summary>The admin City filter (case-insensitive); no filter when <paramref name="city"/> is empty.</summary>
    public static IQueryable<ServiceRequest> InCity(this IQueryable<ServiceRequest> query, string? city)
    {
        var value = Normalize(city);
        return value == null ? query : query.Where(sr => sr.City.ToLower() == value);
    }

    public static IQueryable<Garage> InCity(this IQueryable<Garage> query, string? city)
    {
        var value = Normalize(city);
        return value == null ? query : query.Where(g => g.City.ToLower() == value);
    }

    public static string? Normalize(string? city) =>
        string.IsNullOrWhiteSpace(city) ? null : city.Trim().ToLowerInvariant();
}
