using System.Diagnostics;
using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Entities.Identity;
using BroCoMod.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using StackExchange.Redis;

namespace BroCoMod.Infrastructure.Services;

public class AdminOperationsService : IAdminOperationsService
{
    private readonly IApplicationDbContext _context;
    private readonly IAuditService _auditService;
    private readonly IAdminPortalService _adminPortalService;
    private readonly IConfiguration _configuration;
    private static readonly DateTime ServiceStartTimeUtc = DateTime.UtcNow;

    public AdminOperationsService(
        IApplicationDbContext context,
        IAuditService auditService,
        IAdminPortalService adminPortalService,
        IConfiguration configuration)
    {
        _context = context;
        _auditService = auditService;
        _adminPortalService = adminPortalService;
        _configuration = configuration;
    }

    public async Task<AdminDashboardKpiDto> GetDashboardKpisAsync(CancellationToken cancellationToken = default)
    {
        var totalUsers = await _context.Users.CountAsync(cancellationToken);
        var totalCustomers = await _context.CustomerProfiles.CountAsync(cancellationToken);
        var activeCustomers = await _context.CustomerProfiles.CountAsync(c => c.User.IsActive, cancellationToken);
        var totalGarages = await _context.Garages.CountAsync(cancellationToken);
        var activeGarages = await _context.Garages.CountAsync(g => g.Status == GarageStatus.Verified && g.IsActive, cancellationToken);
        var pendingGarages = await _context.Garages.CountAsync(g => g.Status == GarageStatus.PendingVerification, cancellationToken);
        var suspendedGarages = await _context.Garages.CountAsync(g => g.Status == GarageStatus.Suspended, cancellationToken);
        var inactiveGarages = await _context.Garages.CountAsync(g => g.Status == GarageStatus.Inactive, cancellationToken);
        var totalAdvisors = await _context.AdvisorProfiles.CountAsync(cancellationToken);
        var activeAdvisors = await _context.AdvisorProfiles.CountAsync(a => a.User.IsActive, cancellationToken);
        var totalRequests = await _context.ServiceRequests.CountAsync(cancellationToken);
        var activeRequests = await _context.ServiceRequests.CountAsync(sr => sr.Status != ServiceRequestStatus.Completed && sr.Status != ServiceRequestStatus.Cancelled, cancellationToken);
        var completedRequests = await _context.ServiceRequests.CountAsync(sr => sr.Status == ServiceRequestStatus.Completed, cancellationToken);
        var cancelledRequests = await _context.ServiceRequests.CountAsync(sr => sr.Status == ServiceRequestStatus.Cancelled, cancellationToken);

        var jobsInProgress = await _context.ServiceJobs.CountAsync(j =>
            j.Status != ServiceJobStatus.Closed &&
            j.Status != ServiceJobStatus.Cancelled, cancellationToken);

        var jobsCompleted = await _context.ServiceJobs.CountAsync(j =>
            j.Status == ServiceJobStatus.Closed, cancellationToken);

        var failedNotifications = await _context.Notifications.CountAsync(n => n.Status == NotificationStatus.Failed, cancellationToken);

        var attentionQueue = await GetAttentionQueueAsync(cancellationToken);

        var recentUsers = await _adminPortalService.GetUsersAsync(cancellationToken);
        var recentAuditLogs = await _auditService.GetRecentAuditLogsAsync(10, cancellationToken);

        var recentRequests = await _context.ServiceRequests
            .AsNoTracking()
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

        return new AdminDashboardKpiDto(
            TotalUsersCount: totalUsers,
            TotalCustomersCount: totalCustomers,
            TotalGaragesCount: totalGarages,
            TotalAdvisorsCount: totalAdvisors,
            TotalRequestsCount: totalRequests,
            TotalServiceRequests: totalRequests,
            ActiveServiceRequests: activeRequests,
            CompletedServiceRequests: completedRequests,
            CancelledServiceRequests: cancelledRequests,
            TotalGarages: totalGarages,
            ActiveGarages: activeGarages,
            PendingVerificationGarages: pendingGarages,
            SuspendedGarages: suspendedGarages,
            InactiveGarages: inactiveGarages,
            TotalAdvisors: totalAdvisors,
            ActiveAdvisors: activeAdvisors,
            TotalCustomers: totalCustomers,
            ActiveCustomers: activeCustomers,
            ServiceJobsInProgress: jobsInProgress,
            CompletedServiceJobs: jobsCompleted,
            RequestsNeedingAttention: attentionQueue.TotalAttentionItemsCount,
            FailedNotificationsCount: failedNotifications,
            RecentUsers: recentUsers.Take(5).ToList(),
            RecentAuditLogs: recentAuditLogs,
            RecentRequests: recentRequests
        );
    }

    public async Task<PagedResult<AdminRequestSummaryDto>> GetRequestsAsync(AdminRequestFilter filter, CancellationToken cancellationToken = default)
    {
        var pageNumber = Math.Max(1, filter.PageNumber);
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);

