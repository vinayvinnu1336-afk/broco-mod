using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Entities.Identity;
using Microsoft.EntityFrameworkCore;

namespace BroCoMod.Infrastructure.Services;

public class GaragePortalService : IGaragePortalService
{
    private readonly IApplicationDbContext _context;

    public GaragePortalService(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<GarageDashboardDto> GetDashboardAsync(Guid garageId, CancellationToken cancellationToken = default)
    {
        var garage = await _context.Garages
            .AsNoTracking()
            .FirstOrDefaultAsync(g => g.Id == garageId, cancellationToken);

        var garageName = garage?.Name ?? "Partner Garage";

        // Query quotes submitted strictly by this garage
        var quotes = await _context.GarageQuotes
            .AsNoTracking()
            .Where(q => q.GarageId == garageId)
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
            .CountAsync(q => q.GarageId == garageId, cancellationToken);

        // Query incoming dispatched requests strictly belonging to this garage
        var requests = await _context.GarageRequests
            .AsNoTracking()
            .Include(gr => gr.ServiceRequest)
            .Where(gr => gr.GarageId == garageId)
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

        var newRequestsCount = requests.Count;
        var activeJobsCount = quotes.Count(q => q.Status == "ACCEPTED");

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

        return new GarageProfileDto(
            garage.Id,
            garage.Name,
            garage.Email,
            garage.PhoneNumber,
            garage.Address,
            garage.Location.X,
            garage.Location.Y,
            garage.IsActive,
            teamMembers);
    }

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
}
