using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Entities.Identity;
using BroCoMod.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace BroCoMod.Infrastructure.Services;

public class AdvisorOperationsService : IAdvisorOperationsService
{
    private readonly IApplicationDbContext _context;

    public AdvisorOperationsService(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<AdvisorDashboardKpiDto> GetAdvisorDashboardKpisAsync(Guid advisorUserId, CancellationToken cancellationToken = default)
    {
        var advisor = await _context.AdvisorProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.UserId == advisorUserId || a.Id == advisorUserId, cancellationToken);

        var advisorId = advisor?.Id;

        // Base query for advisor
        var requestQuery = _context.ServiceRequests.AsNoTracking();
        if (advisorId.HasValue)
        {
            requestQuery = requestQuery.Where(sr => sr.AssignedAdvisorId == advisorId.Value);
        }

        var assignedRequestsCount = await requestQuery.CountAsync(sr =>
            sr.Status != ServiceRequestStatus.Completed &&
            sr.Status != ServiceRequestStatus.Cancelled, cancellationToken);

        var quotesAwaitingReviewCount = await requestQuery.CountAsync(sr =>
            sr.Status == ServiceRequestStatus.QuotesReceived &&
            !sr.GarageAssignments.Any(ga => ga.Status == GarageAssignmentStatus.Assigned || ga.Status == GarageAssignmentStatus.Confirmed), cancellationToken);

        var cqQuery = _context.CustomerQuotations.AsNoTracking();
        if (advisorId.HasValue)
        {
            cqQuery = cqQuery.Where(cq => cq.ServiceRequest.AssignedAdvisorId == advisorId.Value || cq.AdvisorId == advisorId.Value);
        }
        var customerQuotationsPendingCount = await cqQuery.CountAsync(cq =>
            cq.Status == CustomerQuotationStatus.Sent, cancellationToken);

        var jobQuery = _context.ServiceJobs.AsNoTracking();
        if (advisorId.HasValue)
        {
            jobQuery = jobQuery.Where(j => j.ServiceRequest.AssignedAdvisorId == advisorId.Value);
        }
        var activeJobsCount = await jobQuery.CountAsync(j =>
            j.Status != ServiceJobStatus.Closed &&
            j.Status != ServiceJobStatus.Cancelled, cancellationToken);

        var workQuery = _context.AdditionalWorkRequests.AsNoTracking();
        if (advisorId.HasValue)
        {
            workQuery = workQuery.Where(w => w.ServiceJob.ServiceRequest.AssignedAdvisorId == advisorId.Value);
        }
        var additionalWorkPendingCount = await workQuery.CountAsync(w =>
            w.Status == AdditionalWorkStatus.PendingAdvisorReview, cancellationToken);

        var recentRequests = await requestQuery
            .Include(sr => sr.CustomerProfile).ThenInclude(cp => cp.User)
            .Include(sr => sr.AssignedAdvisor).ThenInclude(a => a.User)
            .Include(sr => sr.GarageAssignments).ThenInclude(ga => ga.Garage)
            .Include(sr => sr.ServiceJob)
            .Include(sr => sr.ServiceLocation)
            .OrderByDescending(sr => sr.CreatedAtUtc)
            .Take(10)
            .Select(sr => new AdminRequestSummaryDto(
                sr.Id,
                sr.RequestNumber,
                sr.CustomerId,
                sr.CustomerProfile.User.FullName,
                sr.CustomerProfile.User.Email,
                sr.VehicleMake,
                sr.VehicleModel,
                sr.VehicleLicensePlate,
                sr.Status.ToString(),
                sr.AssignedAdvisorId,
                sr.AssignedAdvisor != null ? sr.AssignedAdvisor.User.FullName : null,
                sr.GarageRequests.Count,
                sr.GarageQuotes.Count,
                sr.GarageAssignments.Where(ga => ga.Status == GarageAssignmentStatus.Assigned || ga.Status == GarageAssignmentStatus.Confirmed).Select(ga => ga.Garage.Name).FirstOrDefault(),
                sr.ServiceJob != null ? sr.ServiceJob.Status.ToString() : null,
                sr.CreatedAtUtc,
                $"{sr.VehicleYear} {sr.VehicleMake} {sr.VehicleModel}",
                sr.ServiceLocation != null ? sr.ServiceLocation.City : "",
                sr.GarageRequests.Count,
                sr.CreatedAtUtc
            ))
            .ToListAsync(cancellationToken);

        return new AdvisorDashboardKpiDto(
            assignedRequestsCount,
            quotesAwaitingReviewCount,
            customerQuotationsPendingCount,
            activeJobsCount,
            additionalWorkPendingCount,
            recentRequests
        );
    }

