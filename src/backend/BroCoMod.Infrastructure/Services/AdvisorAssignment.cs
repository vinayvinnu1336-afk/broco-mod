using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace BroCoMod.Infrastructure.Services;

/// <summary>
/// Picks which advisor owns a new service request: an active advisor with room under their
/// <c>MaxAssignedRequests</c> limit and the fewest open requests. When everyone is at capacity the
/// least-loaded advisor still gets it, so a request is never left without an owner. Advisors with a
/// limit of 0 never receive requests automatically (e.g. trainees, supervisors or test accounts).
/// </summary>
public static class AdvisorAssignment
{
    public sealed record AdvisorLoad(Guid AdvisorId, int OpenRequests, int MaxAssignedRequests)
    {
        public bool HasRoom => OpenRequests < MaxAssignedRequests;
    }

    public static async Task<List<AdvisorLoad>> GetEligibleLoadsAsync(IApplicationDbContext context, CancellationToken ct = default)
    {
        return await context.AdvisorProfiles
            .AsNoTracking()
            .Where(a => a.User.IsActive && a.MaxAssignedRequests > 0)
            .Select(a => new AdvisorLoad(
                a.Id,
                context.ServiceRequests.Count(sr =>
                    sr.AssignedAdvisorId == a.Id &&
                    sr.Status != ServiceRequestStatus.Completed &&
                    sr.Status != ServiceRequestStatus.Cancelled),
                a.MaxAssignedRequests))
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

    public static async Task<Guid?> PickResponsibleAdvisorAsync(IApplicationDbContext context, CancellationToken ct = default) =>
        Pick(await GetEligibleLoadsAsync(context, ct));
}