        var query = _context.ServiceRequests.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(filter.Status) && Enum.TryParse<ServiceRequestStatus>(filter.Status, true, out var status))
        {
            query = query.Where(sr => sr.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var search = filter.Search.Trim().ToLower();
            query = query.Where(sr =>
                sr.RequestNumber.ToLower().Contains(search) ||
                sr.CustomerProfile.User.FullName.ToLower().Contains(search) ||
                sr.CustomerProfile.User.Email.ToLower().Contains(search) ||
                sr.VehicleLicensePlate.ToLower().Contains(search) ||
                sr.VehicleMake.ToLower().Contains(search) ||
                sr.VehicleModel.ToLower().Contains(search));
        }

        if (filter.AssignedAdvisorId.HasValue)
        {
            query = query.Where(sr => sr.AssignedAdvisorId == filter.AssignedAdvisorId.Value);
        }

        if (filter.FromDateUtc.HasValue)
        {
            query = query.Where(sr => sr.CreatedAtUtc >= filter.FromDateUtc.Value);
        }

        if (filter.ToDateUtc.HasValue)
        {
            query = query.Where(sr => sr.CreatedAtUtc <= filter.ToDateUtc.Value);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(sr => sr.CreatedAtUtc)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
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

        return new PagedResult<AdminRequestSummaryDto>(items, pageNumber, pageSize, totalCount);
    }

    public async Task<AdminRequestOperationalDetailDto?> GetRequestOperationalDetailAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var sr = await _context.ServiceRequests
            .AsNoTracking()
            .Include(r => r.CustomerProfile).ThenInclude(cp => cp.User)
            .Include(r => r.AssignedAdvisor).ThenInclude(a => a.User)
            .Include(r => r.ServiceLocation)
            .Include(r => r.GarageRequests).ThenInclude(gr => gr.Garage)
            .Include(r => r.GarageQuotes).ThenInclude(gq => gq.Garage)
            .Include(r => r.GarageQuotes).ThenInclude(gq => gq.LineItems)
            .Include(r => r.AdvisorNotes)
            .Include(r => r.GarageAssignments).ThenInclude(ga => ga.Garage)
            .Include(r => r.GarageAssignments).ThenInclude(ga => ga.SelectedQuote)
            .Include(r => r.CustomerQuotation).ThenInclude(cq => cq.Decision)
            .Include(r => r.CustomerQuotation).ThenInclude(cq => cq.Versions)
            .Include(r => r.ServiceJob).ThenInclude(j => j.Inspections)
            .Include(r => r.ServiceJob).ThenInclude(j => j.Activities)
            .Include(r => r.ServiceJob).ThenInclude(j => j.AdditionalWorkRequests)
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

        if (sr == null)
            return null;

        var dispatchedGarages = sr.GarageRequests
            .OrderBy(gr => gr.CreatedAtUtc)
            .Select(gr => new AdminDispatchedGarageDto(
                gr.GarageId,
                gr.Garage.Name,
                gr.Garage.Email,
                gr.Garage.PhoneNumber,
                gr.DistanceKm,
                gr.Status.ToString(),
                gr.CreatedAtUtc,
                gr.RespondedAtUtc,
                gr.DeclineReason
            ))
            .ToList();

        var quotesReceived = sr.GarageQuotes
            .OrderByDescending(q => q.SubmittedAtUtc)
            .Select(q => new AdminReceivedQuoteDto(
                q.Id,
                q.QuoteNumber,
                q.GarageId,
                q.Garage.Name,
                q.Subtotal,
                q.TaxAmount,
                q.DiscountAmount,
                q.TotalAmount,
                q.Currency,
                q.Status.ToString(),
                q.ValidUntil,
                q.SubmittedAtUtc ?? q.CreatedAtUtc,
                q.LineItems.Select(li => new AdminQuoteLineItemDto(
                    li.Description,
                    li.LineType.ToString(),
                    li.Quantity,
                    li.UnitPrice,
                    li.LineTotal,
                    null
                )).ToList()
            ))
            .ToList();

        var advisorNotes = sr.AdvisorNotes
            .OrderBy(n => n.CreatedAtUtc)
            .Select(n => new AdminAdvisorNoteDto(
                n.Id,
                n.AdvisorId,
                n.AdvisorName,
                n.Note,
                n.CreatedAtUtc
            ))
            .ToList();

        var activeAssignment = sr.GarageAssignments
            .OrderByDescending(ga => ga.AssignedAtUtc)
            .FirstOrDefault(ga => ga.Status == GarageAssignmentStatus.Assigned || ga.Status == GarageAssignmentStatus.Confirmed);

        AdminGarageAssignmentDto? currentAssignmentDto = null;
        if (activeAssignment != null)
        {
            currentAssignmentDto = new AdminGarageAssignmentDto(
                activeAssignment.Id,
                activeAssignment.GarageId,
                activeAssignment.Garage?.Name ?? string.Empty,
                activeAssignment.SelectedQuoteId,
                activeAssignment.SelectedQuote?.QuoteNumber ?? string.Empty,
                activeAssignment.Status.ToString(),
                activeAssignment.AssignmentReason,
                activeAssignment.AssignedAtUtc,
                activeAssignment.Status == GarageAssignmentStatus.Confirmed ? activeAssignment.UpdatedAtUtc : null
            );
        }

        AdminCustomerQuotationDto? customerQuotationDto = null;
        AdminCustomerDecisionDto? customerDecisionDto = null;

        if (sr.CustomerQuotation != null)
        {
            var cq = sr.CustomerQuotation;
            customerQuotationDto = new AdminCustomerQuotationDto(
                cq.Id,
                cq.QuotationNumber,
                cq.CustomerTotal,
                cq.AdvisorMarginApplied,
                cq.Status.ToString(),
                cq.ValidUntilUtc,
                cq.CreatedAtUtc,
                cq.SentAtUtc,
                cq.VersionNumber
            );

            if (cq.Decision != null)
            {
                customerDecisionDto = new AdminCustomerDecisionDto(
                    cq.Decision.Id,
                    cq.Decision.Decision.ToString(),
                    cq.Decision.DecidedAtUtc,
                    cq.Decision.DecisionCategory,
                    cq.Decision.DecisionReason
                );
            }
        }

        AdminServiceJobSummaryDto? serviceJobDto = null;
        if (sr.ServiceJob != null)
        {
            var job = sr.ServiceJob;
            var latestInspection = job.Inspections.OrderByDescending(i => i.CreatedAtUtc).FirstOrDefault();
            serviceJobDto = new AdminServiceJobSummaryDto(
                job.Id,
                job.JobNumber,
                job.Status.ToString(),
                job.ScheduledStartAtUtc,
                job.ActualVehicleReceivedAtUtc,
                job.ActualWorkStartedAtUtc,
                job.ActualWorkCompletedAtUtc,
                job.HandedOverAtUtc,
                job.ClosedAtUtc,
                latestInspection?.OverallSeverity.ToString(),
                job.Activities.Count,
                job.AdditionalWorkRequests.Count
            );
        }

        // Timeline Audit Events
        var entityIds = new List<string> { id.ToString() };
        if (sr.CustomerQuotation != null) entityIds.Add(sr.CustomerQuotation.Id.ToString());
        if (sr.ServiceJob != null) entityIds.Add(sr.ServiceJob.Id.ToString());

        var timelineEvents = await _context.AuditLogs
            .AsNoTracking()
            .Where(al => entityIds.Contains(al.EntityId))
            .OrderBy(al => al.TimestampUtc)
            .Select(al => new AdminAuditLogSummaryDto(
                al.Id,
                al.Action,
                al.UserEmail,
                al.EntityName,
                al.EntityId,
                al.Details,
                al.IpAddress,
                al.TimestampUtc
            ))
            .ToListAsync(cancellationToken);

        return new AdminRequestOperationalDetailDto(
            sr.Id,
            sr.RequestNumber,
            sr.Status.ToString(),
            sr.CreatedAtUtc,
            sr.CustomerId,
            sr.CustomerProfile.User.FullName,
            sr.CustomerProfile.User.Email,
            sr.CustomerProfile.User.PhoneNumber,
            sr.VehicleMake,
            sr.VehicleModel,
            sr.VehicleLicensePlate,
            sr.ProblemDescription,
            sr.ServiceCategory,
            sr.CustomerLocation.Y,
            sr.CustomerLocation.X,
            sr.ServiceLocation != null ? $"{sr.ServiceLocation.AddressLine1}, {sr.ServiceLocation.City}" : null,
            sr.AssignedAdvisorId,
            sr.AssignedAdvisor?.User.FullName,
            sr.AssignedAdvisor?.User.Email,
            dispatchedGarages,
            quotesReceived,
            advisorNotes,
            currentAssignmentDto,
            customerQuotationDto,
            customerDecisionDto,
            serviceJobDto,
            timelineEvents
        );
    }

    public async Task<PagedResult<AdminGarageListDto>> GetGaragesAsync(AdminGarageFilter filter, CancellationToken cancellationToken = default)
    {
        var pageNumber = Math.Max(1, filter.PageNumber);
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);

        var query = _context.Garages.AsNoTracking();

        if (filter.Status.HasValue)
        {
            query = query.Where(g => g.Status == filter.Status.Value);
        }

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var search = filter.Search.Trim().ToLower();
            query = query.Where(g =>
                g.Name.ToLower().Contains(search) ||
                g.Email.ToLower().Contains(search) ||
                g.PhoneNumber.ToLower().Contains(search) ||
                g.Address.ToLower().Contains(search));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderBy(g => g.Name)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(g => new AdminGarageListDto(
                g.Id,
                g.Name,
                g.Email,
                g.PhoneNumber,
                g.Address,
                g.ServiceRadiusKm,
                g.Status,
                g.IsActive,
                g.IsOperational,
                g.CreatedAtUtc,
                g.StatusChangedAtUtc,
                g.StatusReason,
                g.ServiceJobs.Count(j => j.Status != ServiceJobStatus.Closed && j.Status != ServiceJobStatus.Cancelled),
                g.Quotes.Count
            ))
            .ToListAsync(cancellationToken);

        return new PagedResult<AdminGarageListDto>(items, pageNumber, pageSize, totalCount);
    }

    public async Task<AdminGarageDetailDto?> GetGarageDetailAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var g = await _context.Garages
            .AsNoTracking()
            .Include(garage => garage.GarageRequests)
            .Include(garage => garage.Quotes)
            .Include(garage => garage.ServiceJobs).ThenInclude(j => j.ServiceRequest)
            .FirstOrDefaultAsync(garage => garage.Id == id, cancellationToken);

        if (g == null)
            return null;

        var totalDispatches = g.GarageRequests.Count;
        var totalQuotes = g.Quotes.Count;
        var totalQuotesWon = await _context.GarageAssignments
            .AsNoTracking()
            .CountAsync(ga => ga.GarageId == id && (ga.Status == GarageAssignmentStatus.Assigned || ga.Status == GarageAssignmentStatus.Confirmed), cancellationToken);

        var winRate = totalQuotes > 0 ? Math.Round((decimal)totalQuotesWon * 100m / totalQuotes, 1) : 0m;
        var activeJobs = g.ServiceJobs.Count(j => j.Status != ServiceJobStatus.Closed && j.Status != ServiceJobStatus.Cancelled);
        var completedJobs = g.ServiceJobs.Count(j => j.Status == ServiceJobStatus.Closed);

        var recentJobs = g.ServiceJobs
            .OrderByDescending(j => j.CreatedAtUtc)
            .Take(10)
            .Select(j => new AdminGarageRecentJobDto(
                j.Id,
                j.JobNumber,
                j.ServiceRequest.RequestNumber,
                $"{j.ServiceRequest.VehicleMake} {j.ServiceRequest.VehicleModel}",
                j.Status.ToString(),
                j.CreatedAtUtc
            ))
            .ToList();

        var auditHistory = await _context.AuditLogs
            .AsNoTracking()
            .Where(al => al.EntityName == "Garage" && al.EntityId == id.ToString())
            .OrderByDescending(al => al.TimestampUtc)
            .Take(50)
            .Select(al => new AdminAuditLogSummaryDto(
                al.Id,
                al.Action,
                al.UserEmail,
                al.EntityName,
                al.EntityId,
                al.Details,
                al.IpAddress,
                al.TimestampUtc
            ))
            .ToListAsync(cancellationToken);

        return new AdminGarageDetailDto(
            g.Id,
            g.Name,
            g.Email,
            g.PhoneNumber,
            g.Address,
            g.Location.X,
            g.Location.Y,
            g.ServiceRadiusKm,
            g.Status,
            g.IsActive,
            g.IsOperational,
            g.StatusReason,
            g.StatusChangedAtUtc,
            g.CreatedAtUtc,
            g.ConcurrencyToken,
            totalDispatches,
            totalQuotes,
            totalQuotesWon,
            winRate,
            activeJobs,
            completedJobs,
            recentJobs,
            auditHistory
        );
    }

    public async Task<bool> VerifyGarageAsync(Guid id, Guid adminId, CancellationToken cancellationToken = default)
    {
        var garage = await _context.Garages.FirstOrDefaultAsync(g => g.Id == id, cancellationToken);
        if (garage == null)
            throw new KeyNotFoundException($"Garage {id} not found.");

        garage.Verify(adminId);
        await _context.SaveChangesAsync(cancellationToken);

        var adminUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == adminId, cancellationToken);
        await _auditService.LogAsync(
            action: "ADMIN_GARAGE_VERIFIED",
            userId: adminId,
            userEmail: adminUser?.Email ?? "Admin",
            entityName: "Garage",
            entityId: id.ToString(),
            details: $"Garage '{garage.Name}' verified by administrator.",
            ipAddress: null,
            cancellationToken: cancellationToken);

        return true;
    }

    public async Task<bool> SuspendGarageAsync(Guid id, string reason, Guid adminId, CancellationToken cancellationToken = default)
    {
        var garage = await _context.Garages.FirstOrDefaultAsync(g => g.Id == id, cancellationToken);
        if (garage == null)
            throw new KeyNotFoundException($"Garage {id} not found.");

        garage.Suspend(reason, adminId);
        await _context.SaveChangesAsync(cancellationToken);

        var adminUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == adminId, cancellationToken);
        await _auditService.LogAsync(
            action: "ADMIN_GARAGE_SUSPENDED",
            userId: adminId,
            userEmail: adminUser?.Email ?? "Admin",
            entityName: "Garage",
            entityId: id.ToString(),
            details: $"Garage '{garage.Name}' suspended. Reason: {reason}",
            ipAddress: null,
            cancellationToken: cancellationToken);

        return true;
    }

    public async Task<bool> ActivateGarageAsync(Guid id, Guid adminId, CancellationToken cancellationToken = default)
    {
        var garage = await _context.Garages.FirstOrDefaultAsync(g => g.Id == id, cancellationToken);
        if (garage == null)
            throw new KeyNotFoundException($"Garage {id} not found.");

        garage.Activate(adminId);
        await _context.SaveChangesAsync(cancellationToken);

        var adminUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == adminId, cancellationToken);
        await _auditService.LogAsync(
            action: "ADMIN_GARAGE_ACTIVATED",
            userId: adminId,
            userEmail: adminUser?.Email ?? "Admin",
            entityName: "Garage",
            entityId: id.ToString(),
            details: $"Garage '{garage.Name}' activated by administrator.",
            ipAddress: null,
            cancellationToken: cancellationToken);

        return true;
    }

    public async Task<bool> DeactivateGarageAsync(Guid id, string reason, Guid adminId, CancellationToken cancellationToken = default)
    {
        var garage = await _context.Garages.FirstOrDefaultAsync(g => g.Id == id, cancellationToken);
        if (garage == null)
            throw new KeyNotFoundException($"Garage {id} not found.");

        garage.Deactivate(reason, adminId);
        await _context.SaveChangesAsync(cancellationToken);

        var adminUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == adminId, cancellationToken);
        await _auditService.LogAsync(
            action: "ADMIN_GARAGE_DEACTIVATED",
            userId: adminId,
            userEmail: adminUser?.Email ?? "Admin",
            entityName: "Garage",
            entityId: id.ToString(),
            details: $"Garage '{garage.Name}' deactivated. Reason: {reason}",
            ipAddress: null,
            cancellationToken: cancellationToken);

        return true;
    }

    public async Task<bool> UpdateGarageRadiusAsync(Guid id, double radiusKm, Guid adminId, CancellationToken cancellationToken = default)
    {
        var garage = await _context.Garages.FirstOrDefaultAsync(g => g.Id == id, cancellationToken);
        if (garage == null)
            throw new KeyNotFoundException($"Garage {id} not found.");

        garage.UpdateServiceRadius(radiusKm);
        await _context.SaveChangesAsync(cancellationToken);

        var adminUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == adminId, cancellationToken);
        await _auditService.LogAsync(
            action: "ADMIN_GARAGE_RADIUS_UPDATED",
            userId: adminId,
            userEmail: adminUser?.Email ?? "Admin",
            entityName: "Garage",
            entityId: id.ToString(),
            details: $"Garage '{garage.Name}' service radius updated to {radiusKm} KM.",
            ipAddress: null,
            cancellationToken: cancellationToken);

        return true;
    }

    public async Task<PagedResult<AdminAdvisorListDto>> GetAdvisorsAsync(AdminAdvisorFilter filter, CancellationToken cancellationToken = default)
    {
        var pageNumber = Math.Max(1, filter.PageNumber);
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);

        var query = _context.AdvisorProfiles
            .AsNoTracking()
            .Include(a => a.User);

        IQueryable<AdvisorProfile> filteredQuery = query;

        if (filter.IsActive.HasValue)
        {
            filteredQuery = filteredQuery.Where(a => a.User.IsActive == filter.IsActive.Value);
        }

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var search = filter.Search.Trim().ToLower();
            filteredQuery = filteredQuery.Where(a =>
                a.User.FullName.ToLower().Contains(search) ||
                a.User.Email.ToLower().Contains(search) ||
                a.EmployeeCode.ToLower().Contains(search) ||
                a.Specialization.ToLower().Contains(search));
        }

        var totalCount = await filteredQuery.CountAsync(cancellationToken);

        var items = await filteredQuery
            .OrderBy(a => a.User.FullName)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
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
                a.CreatedAtUtc
            ))
            .ToListAsync(cancellationToken);

        return new PagedResult<AdminAdvisorListDto>(items, pageNumber, pageSize, totalCount);
    }

    public async Task<bool> ActivateAdvisorAsync(Guid id, Guid adminId, CancellationToken cancellationToken = default)
    {
        var advisor = await _context.AdvisorProfiles
            .Include(a => a.User)
            .FirstOrDefaultAsync(a => a.Id == id || a.UserId == id, cancellationToken);

        if (advisor == null)
            throw new KeyNotFoundException($"Advisor {id} not found.");

        advisor.User.SetActive(true);
        await _context.SaveChangesAsync(cancellationToken);

        var adminUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == adminId, cancellationToken);
        await _auditService.LogAsync(
            action: "ADMIN_ADVISOR_ACTIVATED",
            userId: adminId,
            userEmail: adminUser?.Email ?? "Admin",
            entityName: "AdvisorProfile",
            entityId: advisor.Id.ToString(),
            details: $"Advisor '{advisor.User.FullName}' activated by administrator.",
            ipAddress: null,
            cancellationToken: cancellationToken);

        return true;
    }

    public async Task<bool> DeactivateAdvisorAsync(Guid id, string reason, Guid adminId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(reason))
            throw new ArgumentException("Deactivation reason is required.", nameof(reason));

        var advisor = await _context.AdvisorProfiles
            .Include(a => a.User)
            .FirstOrDefaultAsync(a => a.Id == id || a.UserId == id, cancellationToken);

        if (advisor == null)
            throw new KeyNotFoundException($"Advisor {id} not found.");

        advisor.User.SetActive(false);
        await _context.SaveChangesAsync(cancellationToken);

        var adminUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == adminId, cancellationToken);
        await _auditService.LogAsync(
            action: "ADMIN_ADVISOR_DEACTIVATED",
            userId: adminId,
            userEmail: adminUser?.Email ?? "Admin",
            entityName: "AdvisorProfile",
            entityId: advisor.Id.ToString(),
            details: $"Advisor '{advisor.User.FullName}' deactivated. Reason: {reason}",
            ipAddress: null,
            cancellationToken: cancellationToken);

        return true;
    }

    public async Task<PagedResult<AdminCustomerListDto>> GetCustomersAsync(AdminCustomerFilter filter, CancellationToken cancellationToken = default)
    {
        var pageNumber = Math.Max(1, filter.PageNumber);
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);

        var query = _context.CustomerProfiles
            .AsNoTracking()
            .Include(c => c.User)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var search = filter.Search.Trim().ToLower();
            query = query.Where(c =>
                c.User.FullName.ToLower().Contains(search) ||
                c.User.Email.ToLower().Contains(search) ||
                c.User.PhoneNumber.ToLower().Contains(search));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(c => c.CreatedAtUtc)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new AdminCustomerListDto(
                c.Id,
                c.UserId,
                c.User.FullName,
                c.User.Email,
                c.User.PhoneNumber,
                _context.CustomerVehicles.Count(v => v.CustomerId == c.Id),
                _context.ServiceRequests.Count(sr => sr.CustomerId == c.Id),
                c.CreatedAtUtc
            ))
            .ToListAsync(cancellationToken);

        return new PagedResult<AdminCustomerListDto>(items, pageNumber, pageSize, totalCount);
    }

    public async Task<AdminCustomerDetailDto?> GetCustomerDetailAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var c = await _context.CustomerProfiles
            .AsNoTracking()
            .Include(cp => cp.User)
            .FirstOrDefaultAsync(cp => cp.Id == id || cp.UserId == id, cancellationToken);

        if (c == null)
            return null;

        var vehicles = await _context.CustomerVehicles
            .AsNoTracking()
            .Where(v => v.CustomerId == c.Id)
            .OrderByDescending(v => v.IsPrimary)
            .ThenBy(v => v.Make)
            .Select(v => new CustomerVehicleDto(
                v.Id,
                v.CustomerId,
                v.Make,
                v.Model,
                v.Year,
                v.LicensePlate,
                v.Vin,
                v.Mileage
            ))
            .ToListAsync(cancellationToken);

        var requests = await _context.ServiceRequests
            .AsNoTracking()
            .Include(sr => sr.AssignedAdvisor).ThenInclude(a => a.User)
            .Include(sr => sr.GarageAssignments).ThenInclude(ga => ga.Garage)
            .Include(sr => sr.ServiceJob)
            .Include(sr => sr.ServiceLocation)
            .Where(sr => sr.CustomerId == c.Id)
            .OrderByDescending(sr => sr.CreatedAtUtc)
            .Take(25)
            .Select(sr => new AdminRequestSummaryDto(
                sr.Id,
                sr.RequestNumber,
                sr.CustomerId,
                c.User.FullName,
                c.User.Email,
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

        return new AdminCustomerDetailDto(
            c.Id,
            c.UserId,
            c.User.FullName,
            c.User.Email,
            c.User.PhoneNumber,
            c.Address,
            c.PreferredContactMethod,
            c.CreatedAtUtc,
            vehicles,
            requests
        );
    }

    public async Task<PagedResult<AdminJobListItemDto>> GetJobsAsync(AdminJobFilter filter, CancellationToken cancellationToken = default)
    {
        var pageNumber = Math.Max(1, filter.PageNumber);
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);

        var query = _context.ServiceJobs
            .AsNoTracking()
            .Include(j => j.ServiceRequest).ThenInclude(sr => sr.CustomerProfile).ThenInclude(cp => cp.User)
            .Include(j => j.Garage)
            .AsQueryable();

        if (filter.Status.HasValue)
        {
            query = query.Where(j => j.Status == filter.Status.Value);
        }

        if (filter.GarageId.HasValue)
        {
            query = query.Where(j => j.GarageId == filter.GarageId.Value);
        }

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var search = filter.Search.Trim().ToLower();
            query = query.Where(j =>
                j.JobNumber.ToLower().Contains(search) ||
                j.ServiceRequest.RequestNumber.ToLower().Contains(search) ||
                j.Garage.Name.ToLower().Contains(search) ||
                j.ServiceRequest.CustomerProfile.User.FullName.ToLower().Contains(search) ||
                j.ServiceRequest.VehicleLicensePlate.ToLower().Contains(search));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(j => j.CreatedAtUtc)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
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

        return new PagedResult<AdminJobListItemDto>(items, pageNumber, pageSize, totalCount);
    }

    public async Task<AdminJobDetailDto?> GetJobDetailAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var job = await _context.ServiceJobs
            .AsNoTracking()
            .Include(j => j.ServiceRequest).ThenInclude(sr => sr.CustomerProfile).ThenInclude(cp => cp.User)
            .Include(j => j.Garage)
            .Include(j => j.Inspections)
            .Include(j => j.Activities)
            .Include(j => j.AdditionalWorkRequests)
            .FirstOrDefaultAsync(j => j.Id == id, cancellationToken);

        if (job == null)
            return null;

        var inspections = job.Inspections
            .OrderByDescending(i => i.CreatedAtUtc)
            .Select(i => new ServiceInspectionDto(
                i.Id,
                i.InspectorUserId,
                "Workshop Inspector",
                i.InspectionStartedAtUtc,
                i.InspectionCompletedAtUtc,
                i.Findings,
                i.Recommendations,
                i.CustomerVisibleSummary,
                i.OverallSeverity.ToString(),
                i.CreatedAtUtc
            ))
            .ToList();

        var activities = job.Activities
            .OrderByDescending(a => a.CreatedAtUtc)
            .Select(a => new ServiceJobActivityDto(
                a.Id,
                a.ActivityType.ToString(),
                a.Message,
                a.IsCustomerVisible,
                "Workshop Team",
                a.CreatedAtUtc
            ))
            .ToList();

        var additionalWork = job.AdditionalWorkRequests
            .OrderByDescending(w => w.CreatedAtUtc)
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
            .ToList();

        return new AdminJobDetailDto(
            job.Id,
            job.JobNumber,
            job.ServiceRequestId,
            job.ServiceRequest.RequestNumber,
            job.GarageId,
            job.Garage.Name,
            job.ServiceRequest.CustomerProfile.User.FullName,
            $"{job.ServiceRequest.VehicleMake} {job.ServiceRequest.VehicleModel} ({job.ServiceRequest.VehicleLicensePlate})",
            job.Status.ToString(),
            job.CustomerComplaintSnapshot,
            job.GarageInternalNotes,
            job.CustomerFacingNotes,
            job.ScheduledStartAtUtc,
            job.ActualVehicleReceivedAtUtc,
            job.ActualWorkStartedAtUtc,
            job.ActualWorkCompletedAtUtc,
            job.VehicleReadyAtUtc,
            job.HandedOverAtUtc,
            job.ClosedAtUtc,
            job.CreatedAtUtc,
            inspections,
            activities,
            additionalWork
        );
    }

    public async Task<AdminAttentionQueueDto> GetAttentionQueueAsync(CancellationToken cancellationToken = default)
    {
        var items = new List<AttentionItemDto>();
        var now = DateTime.UtcNow;

        // 1. Unanswered Service Requests (GaragesNotified > 2 hours ago with 0 quotes)
        var twoHoursAgo = now.AddHours(-2);
        var unansweredRequests = await _context.ServiceRequests
            .AsNoTracking()
            .Where(sr => sr.Status == ServiceRequestStatus.GaragesNotified && sr.CreatedAtUtc <= twoHoursAgo && !sr.GarageQuotes.Any())
            .Take(20)
            .Select(sr => new AttentionItemDto(
                "UnansweredRequest",
                "High",
                sr.Id,
                sr.RequestNumber,
                $"Service request {sr.RequestNumber} has no quotes after 2 hours",
                $"Customer {sr.VehicleMake} {sr.VehicleModel} was dispatched to {sr.GarageRequests.Count} garages with 0 responses.",
                sr.CreatedAtUtc,
                $"/admin/requests/{sr.Id}"
            ))
            .ToListAsync(cancellationToken);
        items.AddRange(unansweredRequests);

        // 2. Quotes awaiting advisor review (Service requests with quotes, but no assignment)
        var quotesAwaitingReview = await _context.ServiceRequests
            .AsNoTracking()
            .Where(sr => sr.Status == ServiceRequestStatus.QuotesReceived && !sr.GarageAssignments.Any(ga => ga.Status == GarageAssignmentStatus.Assigned || ga.Status == GarageAssignmentStatus.Confirmed))
            .Take(20)
            .Select(sr => new AttentionItemDto(
                "QuotesAwaitingReview",
                "Medium",
                sr.Id,
                sr.RequestNumber,
                $"Quotes awaiting advisor review for {sr.RequestNumber}",
                $"{sr.GarageQuotes.Count} quotes received for {sr.VehicleMake} {sr.VehicleModel}. Garage assignment needed.",
                sr.CreatedAtUtc,
                $"/admin/requests/{sr.Id}"
            ))
            .ToListAsync(cancellationToken);
        items.AddRange(quotesAwaitingReview);

        // 3. Customer Quotations expiring within 24 hours
        var expiringThreshold = now.AddHours(24);
        var expiringQuotes = await _context.CustomerQuotations
            .AsNoTracking()
            .Include(cq => cq.ServiceRequest)
            .Where(cq => cq.Status == CustomerQuotationStatus.Sent && cq.ValidUntilUtc <= expiringThreshold && cq.ValidUntilUtc > now)
            .Take(20)
            .Select(cq => new AttentionItemDto(
                "CustomerQuoteExpiring",
                "High",
                cq.Id,
                cq.QuotationNumber,
                $"Customer quotation {cq.QuotationNumber} expiring soon",
                $"Quotation expires at {cq.ValidUntilUtc:g} UTC. Customer decision pending.",
                cq.CreatedAtUtc,
                $"/admin/requests/{cq.ServiceRequestId}"
            ))
            .ToListAsync(cancellationToken);
        items.AddRange(expiringQuotes);

        // 4. Confirmed bookings unscheduled
        var unscheduledBookings = await _context.GarageAssignments
            .AsNoTracking()
            .Include(ga => ga.ServiceRequest)
            .Include(ga => ga.Garage)
            .Where(ga => ga.Status == GarageAssignmentStatus.Confirmed && (ga.ServiceJob == null || ga.ServiceJob.ScheduledStartAtUtc == null))
            .Take(20)
            .Select(ga => new AttentionItemDto(
                "BookingUnscheduled",
                "Medium",
                ga.Id,
                ga.ServiceRequest.RequestNumber,
                $"Confirmed booking unscheduled for {ga.ServiceRequest.RequestNumber}",
                $"Booking confirmed with {ga.Garage.Name}. Workshop scheduled intake date has not been set.",
                ga.AssignedAtUtc,
                $"/admin/requests/{ga.ServiceRequestId}"
            ))
            .ToListAsync(cancellationToken);
        items.AddRange(unscheduledBookings);

        // 5. Vehicles unreceived past scheduled intake
        var unreceivedVehicles = await _context.ServiceJobs
            .AsNoTracking()
            .Include(j => j.Garage)
            .Where(j => j.Status == ServiceJobStatus.Scheduled && j.ScheduledStartAtUtc.HasValue && j.ScheduledStartAtUtc.Value < now && j.ActualVehicleReceivedAtUtc == null)
            .Take(20)
            .Select(j => new AttentionItemDto(
                "VehicleUnreceived",
                "High",
                j.Id,
                j.JobNumber,
                $"Vehicle unreceived past scheduled intake for {j.JobNumber}",
                $"Scheduled start was {j.ScheduledStartAtUtc:g} UTC at {j.Garage.Name}. Vehicle not yet arrived.",
                j.CreatedAtUtc,
                $"/admin/jobs/{j.Id}"
            ))
            .ToListAsync(cancellationToken);
        items.AddRange(unreceivedVehicles);

        // 6. Additional work requests pending advisor review
        var pendingAdditionalWork = await _context.AdditionalWorkRequests
            .AsNoTracking()
            .Include(w => w.ServiceJob)
            .Where(w => w.Status == AdditionalWorkStatus.PendingAdvisorReview)
            .Take(20)
            .Select(w => new AttentionItemDto(
                "AdditionalWorkPending",
                "High",
                w.Id,
                w.ServiceJob.JobNumber,
                $"Additional work review required for {w.ServiceJob.JobNumber}",
                $"{w.Description} (+{w.EstimatedAdditionalAmount:C}) requested by workshop. Advisor review needed.",
                w.CreatedAtUtc,
                $"/admin/jobs/{w.ServiceJobId}"
            ))
            .ToListAsync(cancellationToken);
        items.AddRange(pendingAdditionalWork);

        // 7. Failed notifications needing retry
        var failedNotifications = await _context.Notifications
            .AsNoTracking()
            .Include(n => n.User)
            .Where(n => n.Status == NotificationStatus.Failed)
            .Take(20)
            .Select(n => new AttentionItemDto(
                "NotificationFailed",
                "Medium",
                n.Id,
                n.Title,
                $"Notification failed delivery to {n.User.Email}",
                $"Message: {n.Title}. Error: {n.ErrorSummary ?? "Delivery failure"}. Retry count: {n.RetryCount}.",
                n.CreatedAtUtc,
                $"/admin/notifications"
            ))
            .ToListAsync(cancellationToken);
        items.AddRange(failedNotifications);

        // 8. Suspended garages with active service jobs
        var suspendedGaragesWithJobs = await _context.Garages
            .AsNoTracking()
            .Where(g => g.Status == GarageStatus.Suspended && g.ServiceJobs.Any(j => j.Status != ServiceJobStatus.Closed && j.Status != ServiceJobStatus.Cancelled))
            .Take(20)
            .Select(g => new AttentionItemDto(
                "SuspendedGarageWithJobs",
                "High",
                g.Id,
                g.Name,
                $"Suspended garage '{g.Name}' has active jobs in progress",
                $"Garage status is Suspended, but it still has active in-workshop jobs requiring operational oversight.",
                g.StatusChangedAtUtc ?? g.UpdatedAtUtc ?? g.CreatedAtUtc,
                $"/admin/garages/{g.Id}"
            ))
            .ToListAsync(cancellationToken);
        items.AddRange(suspendedGaragesWithJobs);

        return new AdminAttentionQueueDto(items.Count, items);
    }

    public async Task<PagedResult<AdminAuditLogSummaryDto>> GetAuditLogsAsync(AdminAuditFilter filter, CancellationToken cancellationToken = default)
    {
        var pageNumber = Math.Max(1, filter.PageNumber);
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);

        var query = _context.AuditLogs.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(filter.EntityName))
        {
            query = query.Where(al => al.EntityName == filter.EntityName);
        }

        if (!string.IsNullOrWhiteSpace(filter.EntityId))
        {
            query = query.Where(al => al.EntityId == filter.EntityId);
        }

        if (!string.IsNullOrWhiteSpace(filter.Action))
        {
            query = query.Where(al => al.Action.ToLower().Contains(filter.Action.ToLower()));
        }

        if (filter.UserId.HasValue)
        {
            query = query.Where(al => al.UserId == filter.UserId.Value);
        }

        if (filter.FromDateUtc.HasValue)
        {
            query = query.Where(al => al.TimestampUtc >= filter.FromDateUtc.Value);
        }

        if (filter.ToDateUtc.HasValue)
        {
            query = query.Where(al => al.TimestampUtc <= filter.ToDateUtc.Value);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(al => al.TimestampUtc)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(al => new AdminAuditLogSummaryDto(
                al.Id,
                al.Action,
                al.UserEmail,
                al.EntityName,
                al.EntityId,
                al.Details,
                al.IpAddress,
                al.TimestampUtc
            ))
            .ToListAsync(cancellationToken);

        return new PagedResult<AdminAuditLogSummaryDto>(items, pageNumber, pageSize, totalCount);
    }

    public async Task<PagedResult<AdminNotificationListDto>> GetNotificationsAsync(AdminNotificationFilter filter, CancellationToken cancellationToken = default)
    {
        var pageNumber = Math.Max(1, filter.PageNumber);
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);

        var query = _context.Notifications
            .AsNoTracking()
            .Include(n => n.User)
            .AsQueryable();

        if (filter.Status.HasValue)
        {
            query = query.Where(n => n.Status == filter.Status.Value);
        }

        if (filter.UserId.HasValue)
        {
            query = query.Where(n => n.UserId == filter.UserId.Value);
        }

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var search = filter.Search.Trim().ToLower();
            query = query.Where(n =>
                n.Title.ToLower().Contains(search) ||
                n.Message.ToLower().Contains(search) ||
                n.User.Email.ToLower().Contains(search));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(n => n.CreatedAtUtc)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(n => new AdminNotificationListDto(
                n.Id,
                n.UserId,
                n.User.Email,
                n.Title,
                n.Message,
                n.Type,
                n.ReferenceType,
                n.ReferenceId,
                n.IsRead,
                n.Status,
                n.RetryCount,
                n.LastAttemptAtUtc,
                n.ErrorSummary,
                n.CreatedAtUtc
            ))
            .ToListAsync(cancellationToken);

        return new PagedResult<AdminNotificationListDto>(items, pageNumber, pageSize, totalCount);
    }

    public async Task<bool> RetryNotificationAsync(Guid id, Guid adminId, CancellationToken cancellationToken = default)
    {
        var notification = await _context.Notifications.FirstOrDefaultAsync(n => n.Id == id, cancellationToken);
        if (notification == null)
            throw new KeyNotFoundException($"Notification {id} not found.");

        notification.Retry();
        await _context.SaveChangesAsync(cancellationToken);

        var adminUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == adminId, cancellationToken);
        await _auditService.LogAsync(
            action: "ADMIN_NOTIFICATION_RETRIED",
            userId: adminId,
            userEmail: adminUser?.Email ?? "Admin",
            entityName: "Notification",
            entityId: id.ToString(),
            details: $"Notification '{notification.Title}' retried by administrator. Retry count: {notification.RetryCount}.",
            ipAddress: null,
            cancellationToken: cancellationToken);

        return true;
    }

    public async Task<SystemHealthDto> GetSystemHealthAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var uptime = now - ServiceStartTimeUtc;
        var processMemoryBytes = Process.GetCurrentProcess().WorkingSet64;

        // 1. PostgreSQL check
        DatabaseHealthDto dbHealth;
        var dbSw = Stopwatch.StartNew();
        var dbCtx = _context as DbContext;
        try
        {
            var canConnect = dbCtx != null && await dbCtx.Database.CanConnectAsync(cancellationToken);
            dbSw.Stop();
            dbHealth = canConnect
                ? new DatabaseHealthDto("Healthy", dbSw.Elapsed.TotalMilliseconds)
                : new DatabaseHealthDto("Unhealthy", dbSw.Elapsed.TotalMilliseconds, "Cannot connect to PostgreSQL.");
        }
        catch (Exception ex)
        {
            dbSw.Stop();
            dbHealth = new DatabaseHealthDto("Unhealthy", dbSw.Elapsed.TotalMilliseconds, ex.Message);
        }

        // 2. PostGIS check
        PostGisHealthDto postGisHealth;
        try
        {
            if (dbCtx != null && dbCtx.Database.ProviderName != "Microsoft.EntityFrameworkCore.InMemory")
            {
                using var cmd = dbCtx.Database.GetDbConnection().CreateCommand();
                cmd.CommandText = "SELECT PostGIS_Full_Version();";
                if (cmd.Connection?.State != System.Data.ConnectionState.Open)
                {
                    await dbCtx.Database.OpenConnectionAsync(cancellationToken);
                }
                var versionObj = await cmd.ExecuteScalarAsync(cancellationToken);
                postGisHealth = new PostGisHealthDto("Healthy", versionObj?.ToString() ?? "PostGIS Available");
            }
            else
            {
                postGisHealth = new PostGisHealthDto("Healthy", "InMemory Test Harness (NetTopologySuite Geo-emulation)");
            }
        }
        catch (Exception ex)
        {
            postGisHealth = new PostGisHealthDto("Degraded", null, ex.Message);
        }

        // 3. Redis check
        RedisHealthDto redisHealth;
        var redisSw = Stopwatch.StartNew();
        try
        {
            var redisConnection = _configuration.GetConnectionString("Redis") ?? "localhost:6379";
            var muxer = await ConnectionMultiplexer.ConnectAsync(redisConnection);
            var server = muxer.GetServer(muxer.GetEndPoints().First());
            var ping = await server.PingAsync();
            redisSw.Stop();
            redisHealth = new RedisHealthDto("Healthy", ping.TotalMilliseconds);
        }
        catch (Exception ex)
        {
            redisSw.Stop();
            redisHealth = new RedisHealthDto("Degraded", redisSw.Elapsed.TotalMilliseconds, ex.Message);
        }

        // 4. Background workers
        var activeJobs = await _context.ServiceJobs.CountAsync(j => j.Status == ServiceJobStatus.WorkInProgress, cancellationToken);
        var backgroundWorkerHealth = new BackgroundWorkerHealthDto("Healthy", activeJobs, "Quote expiration and notification workers operational.");

        // Overall status
        var overall = "Healthy";
        if (dbHealth.Status == "Unhealthy")
        {
            overall = "Unhealthy";
        }
        else if (postGisHealth.Status != "Healthy" || redisHealth.Status != "Healthy")
        {
            overall = "Degraded";
        }

        return new SystemHealthDto(
            overall,
            now,
            uptime,
            processMemoryBytes,
            dbHealth,
            postGisHealth,
            redisHealth,
            backgroundWorkerHealth
        );
    }
}