    public async Task<AdvisorWorkQueueDto> GetAdvisorWorkQueueAsync(Guid advisorUserId, CancellationToken cancellationToken = default)
    {
        var advisor = await _context.AdvisorProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.UserId == advisorUserId || a.Id == advisorUserId, cancellationToken);

        var advisorId = advisor?.Id;

        // 1. New Requests: unassigned or newly assigned needing quotes
        var newRequestsQuery = _context.ServiceRequests.AsNoTracking()
            .Include(sr => sr.CustomerProfile).ThenInclude(cp => cp.User)
            .Include(sr => sr.AssignedAdvisor).ThenInclude(a => a.User)
            .Include(sr => sr.ServiceLocation)
            .Where(sr => (sr.AssignedAdvisorId == null || (advisorId.HasValue && sr.AssignedAdvisorId == advisorId.Value)) &&
                         (sr.Status == ServiceRequestStatus.Submitted || sr.Status == ServiceRequestStatus.GarageMatching || sr.Status == ServiceRequestStatus.GaragesNotified) &&
                         !sr.GarageQuotes.Any());

        var newRequests = await newRequestsQuery
            .OrderByDescending(sr => sr.CreatedAtUtc)
            .Take(25)
            .Select(sr => new AdminRequestSummaryDto(
                sr.Id,
                sr.RequestNumber,
                sr.CustomerId,
                sr.CustomerProfile.User.FullName,
                sr.CustomerProfile.User.Email,
                sr.VehicleMake,
                sr.VehicleModel,
                sr.VehicleLicensePlate,
                sr.Status.ToString(),
                sr.AssignedAdvisorId,
                sr.AssignedAdvisor != null ? sr.AssignedAdvisor.User.FullName : null,
                sr.GarageRequests.Count,
                sr.GarageQuotes.Count,
                null,
                null,
                sr.CreatedAtUtc,
                $"{sr.VehicleYear} {sr.VehicleMake} {sr.VehicleModel}",
                sr.ServiceLocation != null ? sr.ServiceLocation.City : "",
                sr.GarageRequests.Count,
                sr.CreatedAtUtc
            ))
            .ToListAsync(cancellationToken);

        // 2. Quotes To Review: requests with received garage quotes awaiting assignment
        var quotesToReviewQuery = _context.ServiceRequests.AsNoTracking()
            .Include(sr => sr.CustomerProfile).ThenInclude(cp => cp.User)
            .Include(sr => sr.AssignedAdvisor).ThenInclude(a => a.User)
            .Include(sr => sr.ServiceLocation)
            .Where(sr => (advisorId == null || sr.AssignedAdvisorId == advisorId.Value) &&
                         sr.Status == ServiceRequestStatus.QuotesReceived &&
                         !sr.GarageAssignments.Any(ga => ga.Status == GarageAssignmentStatus.Assigned || ga.Status == GarageAssignmentStatus.Confirmed));

        var quotesToReview = await quotesToReviewQuery
            .OrderByDescending(sr => sr.CreatedAtUtc)
            .Take(25)
            .Select(sr => new AdminRequestSummaryDto(
                sr.Id,
                sr.RequestNumber,
                sr.CustomerId,
                sr.CustomerProfile.User.FullName,
                sr.CustomerProfile.User.Email,
                sr.VehicleMake,
                sr.VehicleModel,
                sr.VehicleLicensePlate,
                sr.Status.ToString(),
                sr.AssignedAdvisorId,
                sr.AssignedAdvisor != null ? sr.AssignedAdvisor.User.FullName : null,
                sr.GarageRequests.Count,
                sr.GarageQuotes.Count,
                null,
                null,
                sr.CreatedAtUtc,
                $"{sr.VehicleYear} {sr.VehicleMake} {sr.VehicleModel}",
                sr.ServiceLocation != null ? sr.ServiceLocation.City : "",
                sr.GarageRequests.Count,
                sr.CreatedAtUtc
            ))
            .ToListAsync(cancellationToken);

        // 3. Customer Quotations Pending Decision
        var cqPendingQuery = _context.CustomerQuotations.AsNoTracking()
            .Include(cq => cq.ServiceRequest).ThenInclude(sr => sr.CustomerProfile).ThenInclude(cp => cp.User)
            .Include(cq => cq.ServiceRequest).ThenInclude(sr => sr.AssignedAdvisor).ThenInclude(a => a.User)
            .Include(cq => cq.ServiceRequest).ThenInclude(sr => sr.GarageAssignments).ThenInclude(ga => ga.Garage)
            .Include(cq => cq.ServiceRequest).ThenInclude(sr => sr.ServiceJob)
            .Include(cq => cq.ServiceRequest).ThenInclude(sr => sr.ServiceLocation)
            .Where(cq => (advisorId == null || cq.ServiceRequest.AssignedAdvisorId == advisorId.Value || cq.AdvisorId == advisorId.Value) &&
                         (cq.Status == CustomerQuotationStatus.Draft || cq.Status == CustomerQuotationStatus.ReadyToSend || cq.Status == CustomerQuotationStatus.Sent));

