using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Enums;
using BroCoMod.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BroCoMod.Infrastructure.Services;

public class ServiceJobService : IServiceJobService
{
    private readonly ApplicationDbContext _context;
    private readonly IServiceJobNumberGenerator _jobNumberGenerator;
    private readonly IAuditService _auditService;
    private readonly INotificationService _notificationService;
    private readonly ILogger<ServiceJobService> _logger;

    public ServiceJobService(
        ApplicationDbContext context,
        IServiceJobNumberGenerator jobNumberGenerator,
        IAuditService auditService,
        INotificationService notificationService,
        ILogger<ServiceJobService> logger)
    {
        _context = context;
        _jobNumberGenerator = jobNumberGenerator;
        _auditService = auditService;
        _notificationService = notificationService;
        _logger = logger;
    }

    private async Task<Guid> ResolveCustomerIdAsync(Guid customerIdOrUserId, CancellationToken ct)
    {
        var profile = await _context.CustomerProfiles
            .FirstOrDefaultAsync(cp => cp.Id == customerIdOrUserId || cp.UserId == customerIdOrUserId, ct);
        return profile?.Id ?? customerIdOrUserId;
    }

    private async Task<Guid> ResolveCustomerUserIdAsync(Guid customerIdOrProfileId, CancellationToken ct)
    {
        var profile = await _context.CustomerProfiles
            .FirstOrDefaultAsync(cp => cp.Id == customerIdOrProfileId || cp.UserId == customerIdOrProfileId, ct);
        return profile?.UserId ?? customerIdOrProfileId;
    }

    #region Queries

    public async Task<IEnumerable<ServiceJobSummaryDto>> GetGarageJobsAsync(
        Guid garageId,
        string? status = null,
        CancellationToken cancellationToken = default)
    {
        var query = _context.ServiceJobs
            .AsNoTracking()
            .Include(j => j.ServiceRequest)
            .Include(j => j.Garage)
            .Where(j => j.GarageId == garageId);

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<ServiceJobStatus>(status, true, out var parsedStatus))
        {
            query = query.Where(j => j.Status == parsedStatus);
        }

        var jobs = await query
            .OrderByDescending(j => j.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        return jobs.Select(MapToSummaryDto);
    }

    public async Task<GarageServiceJobDetailDto> GetGarageJobDetailAsync(
        Guid jobId,
        Guid garageId,
        CancellationToken cancellationToken = default)
    {
        var job = await _context.ServiceJobs
            .Include(j => j.ServiceRequest)
                .ThenInclude(sr => sr!.CustomerProfile)
                    .ThenInclude(cp => cp!.User)
            .Include(j => j.Garage)
            .Include(j => j.CustomerQuotation)
            .Include(j => j.Inspections)
            .Include(j => j.Activities)
            .Include(j => j.AdditionalWorkRequests)
            .FirstOrDefaultAsync(j => j.Id == jobId, cancellationToken);

        if (job == null)
            throw new KeyNotFoundException($"Service job with ID '{jobId}' was not found.");

        if (job.GarageId != garageId)
            throw new UnauthorizedAccessException("Access denied. You do not have permission to view jobs for another garage.");

        return MapToGarageDetailDto(job);
    }

    public async Task<CustomerServiceJobDetailDto> GetCustomerJobDetailAsync(
        Guid serviceRequestId,
        Guid customerId,
        CancellationToken cancellationToken = default)
    {
        var resolvedCustomerId = await ResolveCustomerIdAsync(customerId, cancellationToken);

        var job = await _context.ServiceJobs
            .AsNoTracking()
            .Include(j => j.ServiceRequest)
            .Include(j => j.Garage)
            .Include(j => j.Inspections)
            .Include(j => j.Activities)
            .FirstOrDefaultAsync(j => j.ServiceRequestId == serviceRequestId, cancellationToken);

        if (job == null)
            throw new KeyNotFoundException($"Service job for request '{serviceRequestId}' was not found.");

        if (job.ServiceRequest?.CustomerId != resolvedCustomerId)
            throw new UnauthorizedAccessException("Access denied. You do not have permission to view this service job.");

        return MapToCustomerDetailDto(job);
    }

    public async Task<CustomerServiceJobDetailDto> GetCustomerJobByIdAsync(
        Guid jobId,
        Guid customerId,
        CancellationToken cancellationToken = default)
    {
        var resolvedCustomerId = await ResolveCustomerIdAsync(customerId, cancellationToken);

        var job = await _context.ServiceJobs
            .AsNoTracking()
            .Include(j => j.ServiceRequest)
            .Include(j => j.Garage)
            .Include(j => j.Inspections)
            .Include(j => j.Activities)
            .FirstOrDefaultAsync(j => j.Id == jobId, cancellationToken);

        if (job == null)
            throw new KeyNotFoundException($"Service job with ID '{jobId}' was not found.");

        if (job.ServiceRequest?.CustomerId != resolvedCustomerId)
            throw new UnauthorizedAccessException("Access denied. You do not have permission to view this service job.");

        return MapToCustomerDetailDto(job);
    }

    public async Task<AdvisorServiceJobDetailDto> GetAdvisorJobDetailAsync(
        Guid jobId,
        CancellationToken cancellationToken = default)
    {
        var job = await _context.ServiceJobs
            .AsNoTracking()
            .Include(j => j.ServiceRequest)
                .ThenInclude(sr => sr!.CustomerProfile)
                    .ThenInclude(cp => cp!.User)
            .Include(j => j.Garage)
            .Include(j => j.CustomerQuotation)
            .Include(j => j.Inspections)
            .Include(j => j.Activities)
            .Include(j => j.AdditionalWorkRequests)
            .FirstOrDefaultAsync(j => j.Id == jobId, cancellationToken);

        if (job == null)
            throw new KeyNotFoundException($"Service job with ID '{jobId}' was not found.");

        return MapToAdvisorDetailDto(job);
    }

