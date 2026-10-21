using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace BroCoMod.Infrastructure.Services;

/// <summary>
/// Picks which advisor owns a new service request: an active advisor with room under their
/// <c>MaxAssignedRequests</c> limit and the fewest open requests. When everyone is at capacity the
/// least-loaded advisor still gets it, so a request is never left without an owner. Advisors with a
/// limit of 0 never receive requests automatically (e.g. trainees, supervisors or test accounts), and
/// removed advisors never do.
/// <para>
/// Requests belong to a city: an advisor of the request's city is preferred (with room first, then the
/// least loaded there); only when the city has no eligible advisor at all does it go to another city's.
/// </para>
/// </summary>
public static class AdvisorAssignment
{
    public sealed record AdvisorLoad(Guid AdvisorId, int OpenRequests, int MaxAssignedRequests, string City = "")
    {
        public bool HasRoom => OpenRequests < MaxAssignedRequests;
    }

    public static async Task<List<AdvisorLoad>> GetEligibleLoadsAsync(IApplicationDbContext context, CancellationToken ct = default)
    {
        return await context.AdvisorProfiles
            .AsNoTracking()
            .Where(a => a.User.IsActive && a.RemovedAtUtc == null && a.MaxAssignedRequests > 0)
            .Select(a => new AdvisorLoad(
                a.Id,
                context.ServiceRequests.Count(sr =>
                    sr.AssignedAdvisorId == a.Id &&
                    sr.Status != ServiceRequestStatus.Completed &&
                    sr.Status != ServiceRequestStatus.Cancelled),
                a.MaxAssignedRequests,
                a.City))
            .ToListAsync(ct);
    }

    /// <summary>Advisors with room first, then by open requests; ties broken by id for stable results.</summary>
    public static Guid? Pick(IEnumerable<AdvisorLoad> loads) =>
        loads
            .OrderByDescending(l => l.HasRoom)
            .ThenBy(l => l.OpenRequests)
            .ThenBy(l => l.AdvisorId)
            .Select(l => (Guid?)l.AdvisorId)
            .FirstOrDefault();

    /// <summary>
    /// <see cref="Pick(IEnumerable{AdvisorLoad})"/> among the advisors of <paramref name="city"/>; when that city has
    /// none, among everyone. A null or empty city means any advisor.
    /// </summary>
    public static Guid? Pick(IReadOnlyCollection<AdvisorLoad> loads, string? city)
    {
        if (!string.IsNullOrWhiteSpace(city))
        {
            var inCity = loads.Where(l => string.Equals(l.City, city.Trim(), StringComparison.OrdinalIgnoreCase)).ToList();
            if (inCity.Count > 0) return Pick(inCity);
        }
        return Pick(loads);
    }

    public static async Task<Guid?> PickResponsibleAdvisorAsync(IApplicationDbContext context, CancellationToken ct = default) =>
        Pick(await GetEligibleLoadsAsync(context, ct));

    public static async Task<Guid?> PickResponsibleAdvisorAsync(IApplicationDbContext context, string? city, CancellationToken ct = default) =>
        Pick(await GetEligibleLoadsAsync(context, ct), city);
}