        var customerQuotationsPending = await cqPendingQuery
            .OrderByDescending(cq => cq.CreatedAtUtc)
            .Take(25)
            .Select(cq => new AdminRequestSummaryDto(
                cq.ServiceRequest.Id,
                cq.ServiceRequest.RequestNumber,
                cq.ServiceRequest.CustomerId,
                cq.ServiceRequest.CustomerProfile.User.FullName,
                cq.ServiceRequest.CustomerProfile.User.Email,
                cq.ServiceRequest.VehicleMake,
                cq.ServiceRequest.VehicleModel,
                cq.ServiceRequest.VehicleLicensePlate,
                cq.ServiceRequest.Status.ToString(),
                cq.ServiceRequest.AssignedAdvisorId,
                cq.ServiceRequest.AssignedAdvisor != null ? cq.ServiceRequest.AssignedAdvisor.User.FullName : null,
                cq.ServiceRequest.GarageRequests.Count,
                cq.ServiceRequest.GarageQuotes.Count,
                cq.ServiceRequest.GarageAssignments.Where(ga => ga.Status == GarageAssignmentStatus.Assigned || ga.Status == GarageAssignmentStatus.Confirmed).Select(ga => ga.Garage.Name).FirstOrDefault(),
                cq.ServiceRequest.ServiceJob != null ? cq.ServiceRequest.ServiceJob.Status.ToString() : null,
                cq.CreatedAtUtc,
                $"{cq.ServiceRequest.VehicleYear} {cq.ServiceRequest.VehicleMake} {cq.ServiceRequest.VehicleModel}",
                cq.ServiceRequest.ServiceLocation != null ? cq.ServiceRequest.ServiceLocation.City : "",
                cq.ServiceRequest.GarageRequests.Count,
                cq.CreatedAtUtc
            ))
            .ToListAsync(cancellationToken);

        // 4. Active Jobs
        var activeJobsQuery = _context.ServiceJobs.AsNoTracking()
            .Include(j => j.ServiceRequest).ThenInclude(sr => sr.CustomerProfile).ThenInclude(cp => cp.User)
            .Include(j => j.Garage)
            .Where(j => (advisorId == null || j.ServiceRequest.AssignedAdvisorId == advisorId.Value) &&
                        j.Status != ServiceJobStatus.Closed &&
                        j.Status != ServiceJobStatus.Cancelled);

        var activeJobs = await activeJobsQuery
            .OrderByDescending(j => j.CreatedAtUtc)
            .Take(25)
            .Select(j => new AdminJobListItemDto(
                j.Id,
                j.JobNumber,
                j.ServiceRequestId,
                j.ServiceRequest.RequestNumber,
                j.GarageId,
                j.Garage.Name,
                j.ServiceRequest.CustomerProfile.User.FullName,
                $"{j.ServiceRequest.VehicleMake} {j.ServiceRequest.VehicleModel} ({j.ServiceRequest.VehicleLicensePlate})",
                j.Status.ToString(),
                j.ScheduledStartAtUtc,
                j.ActualVehicleReceivedAtUtc,
                j.ActualWorkCompletedAtUtc,
                j.CreatedAtUtc
            ))
            .ToListAsync(cancellationToken);

        // 5. Additional Work Pending Review
        var workPendingQuery = _context.AdditionalWorkRequests.AsNoTracking()
            .Where(w => (advisorId == null || w.ServiceJob.ServiceRequest.AssignedAdvisorId == advisorId.Value) &&
                        w.Status == AdditionalWorkStatus.PendingAdvisorReview);

        var additionalWorkPending = await workPendingQuery
            .OrderByDescending(w => w.CreatedAtUtc)
            .Take(25)
            .Select(w => new AdditionalWorkRequestDto(
                w.Id,
                w.ServiceJobId,
                w.Description,
                w.EstimatedAdditionalAmount,
                w.Reason,
                w.Status.ToString(),
                w.ReviewedByAdvisorId,
                w.AdvisorRemarks,
                w.ReviewedAtUtc,
                w.CreatedAtUtc
            ))
            .ToListAsync(cancellationToken);

        return new AdvisorWorkQueueDto(
            newRequests,
            quotesToReview,
            customerQuotationsPending,
            activeJobs,
            additionalWorkPending
        );
    }
}
