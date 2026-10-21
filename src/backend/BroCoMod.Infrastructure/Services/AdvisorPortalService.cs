using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace BroCoMod.Infrastructure.Services;

public class AdvisorPortalService : IAdvisorPortalService
{
    private readonly IApplicationDbContext _context;
    private readonly IAdvisorCityScope? _cityScope;

    public AdvisorPortalService(IApplicationDbContext context, IAdvisorCityScope? cityScope = null)
    {
        _context = context;
        _cityScope = cityScope;
    }

    /// <summary>Requests the signed-in advisor may see (their city, or assigned to them); all for admins.</summary>
    private async Task<IQueryable<ServiceRequest>> VisibleRequestsAsync(CancellationToken ct) =>
        _context.ServiceRequests.AsNoTracking().VisibleTo(_cityScope == null ? null : await _cityScope.GetRestrictionAsync(ct));

    public async Task<AdvisorDashboardDto> GetDashboardAsync(Guid advisorId, CancellationToken cancellationToken = default)
    {
        var advisor = await _context.AdvisorProfiles
            .Include(a => a.User)
            .FirstOrDefaultAsync(a => a.Id == advisorId || a.UserId == advisorId, cancellationToken);

        var advisorName = advisor?.User?.FullName ?? "Technical Advisor";

        var requestsUnderReview = await GetRequestsUnderReviewAsync(cancellationToken);
        var quotesForReview = await GetQuotesForReviewAsync(cancellationToken);

        var pendingReviewsCount = quotesForReview.Count;
        var activeRequestsCount = requestsUnderReview.Count;
        var restriction = _cityScope == null ? null : await _cityScope.GetRestrictionAsync(cancellationToken);
        var assignedGaragesCount = await _context.Garages.InCity(restriction?.City).CountAsync(cancellationToken);

        return new AdvisorDashboardDto(
            advisorId,
            advisorName,
            pendingReviewsCount,
            activeRequestsCount,
            assignedGaragesCount,
            requestsUnderReview.Take(5).ToList(),
            quotesForReview.Take(5).ToList());
    }

    public async Task<AdvisorProfileDto> GetProfileAsync(Guid advisorId, CancellationToken cancellationToken = default)
    {
        var advisor = await _context.AdvisorProfiles
            .Include(a => a.User)
            .FirstOrDefaultAsync(a => a.Id == advisorId || a.UserId == advisorId, cancellationToken);

        if (advisor == null)
        {
            throw new KeyNotFoundException($"Advisor profile not found for ID: {advisorId}");
        }

        return new AdvisorProfileDto(
            advisor.Id,
            advisor.UserId,
            advisor.User.FullName,
            advisor.User.Email,
            advisor.EmployeeCode,
            advisor.Specialization,
            advisor.MaxAssignedRequests,
            advisor.City);
    }

    public async Task<IReadOnlyList<AdvisorRequestSummaryDto>> GetRequestsUnderReviewAsync(CancellationToken cancellationToken = default)
    {
        return await (await VisibleRequestsAsync(cancellationToken))
            .OrderByDescending(r => r.CreatedAtUtc)
            .Take(20)
            .Select(r => new AdvisorRequestSummaryDto(
                r.Id,
                r.CustomerId,
                "Customer", // Placeholder/resolved name
                $"{r.VehicleYear} {r.VehicleMake} {r.VehicleModel}",
                r.Description,
                r.GarageQuotes.Count,
                r.Status.ToString(),
                r.CreatedAtUtc))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<AdvisorQuoteSummaryDto>> GetQuotesForReviewAsync(CancellationToken cancellationToken = default)
    {
        // Advisor reviews submitted garage quotes and applies margin to formulate customer pricing
        var visible = await VisibleRequestsAsync(cancellationToken);
        return await _context.GarageQuotes
            .AsNoTracking()
            .Include(q => q.Garage)
            .Where(q => visible.Any(sr => sr.Id == q.ServiceRequestId))
            .OrderByDescending(q => q.CreatedAtUtc)
            .Take(20)
            .Select(q => new AdvisorQuoteSummaryDto(
                q.Id,
                q.ServiceRequestId,
                q.GarageId,
                q.Garage.Name,
                q.GarageInternalPrice,
                q.InternalCostBreakdown,
                q.GarageInternalPrice * 1.15m, // 15% recommended margin proposal
                q.Status.ToString(),
                q.CreatedAtUtc))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<AdvisorAssignmentSummaryDto>> GetRecentAssignmentsAsync(CancellationToken cancellationToken = default)
    {
        var visible = await VisibleRequestsAsync(cancellationToken);
        return await _context.CustomerQuotations
            .AsNoTracking()
            .Include(cq => cq.ServiceRequest)
            .Where(cq => visible.Any(sr => sr.Id == cq.ServiceRequestId))
            .OrderByDescending(cq => cq.CreatedAtUtc)
            .Take(20)
            .Select(cq => new AdvisorAssignmentSummaryDto(
                cq.ServiceRequestId,
                cq.AssignedGarageId,
                _context.Garages.Where(g => g.Id == cq.AssignedGarageId).Select(g => g.Name).FirstOrDefault() ?? string.Empty,
                cq.CustomerFacingPrice,
                cq.Status.ToString(),
                cq.CreatedAtUtc))
            .ToListAsync(cancellationToken);
    }
}