    public async Task<IEnumerable<ServiceJobSummaryDto>> GetAllJobsAsync(
        string? status = null,
        Guid? garageId = null,
        CancellationToken cancellationToken = default)
    {
        var query = _context.ServiceJobs
            .AsNoTracking()
            .Include(j => j.ServiceRequest)
            .Include(j => j.Garage)
            .AsQueryable();

        if (garageId.HasValue && garageId.Value != Guid.Empty)
        {
            query = query.Where(j => j.GarageId == garageId.Value);
        }

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<ServiceJobStatus>(status, true, out var parsedStatus))
        {
            query = query.Where(j => j.Status == parsedStatus);
        }

        var jobs = await query
            .OrderByDescending(j => j.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        return jobs.Select(MapToSummaryDto);
    }

    #endregion

    #region Lifecycle Commands (Garage Operations)

    public async Task<GarageServiceJobDetailDto> ScheduleJobAsync(
        Guid jobId,
        Guid garageId,
        Guid userId,
        ScheduleJobRequest request,
        CancellationToken cancellationToken = default)
    {
        var job = await GetJobForGarageActionAsync(jobId, garageId, cancellationToken);

        job.Schedule(request.ScheduledStartAtUtc, request.EstimatedCompletionAtUtc, userId);

        var activity = new ServiceJobActivity(
            serviceJobId: job.Id,
            activityType: JobActivityType.JobScheduled,
            message: $"Job scheduled for {request.ScheduledStartAtUtc:yyyy-MM-dd HH:mm} UTC. Estimated completion: {request.EstimatedCompletionAtUtc:yyyy-MM-dd HH:mm} UTC.",
            isCustomerVisible: true,
            createdByUserId: userId
        );
        _context.ServiceJobActivities.Add(activity);

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: "SERVICE_JOB_SCHEDULED",
            userId: userId,
            userEmail: "GarageUser",
            entityName: "ServiceJob",
            entityId: job.Id.ToString(),
            details: $"Job #{job.JobNumber} scheduled to start {request.ScheduledStartAtUtc:u}",
            cancellationToken: cancellationToken
        );

        if (job.ServiceRequest?.CustomerId != null)
        {
            var customerUserId = await ResolveCustomerUserIdAsync(job.ServiceRequest.CustomerId, cancellationToken);
            await _notificationService.SendInAppNotificationAsync(
                userId: customerUserId,
                title: "Service Scheduled",
                message: $"Your service for {job.ServiceRequest.VehicleMake} {job.ServiceRequest.VehicleModel} has been scheduled for {request.ScheduledStartAtUtc:g}.",
                type: "JobScheduled",
                referenceId: job.ServiceRequestId,
                referenceType: "ServiceRequest",
                cancellationToken: cancellationToken
            );
        }

        return MapToGarageDetailDto(job);
    }

    public async Task<GarageServiceJobDetailDto> ReceiveVehicleAsync(
        Guid jobId,
        Guid garageId,
        Guid userId,
        ReceiveVehicleRequest request,
        CancellationToken cancellationToken = default)
    {
        var job = await GetJobForGarageActionAsync(jobId, garageId, cancellationToken);

        job.ReceiveVehicle(request.CurrentMileageKm ?? 0, request.Notes, null, userId);

        var mileageMsg = request.CurrentMileageKm.HasValue ? $" Mileage: {request.CurrentMileageKm.Value:N0} km." : string.Empty;
        var activity = new ServiceJobActivity(
            serviceJobId: job.Id,
            activityType: JobActivityType.VehicleReceived,
            message: $"Vehicle received at workshop.{mileageMsg}",
            isCustomerVisible: true,
            createdByUserId: userId
        );
        _context.ServiceJobActivities.Add(activity);

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: "SERVICE_VEHICLE_RECEIVED",
            userId: userId,
            userEmail: "GarageUser",
            entityName: "ServiceJob",
            entityId: job.Id.ToString(),
            details: $"Vehicle received at workshop for Job #{job.JobNumber}. Mileage: {request.CurrentMileageKm}",
            cancellationToken: cancellationToken
        );

        if (job.ServiceRequest?.CustomerId != null)
        {
            var customerUserId = await ResolveCustomerUserIdAsync(job.ServiceRequest.CustomerId, cancellationToken);
            await _notificationService.SendInAppNotificationAsync(
                userId: customerUserId,
                title: "Vehicle Received",
                message: $"Your vehicle ({job.ServiceRequest.VehicleMake} {job.ServiceRequest.VehicleModel}) has been received at the workshop.",
                type: "VehicleReceived",
                referenceId: job.ServiceRequestId,
                referenceType: "ServiceRequest",
                cancellationToken: cancellationToken
            );
        }

        return MapToGarageDetailDto(job);
    }

    public async Task<GarageServiceJobDetailDto> StartInspectionAsync(
        Guid jobId,
        Guid garageId,
        Guid userId,
        StartInspectionRequest request,
        CancellationToken cancellationToken = default)
    {
        var job = await GetJobForGarageActionAsync(jobId, garageId, cancellationToken);

        job.StartInspection(userId);

        var inspection = new ServiceInspection(job.Id, userId, request.Severity);
        _context.ServiceInspections.Add(inspection);

        var activity = new ServiceJobActivity(
            serviceJobId: job.Id,
            activityType: JobActivityType.InspectionStarted,
            message: "Technician began physical inspection of the vehicle.",
            isCustomerVisible: true,
            createdByUserId: userId
        );
        _context.ServiceJobActivities.Add(activity);

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: "SERVICE_INSPECTION_STARTED",
            userId: userId,
            userEmail: "GarageUser",
            entityName: "ServiceJob",
            entityId: job.Id.ToString(),
            details: $"Physical inspection started for Job #{job.JobNumber}",
            cancellationToken: cancellationToken
        );

        return MapToGarageDetailDto(job);
    }

    public async Task<GarageServiceJobDetailDto> CompleteInspectionAsync(
        Guid jobId,
        Guid garageId,
        Guid userId,
        CompleteInspectionRequest request,
        CancellationToken cancellationToken = default)
    {
        var job = await GetJobForGarageActionAsync(jobId, garageId, cancellationToken);

        job.CompleteInspection(userId);

        var inspection = job.Inspections.OrderByDescending(i => i.InspectionStartedAtUtc).FirstOrDefault();
        if (inspection != null && inspection.InspectionCompletedAtUtc == null)
        {
            inspection.Complete(request.Findings, request.Recommendations, request.CustomerVisibleSummary, request.Severity);
        }
        else
        {
            var newInspection = new ServiceInspection(job.Id, userId, request.Severity);
            newInspection.Complete(request.Findings, request.Recommendations, request.CustomerVisibleSummary, request.Severity);
            _context.ServiceInspections.Add(newInspection);
        }

        var activity = new ServiceJobActivity(
            serviceJobId: job.Id,
            activityType: JobActivityType.InspectionCompleted,
            message: "Vehicle inspection completed. Technicians finalized assessment.",
            isCustomerVisible: true,
            createdByUserId: userId
        );
        _context.ServiceJobActivities.Add(activity);

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: "SERVICE_INSPECTION_COMPLETED",
            userId: userId,
            userEmail: "GarageUser",
            entityName: "ServiceJob",
            entityId: job.Id.ToString(),
            details: $"Inspection completed for Job #{job.JobNumber}. Severity: {request.Severity}",
            cancellationToken: cancellationToken
        );

        if (job.ServiceRequest?.CustomerId != null)
        {
            var customerUserId = await ResolveCustomerUserIdAsync(job.ServiceRequest.CustomerId, cancellationToken);
            await _notificationService.SendInAppNotificationAsync(
                userId: customerUserId,
                title: "Inspection Complete",
                message: $"Inspection completed for your {job.ServiceRequest.VehicleMake} {job.ServiceRequest.VehicleModel}. Workshop is ready to proceed.",
                type: "InspectionCompleted",
                referenceId: job.ServiceRequestId,
                referenceType: "ServiceRequest",
                cancellationToken: cancellationToken
            );
        }

        return MapToGarageDetailDto(job);
    }

    public async Task<GarageServiceJobDetailDto> StartWorkAsync(
        Guid jobId,
        Guid garageId,
        Guid userId,
        StartWorkRequest request,
        CancellationToken cancellationToken = default)
    {
        var job = await GetJobForGarageActionAsync(jobId, garageId, cancellationToken);

        job.StartWork(userId);

        var activity = new ServiceJobActivity(
            serviceJobId: job.Id,
            activityType: JobActivityType.WorkStarted,
            message: "Service and repair work has commenced on the vehicle.",
            isCustomerVisible: true,
            createdByUserId: userId
        );
        _context.ServiceJobActivities.Add(activity);

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: "SERVICE_WORK_STARTED",
            userId: userId,
            userEmail: "GarageUser",
            entityName: "ServiceJob",
            entityId: job.Id.ToString(),
            details: $"Work started on Job #{job.JobNumber}",
            cancellationToken: cancellationToken
        );

        if (job.ServiceRequest?.CustomerId != null)
        {
            var customerUserId = await ResolveCustomerUserIdAsync(job.ServiceRequest.CustomerId, cancellationToken);
            await _notificationService.SendInAppNotificationAsync(
                userId: customerUserId,
                title: "Service Work Started",
                message: $"Workshop has commenced service and repairs on your {job.ServiceRequest.VehicleMake} {job.ServiceRequest.VehicleModel}.",
                type: "WorkStarted",
                referenceId: job.ServiceRequestId,
                referenceType: "ServiceRequest",
                cancellationToken: cancellationToken
            );
        }

        return MapToGarageDetailDto(job);
    }

    public async Task<GarageServiceJobDetailDto> UpdateJobProgressAsync(
        Guid jobId,
        Guid garageId,
        Guid userId,
        UpdateJobProgressRequest request,
        CancellationToken cancellationToken = default)
    {
        var job = await GetJobForGarageActionAsync(jobId, garageId, cancellationToken);

        job.UpdateProgress(request.ProgressNotes, request.IsCustomerVisible ? request.ProgressNotes : null, userId);

        var activity = new ServiceJobActivity(
            serviceJobId: job.Id,
            activityType: JobActivityType.WorkProgressUpdated,
            message: request.ProgressNotes,
            isCustomerVisible: request.IsCustomerVisible,
            createdByUserId: userId
        );
        _context.ServiceJobActivities.Add(activity);

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: "SERVICE_PROGRESS_UPDATED",
            userId: userId,
            userEmail: "GarageUser",
            entityName: "ServiceJob",
            entityId: job.Id.ToString(),
            details: $"Progress updated for Job #{job.JobNumber}: {request.ProgressNotes}",
            cancellationToken: cancellationToken
        );

        if (request.IsCustomerVisible && job.ServiceRequest?.CustomerId != null)
        {
            var customerUserId = await ResolveCustomerUserIdAsync(job.ServiceRequest.CustomerId, cancellationToken);
            await _notificationService.SendInAppNotificationAsync(
                userId: customerUserId,
                title: "Service Progress Update",
                message: request.ProgressNotes,
                type: "WorkProgressUpdated",
                referenceId: job.ServiceRequestId,
                referenceType: "ServiceRequest",
                cancellationToken: cancellationToken
            );
        }

        return MapToGarageDetailDto(job);
    }

    public async Task<GarageServiceJobDetailDto> CompleteWorkAsync(
        Guid jobId,
        Guid garageId,
        Guid userId,
        CompleteWorkRequest request,
        CancellationToken cancellationToken = default)
    {
        var job = await GetJobForGarageActionAsync(jobId, garageId, cancellationToken);

        job.CompleteWork(userId);

        var activity = new ServiceJobActivity(
            serviceJobId: job.Id,
            activityType: JobActivityType.WorkCompleted,
            message: "All service and mechanical work completed by technicians.",
            isCustomerVisible: true,
            createdByUserId: userId
        );
        _context.ServiceJobActivities.Add(activity);

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: "SERVICE_WORK_COMPLETED",
            userId: userId,
            userEmail: "GarageUser",
            entityName: "ServiceJob",
            entityId: job.Id.ToString(),
            details: $"Work completed on Job #{job.JobNumber}",
            cancellationToken: cancellationToken
        );

        if (job.ServiceRequest?.CustomerId != null)
        {
            var customerUserId = await ResolveCustomerUserIdAsync(job.ServiceRequest.CustomerId, cancellationToken);
            await _notificationService.SendInAppNotificationAsync(
                userId: customerUserId,
                title: "Work Completed",
                message: $"All service work on your {job.ServiceRequest.VehicleMake} {job.ServiceRequest.VehicleModel} has been completed.",
                type: "WorkCompleted",
                referenceId: job.ServiceRequestId,
                referenceType: "ServiceRequest",
                cancellationToken: cancellationToken
            );
        }

        return MapToGarageDetailDto(job);
    }

    public async Task<GarageServiceJobDetailDto> MarkVehicleReadyAsync(
        Guid jobId,
        Guid garageId,
        Guid userId,
        VehicleReadyRequest request,
        CancellationToken cancellationToken = default)
    {
        var job = await GetJobForGarageActionAsync(jobId, garageId, cancellationToken);

        job.MarkVehicleReady(request.CustomerFacingNotes, userId);

        var activity = new ServiceJobActivity(
            serviceJobId: job.Id,
            activityType: JobActivityType.VehicleReady,
            message: "Vehicle is cleaned, inspected, and ready for pickup/delivery.",
            isCustomerVisible: true,
            createdByUserId: userId
        );
        _context.ServiceJobActivities.Add(activity);

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: "SERVICE_VEHICLE_READY",
            userId: userId,
            userEmail: "GarageUser",
            entityName: "ServiceJob",
            entityId: job.Id.ToString(),
            details: $"Vehicle marked ready for Job #{job.JobNumber}",
            cancellationToken: cancellationToken
        );

        if (job.ServiceRequest?.CustomerId != null)
        {
            var customerUserId = await ResolveCustomerUserIdAsync(job.ServiceRequest.CustomerId, cancellationToken);
            await _notificationService.SendInAppNotificationAsync(
                userId: customerUserId,
                title: "Vehicle Ready for Pickup",
                message: $"Your {job.ServiceRequest.VehicleMake} {job.ServiceRequest.VehicleModel} is ready for pickup/handover at {job.Garage?.Name}!",
                type: "VehicleReady",
                referenceId: job.ServiceRequestId,
                referenceType: "ServiceRequest",
                cancellationToken: cancellationToken
            );
        }

        return MapToGarageDetailDto(job);
    }

    public async Task<GarageServiceJobDetailDto> HandOverVehicleAsync(
        Guid jobId,
        Guid garageId,
        Guid userId,
        HandOverVehicleRequest request,
        CancellationToken cancellationToken = default)
    {
        var job = await GetJobForGarageActionAsync(jobId, garageId, cancellationToken);

        job.HandOverVehicle(request.HandoverNotes, userId);

        var activity = new ServiceJobActivity(
            serviceJobId: job.Id,
            activityType: JobActivityType.VehicleHandedOver,
            message: "Vehicle handed over to customer.",
            isCustomerVisible: true,
            createdByUserId: userId
        );
        _context.ServiceJobActivities.Add(activity);

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: "SERVICE_VEHICLE_HANDED_OVER",
            userId: userId,
            userEmail: "GarageUser",
            entityName: "ServiceJob",
            entityId: job.Id.ToString(),
            details: $"Vehicle handed over to customer for Job #{job.JobNumber}",
            cancellationToken: cancellationToken
        );

        if (job.ServiceRequest?.CustomerId != null)
        {
            var customerUserId = await ResolveCustomerUserIdAsync(job.ServiceRequest.CustomerId, cancellationToken);
            await _notificationService.SendInAppNotificationAsync(
                userId: customerUserId,
                title: "Vehicle Handed Over",
                message: $"Vehicle handover confirmed for {job.ServiceRequest.VehicleMake} {job.ServiceRequest.VehicleModel}. Thank you for choosing BroCoMod!",
                type: "HandedOver",
                referenceId: job.ServiceRequestId,
                referenceType: "ServiceRequest",
                cancellationToken: cancellationToken
            );
        }

        return MapToGarageDetailDto(job);
    }

    public async Task<GarageServiceJobDetailDto> CloseJobAsync(
        Guid jobId,
        Guid garageId,
        Guid userId,
        CloseJobRequest request,
        CancellationToken cancellationToken = default)
    {
        var job = await GetJobForGarageActionAsync(jobId, garageId, cancellationToken);

        job.CloseJob(request.ClosingRemarks, userId);

        var activity = new ServiceJobActivity(
            serviceJobId: job.Id,
            activityType: JobActivityType.JobClosed,
            message: "Job closed and finalized in system.",
            isCustomerVisible: false,
            createdByUserId: userId
        );
        _context.ServiceJobActivities.Add(activity);

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: "SERVICE_JOB_CLOSED",
            userId: userId,
            userEmail: "GarageUser",
            entityName: "ServiceJob",
            entityId: job.Id.ToString(),
            details: $"Job #{job.JobNumber} closed.",
            cancellationToken: cancellationToken
        );

        return MapToGarageDetailDto(job);
    }

    public async Task<GarageServiceJobDetailDto> CancelJobAsync(
        Guid jobId,
        Guid garageId,
        Guid userId,
        CancelJobRequest request,
        CancellationToken cancellationToken = default)
    {
        var job = await GetJobForGarageActionAsync(jobId, garageId, cancellationToken);

        job.Cancel(request.Reason, userId);

        var activity = new ServiceJobActivity(
            serviceJobId: job.Id,
            activityType: JobActivityType.JobCancelled,
            message: $"Job cancelled. Reason: {request.Reason}",
            isCustomerVisible: true,
            createdByUserId: userId
        );
        _context.ServiceJobActivities.Add(activity);

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: "SERVICE_JOB_CANCELLED",
            userId: userId,
            userEmail: "GarageUser",
            entityName: "ServiceJob",
            entityId: job.Id.ToString(),
            details: $"Job #{job.JobNumber} cancelled: {request.Reason}",
            cancellationToken: cancellationToken
        );

        if (job.ServiceRequest?.CustomerId != null)
        {
            var customerUserId = await ResolveCustomerUserIdAsync(job.ServiceRequest.CustomerId, cancellationToken);
            await _notificationService.SendInAppNotificationAsync(
                userId: customerUserId,
                title: "Service Cancelled",
                message: $"Your service job #{job.JobNumber} has been cancelled: {request.Reason}",
                type: "JobCancelled",
                referenceId: job.ServiceRequestId,
                referenceType: "ServiceRequest",
                cancellationToken: cancellationToken
            );
        }

        return MapToGarageDetailDto(job);
    }

    #endregion

    #region Additional Work Requests

    public async Task<AdditionalWorkRequestDto> CreateAdditionalWorkRequestAsync(
        Guid jobId,
        Guid garageId,
        Guid userId,
        CreateAdditionalWorkRequest request,
        CancellationToken cancellationToken = default)
    {
        var job = await GetJobForGarageActionAsync(jobId, garageId, cancellationToken);

        // Can only request additional work during intake/active inspection/work
        if (job.Status != ServiceJobStatus.VehicleReceived &&
            job.Status != ServiceJobStatus.Inspection &&
            job.Status != ServiceJobStatus.WorkStarted &&
            job.Status != ServiceJobStatus.WorkInProgress)
        {
            throw new InvalidOperationException($"Cannot request additional work when job is in status '{job.Status}'. Work must be actively underway.");
        }

        var workReq = new AdditionalWorkRequest(
            serviceJobId: job.Id,
            description: request.Description,
            estimatedAdditionalAmount: request.EstimatedAdditionalAmount,
            reason: request.Reason,
            createdByUserId: userId
        );

        _context.AdditionalWorkRequests.Add(workReq);

        var activity = new ServiceJobActivity(
            serviceJobId: job.Id,
            activityType: JobActivityType.AdditionalWorkRequested,
            message: $"Additional work proposed by workshop: '{request.Description}' (Est: ₹{request.EstimatedAdditionalAmount:N2})",
            isCustomerVisible: false,
            createdByUserId: userId
        );
        _context.ServiceJobActivities.Add(activity);

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: "ADDITIONAL_WORK_REQUESTED",
            userId: userId,
            userEmail: "GarageUser",
            entityName: "AdditionalWorkRequest",
            entityId: workReq.Id.ToString(),
            details: $"Additional work requested for Job #{job.JobNumber}: {request.Description} (₹{request.EstimatedAdditionalAmount})",
            cancellationToken: cancellationToken
        );

        // Notify assigned Advisor if applicable
        if (job.ServiceRequest?.AssignedAdvisorId.HasValue == true)
        {
            var advisorProfile = await _context.AdvisorProfiles
                .FirstOrDefaultAsync(ap => ap.Id == job.ServiceRequest.AssignedAdvisorId.Value, cancellationToken);
            if (advisorProfile != null)
            {
                await _notificationService.SendInAppNotificationAsync(
                    userId: advisorProfile.UserId,
                    title: "Additional Work Requested",
                    message: $"Workshop submitted an additional repair request (₹{request.EstimatedAdditionalAmount:N2}) for Job #{job.JobNumber}.",
                    type: "AdditionalWorkRequested",
                    referenceId: job.ServiceRequestId,
                    referenceType: "ServiceRequest",
                    cancellationToken: cancellationToken
                );
            }
        }

        return MapToAdditionalWorkDto(workReq);
    }

    public async Task<AdditionalWorkRequestDto> ReviewAdditionalWorkRequestAsync(
        Guid workRequestId,
        Guid advisorId,
        ReviewAdditionalWorkRequest request,
        CancellationToken cancellationToken = default)
    {
        var workReq = await _context.AdditionalWorkRequests
            .Include(r => r.ServiceJob)
                .ThenInclude(j => j!.ServiceRequest)
            .Include(r => r.ServiceJob)
                .ThenInclude(j => j!.Garage)
            .FirstOrDefaultAsync(r => r.Id == workRequestId, cancellationToken);

        if (workReq == null)
            throw new KeyNotFoundException($"Additional work request with ID '{workRequestId}' was not found.");

        if (request.Approved)
        {
            workReq.Approve(advisorId, request.Remarks);
        }
        else
        {
            workReq.Reject(advisorId, request.Remarks);
        }

        var decisionWord = request.Approved ? "Approved" : "Rejected";
        var activity = new ServiceJobActivity(
            serviceJobId: workReq.ServiceJobId,
            activityType: JobActivityType.AdditionalWorkReviewed,
            message: $"Advisor {decisionWord.ToLowerInvariant()} additional work request: '{workReq.Description}'. Remarks: {request.Remarks ?? "None"}",
            isCustomerVisible: false,
            createdByUserId: advisorId
        );
        _context.ServiceJobActivities.Add(activity);

        // Crucial Invariant: Does NOT mutate customer's accepted quotation or charge customer
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: $"ADDITIONAL_WORK_{decisionWord.ToUpperInvariant()}",
            userId: advisorId,
            userEmail: "Advisor",
            entityName: "AdditionalWorkRequest",
            entityId: workReq.Id.ToString(),
            details: $"Additional work request {decisionWord} by advisor: {workReq.Description}",
            cancellationToken: cancellationToken
        );

        return MapToAdditionalWorkDto(workReq);
    }

    #endregion

    #region Internal Booking Integration

    public async Task<ServiceJobSummaryDto> CreateJobForAcceptedBookingAsync(
        Guid serviceRequestId,
        Guid garageAssignmentId,
        Guid quotationId,
        Guid garageId,
        Guid customerUserId,
        CancellationToken cancellationToken = default)
    {
        // Idempotency check: see if job already exists
        var existingJob = await _context.ServiceJobs
            .Include(j => j.Garage)
            .Include(j => j.ServiceRequest)
            .FirstOrDefaultAsync(j => j.GarageAssignmentId == garageAssignmentId || j.CustomerQuotationId == quotationId, cancellationToken);

        if (existingJob != null)
        {
            _logger.LogInformation("Job already exists for booking assignment {AssignmentId}. Job #{JobNumber}",
                garageAssignmentId, existingJob.JobNumber);
            return MapToSummaryDto(existingJob);
        }

        var serviceRequest = await _context.ServiceRequests.FindAsync(new object[] { serviceRequestId }, cancellationToken);
        var complaintSnapshot = serviceRequest?.ProblemDescription ?? "Standard Service";

        var jobNumber = await _jobNumberGenerator.NextJobNumberAsync(cancellationToken);

        var job = new ServiceJob(
            serviceRequestId: serviceRequestId,
            garageAssignmentId: garageAssignmentId,
            customerQuotationId: quotationId,
            garageId: garageId,
            jobNumber: jobNumber,
            customerComplaintSnapshot: complaintSnapshot,
            createdByUserId: customerUserId
        );

        var activity = new ServiceJobActivity(
            serviceJobId: job.Id,
            activityType: JobActivityType.JobCreated,
            message: $"Service job #{jobNumber} initialized upon customer booking confirmation.",
            isCustomerVisible: true,
            createdByUserId: customerUserId
        );

        _context.ServiceJobs.Add(job);
        _context.ServiceJobActivities.Add(activity);

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: "SERVICE_JOB_CREATED",
            userId: customerUserId,
            userEmail: "System",
            entityName: "ServiceJob",
            entityId: job.Id.ToString(),
            details: $"Created ServiceJob #{jobNumber} for ServiceRequest {serviceRequestId}",
            cancellationToken: cancellationToken
        );

        return MapToSummaryDto(job);
    }

    #endregion

    #region Private Helpers

    private async Task<ServiceJob> GetJobForGarageActionAsync(Guid jobId, Guid garageId, CancellationToken ct)
    {
        var job = await _context.ServiceJobs
            .Include(j => j.ServiceRequest)
            .Include(j => j.Garage)
            .Include(j => j.CustomerQuotation)
            .Include(j => j.Inspections)
            .Include(j => j.Activities)
            .Include(j => j.AdditionalWorkRequests)
            .FirstOrDefaultAsync(j => j.Id == jobId, ct);

        if (job == null)
            throw new KeyNotFoundException($"Service job with ID '{jobId}' was not found.");

        if (job.GarageId != garageId)
            throw new UnauthorizedAccessException("Access denied. You do not have permission to modify jobs for another garage.");

        return job;
    }

    private static ServiceJobSummaryDto MapToSummaryDto(ServiceJob job)
    {
        return new ServiceJobSummaryDto(
            Id: job.Id,
            JobNumber: job.JobNumber,
            ServiceRequestId: job.ServiceRequestId,
            RequestNumber: job.ServiceRequest?.RequestNumber ?? string.Empty,
            GarageId: job.GarageId,
            GarageName: job.Garage?.Name ?? "Workshop",
            Status: job.Status.ToString(),
            ScheduledStartAtUtc: job.ScheduledStartAtUtc,
            EstimatedCompletionAtUtc: job.EstimatedCompletionAtUtc,
            ActualWorkCompletedAtUtc: job.ActualWorkCompletedAtUtc,
            CreatedAtUtc: job.CreatedAtUtc
        );
    }

    private static GarageServiceJobDetailDto MapToGarageDetailDto(ServiceJob job)
    {
        var customerUser = job.ServiceRequest?.CustomerProfile?.User;
        var customerName = customerUser?.FullName ?? "Customer";

        return new GarageServiceJobDetailDto(
            Id: job.Id,
            JobNumber: job.JobNumber,
            ServiceRequestId: job.ServiceRequestId,
            RequestNumber: job.ServiceRequest?.RequestNumber ?? string.Empty,
            CustomerQuotationId: job.CustomerQuotationId,
            QuotationNumber: job.CustomerQuotation?.QuotationNumber ?? string.Empty,
            GarageId: job.GarageId,
            GarageName: job.Garage?.Name ?? "Workshop",
            Status: job.Status.ToString(),
            VehicleMake: job.ServiceRequest?.VehicleMake ?? string.Empty,
            VehicleModel: job.ServiceRequest?.VehicleModel ?? string.Empty,
            VehicleYear: job.ServiceRequest?.VehicleYear ?? 0,
            VehicleLicensePlate: job.ServiceRequest?.VehicleLicensePlate ?? string.Empty,
            CurrentMileageKm: job.CurrentMileageKm,
            CustomerName: customerName,
            CustomerPhone: customerUser?.PhoneNumber ?? string.Empty,
            ProblemDescription: job.ServiceRequest?.ProblemDescription ?? string.Empty,
            CustomerComplaintSnapshot: job.CustomerComplaintSnapshot,
            ScheduledStartAtUtc: job.ScheduledStartAtUtc,
            EstimatedCompletionAtUtc: job.EstimatedCompletionAtUtc,
            ActualVehicleReceivedAtUtc: job.ActualVehicleReceivedAtUtc,
            ActualWorkStartedAtUtc: job.ActualWorkStartedAtUtc,
            ActualWorkCompletedAtUtc: job.ActualWorkCompletedAtUtc,
            VehicleReadyAtUtc: job.VehicleReadyAtUtc,
            HandedOverAtUtc: job.HandedOverAtUtc,
            ClosedAtUtc: job.ClosedAtUtc,
            CancelledAtUtc: job.CancelledAtUtc,
            CancellationReason: job.CancellationReason,
            GarageInternalNotes: job.GarageInternalNotes,
            CustomerFacingNotes: job.CustomerFacingNotes,
            Inspections: job.Inspections.OrderBy(i => i.InspectionStartedAtUtc).Select(i => new ServiceInspectionDto(
                Id: i.Id,
                InspectorUserId: i.InspectorUserId,
                InspectorName: "Workshop Inspector",
                InspectionStartedAtUtc: i.InspectionStartedAtUtc,
                InspectionCompletedAtUtc: i.InspectionCompletedAtUtc,
                Findings: i.Findings,
                Recommendations: i.Recommendations,
                CustomerVisibleSummary: i.CustomerVisibleSummary,
                OverallSeverity: i.OverallSeverity.ToString(),
                CreatedAtUtc: i.CreatedAtUtc
            )).ToList(),
            Activities: job.Activities.OrderBy(a => a.CreatedAtUtc).Select(a => new ServiceJobActivityDto(
                Id: a.Id,
                ActivityType: a.ActivityType.ToString(),
                Message: a.Message,
                IsCustomerVisible: a.IsCustomerVisible,
                ActorName: "Workshop Staff",
                CreatedAtUtc: a.CreatedAtUtc
            )).ToList(),
            AdditionalWorkRequests: job.AdditionalWorkRequests.OrderBy(r => r.CreatedAtUtc).Select(MapToAdditionalWorkDto).ToList(),
            ConcurrencyToken: job.ConcurrencyToken
        );
    }

    private static CustomerServiceJobDetailDto MapToCustomerDetailDto(ServiceJob job)
    {
        var latestInspection = job.Inspections
            .Where(i => i.InspectionCompletedAtUtc != null)
            .OrderByDescending(i => i.InspectionCompletedAtUtc)
            .FirstOrDefault();

        CustomerServiceInspectionDto? inspectionDto = null;
        if (latestInspection != null)
        {
            // CRITICAL SANITIZATION: Never expose internal mechanical findings or technician recommendations to customer
            inspectionDto = new CustomerServiceInspectionDto(
                InspectionStartedAtUtc: latestInspection.InspectionStartedAtUtc,
                InspectionCompletedAtUtc: latestInspection.InspectionCompletedAtUtc,
                CustomerVisibleSummary: latestInspection.CustomerVisibleSummary,
                OverallSeverity: latestInspection.OverallSeverity.ToString()
            );
        }

        // Customer timeline: only customer visible events
        var visibleActivities = job.Activities
            .Where(a => a.IsCustomerVisible)
            .OrderBy(a => a.CreatedAtUtc)
            .Select(a => new CustomerJobActivityDto(
                ActivityType: a.ActivityType.ToString(),
                Message: a.Message,
                CreatedAtUtc: a.CreatedAtUtc
            )).ToList();

        return new CustomerServiceJobDetailDto(
            Id: job.Id,
            JobNumber: job.JobNumber,
            ServiceRequestId: job.ServiceRequestId,
            RequestNumber: job.ServiceRequest?.RequestNumber ?? string.Empty,
            GarageName: job.Garage?.Name ?? "Partner Garage",
            Status: job.Status.ToString(),
            VehicleMake: job.ServiceRequest?.VehicleMake ?? string.Empty,
            VehicleModel: job.ServiceRequest?.VehicleModel ?? string.Empty,
            VehicleYear: job.ServiceRequest?.VehicleYear ?? 0,
            VehicleLicensePlate: job.ServiceRequest?.VehicleLicensePlate ?? string.Empty,
            ScheduledStartAtUtc: job.ScheduledStartAtUtc,
            EstimatedCompletionAtUtc: job.EstimatedCompletionAtUtc,
            ActualVehicleReceivedAtUtc: job.ActualVehicleReceivedAtUtc,
            ActualWorkStartedAtUtc: job.ActualWorkStartedAtUtc,
            ActualWorkCompletedAtUtc: job.ActualWorkCompletedAtUtc,
            VehicleReadyAtUtc: job.VehicleReadyAtUtc,
            HandedOverAtUtc: job.HandedOverAtUtc,
            ClosedAtUtc: job.ClosedAtUtc,
            CustomerFacingNotes: job.CustomerFacingNotes,
            Inspection: inspectionDto,
            Timeline: visibleActivities
        );
    }

    private static AdvisorServiceJobDetailDto MapToAdvisorDetailDto(ServiceJob job)
    {
        var customerUser = job.ServiceRequest?.CustomerProfile?.User;
        var customerName = customerUser?.FullName ?? "Customer";

        return new AdvisorServiceJobDetailDto(
            Id: job.Id,
            JobNumber: job.JobNumber,
            ServiceRequestId: job.ServiceRequestId,
            RequestNumber: job.ServiceRequest?.RequestNumber ?? string.Empty,
            CustomerQuotationId: job.CustomerQuotationId,
            QuotationNumber: job.CustomerQuotation?.QuotationNumber ?? string.Empty,
            GarageId: job.GarageId,
            GarageName: job.Garage?.Name ?? "Workshop",
            Status: job.Status.ToString(),
            VehicleMake: job.ServiceRequest?.VehicleMake ?? string.Empty,
            VehicleModel: job.ServiceRequest?.VehicleModel ?? string.Empty,
            VehicleYear: job.ServiceRequest?.VehicleYear ?? 0,
            VehicleLicensePlate: job.ServiceRequest?.VehicleLicensePlate ?? string.Empty,
            CurrentMileageKm: job.CurrentMileageKm,
            CustomerName: customerName,
            CustomerPhone: customerUser?.PhoneNumber ?? string.Empty,
            ProblemDescription: job.ServiceRequest?.ProblemDescription ?? string.Empty,
            CustomerComplaintSnapshot: job.CustomerComplaintSnapshot,
            ScheduledStartAtUtc: job.ScheduledStartAtUtc,
            EstimatedCompletionAtUtc: job.EstimatedCompletionAtUtc,
            ActualVehicleReceivedAtUtc: job.ActualVehicleReceivedAtUtc,
            ActualWorkStartedAtUtc: job.ActualWorkStartedAtUtc,
            ActualWorkCompletedAtUtc: job.ActualWorkCompletedAtUtc,
            VehicleReadyAtUtc: job.VehicleReadyAtUtc,
            HandedOverAtUtc: job.HandedOverAtUtc,
            ClosedAtUtc: job.ClosedAtUtc,
            CancelledAtUtc: job.CancelledAtUtc,
            CancellationReason: job.CancellationReason,
            GarageInternalNotes: job.GarageInternalNotes,
            CustomerFacingNotes: job.CustomerFacingNotes,
            Inspections: job.Inspections.OrderBy(i => i.InspectionStartedAtUtc).Select(i => new ServiceInspectionDto(
                Id: i.Id,
                InspectorUserId: i.InspectorUserId,
                InspectorName: "Workshop Inspector",
                InspectionStartedAtUtc: i.InspectionStartedAtUtc,
                InspectionCompletedAtUtc: i.InspectionCompletedAtUtc,
                Findings: i.Findings,
                Recommendations: i.Recommendations,
                CustomerVisibleSummary: i.CustomerVisibleSummary,
                OverallSeverity: i.OverallSeverity.ToString(),
                CreatedAtUtc: i.CreatedAtUtc
            )).ToList(),
            Activities: job.Activities.OrderBy(a => a.CreatedAtUtc).Select(a => new ServiceJobActivityDto(
                Id: a.Id,
                ActivityType: a.ActivityType.ToString(),
                Message: a.Message,
                IsCustomerVisible: a.IsCustomerVisible,
                ActorName: "Staff",
                CreatedAtUtc: a.CreatedAtUtc
            )).ToList(),
            AdditionalWorkRequests: job.AdditionalWorkRequests.OrderBy(r => r.CreatedAtUtc).Select(MapToAdditionalWorkDto).ToList(),
            ConcurrencyToken: job.ConcurrencyToken
        );
    }

    private static AdditionalWorkRequestDto MapToAdditionalWorkDto(AdditionalWorkRequest req)
    {
        return new AdditionalWorkRequestDto(
            Id: req.Id,
            ServiceJobId: req.ServiceJobId,
            Description: req.Description,
            EstimatedAdditionalAmount: req.EstimatedAdditionalAmount,
            Reason: req.Reason,
            Status: req.Status.ToString(),
            ReviewedByAdvisorId: req.ReviewedByAdvisorId,
            AdvisorRemarks: req.AdvisorRemarks,
            ReviewedAtUtc: req.ReviewedAtUtc,
            CreatedAtUtc: req.CreatedAtUtc
        );
    }

    #endregion
}
