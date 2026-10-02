using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Constants;
using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Enums;
using BroCoMod.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BroCoMod.Infrastructure.Services;

public class CustomerDecisionService : ICustomerDecisionService
{
    private readonly ApplicationDbContext _context;
    private readonly IServiceJobNumberGenerator _jobNumberGenerator;
    private readonly IAuditService _auditService;
    private readonly INotificationService _notificationService;
    private readonly ILogger<CustomerDecisionService> _logger;

    public CustomerDecisionService(
        ApplicationDbContext context,
        IServiceJobNumberGenerator jobNumberGenerator,
        IAuditService auditService,
        INotificationService notificationService,
        ILogger<CustomerDecisionService> logger)
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

    public async Task<ApiResponse<BookingConfirmationDto>> AcceptQuotationAsync(
        Guid quotationId,
        Guid customerId,
        AcceptQuotationRequest request,
        string? clientIpAddress = null,
        string? userAgent = null,
        CancellationToken ct = default)
    {
        var resolvedCustomerId = await ResolveCustomerIdAsync(customerId, ct);
        var customerUserId = await ResolveCustomerUserIdAsync(customerId, ct);

        // Fetch quotation with related data
        var quotation = await _context.CustomerQuotations
            .Include(cq => cq.ServiceRequest)
                .ThenInclude(sr => sr!.CustomerProfile)
            .Include(cq => cq.GarageAssignment)
                .ThenInclude(ga => ga!.Garage)
            .Include(cq => cq.Versions)
            .Include(cq => cq.Decision)
            .FirstOrDefaultAsync(cq => cq.Id == quotationId, ct);

        if (quotation == null)
        {
            return ApiResponse<BookingConfirmationDto>.Fail("Customer quotation not found.");
        }

        // 1. Ownership validation
        if (quotation.ServiceRequest == null || quotation.ServiceRequest.CustomerId != resolvedCustomerId)
        {
            return ApiResponse<BookingConfirmationDto>.Fail("You do not have permission to accept this quotation.");
        }

        // 2. Idempotency Guard: Check if request already executed under matching idempotency key
        if (!string.IsNullOrWhiteSpace(request.IdempotencyKey) && quotation.Decision != null)
        {
            if (string.Equals(quotation.Decision.IdempotencyKey, request.IdempotencyKey.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                if (quotation.Decision.Decision == CustomerDecisionType.Accepted)
                {
                    _logger.LogInformation("Idempotent acceptance replay for quotation {QuotationNumber} with key {Key}",
                        quotation.QuotationNumber, request.IdempotencyKey);

                    var existingGarage = quotation.GarageAssignment?.Garage;
                    var existingDto = new BookingConfirmationDto(
                        QuotationId: quotation.Id,
                        QuotationNumber: quotation.QuotationNumber,
                        ServiceRequestId: quotation.ServiceRequestId,
                        RequestNumber: quotation.ServiceRequest.RequestNumber,
                        GarageId: quotation.AssignedGarageId,
                        GarageName: existingGarage?.Name ?? "Partner Garage",
                        GarageAddress: existingGarage?.Address ?? "Workshop Location",
                        GaragePhone: existingGarage?.PhoneNumber,
                        ConfirmedTotal: quotation.CustomerTotal,
                        Currency: quotation.Currency,
                        ConfirmedAtUtc: quotation.AcceptedAtUtc ?? quotation.Decision.DecidedAtUtc,
                        Status: "BookingConfirmed",
                        VehicleSummary: $"{quotation.ServiceRequest.VehicleYear} {quotation.ServiceRequest.VehicleMake} {quotation.ServiceRequest.VehicleModel} ({quotation.ServiceRequest.VehicleLicensePlate})".Trim(),
                        Message: "Booking is already confirmed."
                    );

                    return ApiResponse<BookingConfirmationDto>.Ok(existingDto, "Booking is already confirmed.");
                }

                return ApiResponse<BookingConfirmationDto>.Fail("This quotation was previously rejected with this idempotency key.");
            }
        }

        // 3. State & Validity Invariants
        if (quotation.Status == CustomerQuotationStatus.Accepted)
        {
            return ApiResponse<BookingConfirmationDto>.Fail("This quotation has already been accepted.");
        }

        if (quotation.Status == CustomerQuotationStatus.Rejected)
        {
            return ApiResponse<BookingConfirmationDto>.Fail("This quotation has already been rejected and cannot be accepted.");
        }

        if (quotation.Status != CustomerQuotationStatus.Sent)
        {
            return ApiResponse<BookingConfirmationDto>.Fail($"Cannot accept customer quotation in '{quotation.Status}' state. Allowed only when 'Sent'.");
        }

        if (quotation.ValidUntilUtc <= DateTime.UtcNow)
        {
            quotation.Expire();
            await _context.SaveChangesAsync(ct);
            return ApiResponse<BookingConfirmationDto>.Fail("Cannot accept an expired customer quotation.");
        }

        if (quotation.Decision != null)
        {
            return ApiResponse<BookingConfirmationDto>.Fail("A decision has already been recorded for this quotation.");
        }

        // 4. Partner Garage Assignment validation
        var activeAssignment = quotation.GarageAssignment;
        if (activeAssignment == null)
        {
            activeAssignment = await _context.GarageAssignments
                .Include(ga => ga.Garage)
                .FirstOrDefaultAsync(ga => ga.ServiceRequestId == quotation.ServiceRequestId && ga.Status == GarageAssignmentStatus.Assigned, ct);
        }

        if (activeAssignment == null || activeAssignment.Status != GarageAssignmentStatus.Assigned)
        {
            return ApiResponse<BookingConfirmationDto>.Fail("No active workshop assignment found for this quotation.");
        }

        if (activeAssignment.Garage == null || !activeAssignment.Garage.IsActive)
        {
            return ApiResponse<BookingConfirmationDto>.Fail("Assigned partner garage is not active or verified.");
        }

        // 5. Active Version Binding
        var activeVersion = quotation.Versions.OrderByDescending(v => v.VersionNumber).FirstOrDefault();
        if (activeVersion == null)
        {
            return ApiResponse<BookingConfirmationDto>.Fail("Quotation version snapshot is missing. Please contact advisor.");
        }

        // 6. Atomic Execution with Database Transaction wrapped in execution strategy
        CustomerQuotationDecision decision = null!;
        try
        {
            var strategy = _context.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                await using var transaction = await _context.Database.BeginTransactionAsync(ct);

                // Transition quotation -> Accepted
                quotation.Accept(activeVersion.Id);

                // Transition assignment -> Confirmed
                activeAssignment.Confirm();

                // Transition service request -> BookingConfirmed
                quotation.ServiceRequest.ConfirmBooking();

                // Record Decision entity
                decision = new CustomerQuotationDecision(
                    customerQuotationId: quotation.Id,
                    customerQuotationVersionId: activeVersion.Id,
                    versionNumber: activeVersion.VersionNumber,
                    customerId: customerUserId,
                    decision: CustomerDecisionType.Accepted,
                    decisionCategory: null,
                    decisionReason: request.CustomerRemarks,
                    idempotencyKey: request.IdempotencyKey,
                    clientIpAddress: clientIpAddress,
                    userAgent: userAgent
                );

                _context.CustomerQuotationDecisions.Add(decision);

                // Milestone 8: Automatically & idempotently create ServiceJob upon booking confirmation
                var existingJob = await _context.ServiceJobs
                    .FirstOrDefaultAsync(j => j.GarageAssignmentId == activeAssignment.Id || j.CustomerQuotationId == quotation.Id, ct);

                if (existingJob == null)
                {
                    var jobNumber = await _jobNumberGenerator.NextJobNumberAsync(ct);
                    var serviceJob = new ServiceJob(
                        serviceRequestId: quotation.ServiceRequestId,
                        garageAssignmentId: activeAssignment.Id,
                        customerQuotationId: quotation.Id,
                        garageId: quotation.AssignedGarageId,
                        jobNumber: jobNumber,
                        customerComplaintSnapshot: quotation.ServiceRequest.ProblemDescription,
                        createdByUserId: customerUserId
                    );

                    var activity = new ServiceJobActivity(
                        serviceJobId: serviceJob.Id,
                        activityType: JobActivityType.JobCreated,
                        message: $"Service job #{jobNumber} automatically created upon customer booking confirmation.",
                        isCustomerVisible: true,
                        createdByUserId: customerUserId
                    );

                    _context.ServiceJobs.Add(serviceJob);
                    _context.ServiceJobActivities.Add(activity);
                }

                await _context.SaveChangesAsync(ct);
                await transaction.CommitAsync(ct);
            });
        }
        catch (DbUpdateConcurrencyException)
        {
            _logger.LogWarning("Concurrency conflict detected while accepting customer quotation {QuotationId}", quotationId);
            return ApiResponse<BookingConfirmationDto>.Fail("Quotation state was modified concurrently. Please refresh and try again.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error accepting customer quotation {QuotationId}", quotationId);
            return ApiResponse<BookingConfirmationDto>.Fail("An unexpected error occurred while confirming booking.");
        }

        // 7. Audit Logging
        await _auditService.LogAsync(
            action: "CUSTOMER_QUOTATION_ACCEPTED",
            userId: customerUserId,
            userEmail: quotation.ServiceRequest.CustomerProfile?.User?.Email ?? "Customer",
            entityName: "CustomerQuotation",
            entityId: quotation.Id.ToString(),
            details: $"Customer accepted quotation {quotation.QuotationNumber} (v{activeVersion.VersionNumber}) with total amount ₹{quotation.CustomerTotal}",
            cancellationToken: ct
        );

        await _auditService.LogAsync(
            action: "GARAGE_ASSIGNMENT_CONFIRMED",
            userId: customerUserId,
            userEmail: quotation.ServiceRequest.CustomerProfile?.User?.Email ?? "Customer",
            entityName: "GarageAssignment",
            entityId: activeAssignment.Id.ToString(),
            details: $"Confirmed workshop assignment for garage '{activeAssignment.Garage.Name}'",
            cancellationToken: ct
        );

        await _auditService.LogAsync(
            action: "BOOKING_CONFIRMED",
            userId: customerUserId,
            userEmail: quotation.ServiceRequest.CustomerProfile?.User?.Email ?? "Customer",
            entityName: "ServiceRequest",
            entityId: quotation.ServiceRequestId.ToString(),
            details: $"Service booking #{quotation.ServiceRequest.RequestNumber} successfully confirmed with workshop '{activeAssignment.Garage.Name}'",
            cancellationToken: ct
        );

        // 8. Notifications
        // A. Notify Customer
        await _notificationService.SendInAppNotificationAsync(
            userId: customerUserId,
            title: "Booking Confirmed",
            message: $"Your service booking #{quotation.ServiceRequest.RequestNumber} is confirmed with {activeAssignment.Garage.Name}. Total: ₹{quotation.CustomerTotal:N2}.",
            type: "BookingConfirmed",
            referenceId: quotation.ServiceRequestId,
            referenceType: "ServiceRequest",
            cancellationToken: ct
        );

        // B. Notify Advisor
        if (quotation.ServiceRequest.AssignedAdvisorId.HasValue)
        {
            var advisorProfile = await _context.AdvisorProfiles
                .FirstOrDefaultAsync(ap => ap.Id == quotation.ServiceRequest.AssignedAdvisorId.Value, ct);

            if (advisorProfile != null)
            {
                await _notificationService.SendInAppNotificationAsync(
                    userId: advisorProfile.UserId,
                    title: "Customer Accepted Quotation",
                    message: $"Customer accepted quotation {quotation.QuotationNumber} for request #{quotation.ServiceRequest.RequestNumber}. Workshop: {activeAssignment.Garage.Name}.",
                    type: "CustomerQuotationAccepted",
                    referenceId: quotation.Id,
                    referenceType: "CustomerQuotation",
                    cancellationToken: ct
                );
            }
        }

        // C. Notify Assigned Garage
        var garageUsers = await _context.GarageUsers
            .Where(gu => gu.GarageId == activeAssignment.GarageId)
            .Select(gu => gu.UserId)
            .ToListAsync(ct);

        foreach (var guId in garageUsers)
        {
            await _notificationService.SendInAppNotificationAsync(
                userId: guId,
                title: "Service Booking Confirmed",
                message: $"Service booking #{quotation.ServiceRequest.RequestNumber} has been confirmed with your workshop.",
                type: "BookingConfirmed",
                referenceId: quotation.ServiceRequestId,
                referenceType: "ServiceRequest",
                cancellationToken: ct
            );
        }

        var confirmationDto = new BookingConfirmationDto(
            QuotationId: quotation.Id,
            QuotationNumber: quotation.QuotationNumber,
            ServiceRequestId: quotation.ServiceRequestId,
            RequestNumber: quotation.ServiceRequest.RequestNumber,
            GarageId: activeAssignment.GarageId,
            GarageName: activeAssignment.Garage.Name,
            GarageAddress: activeAssignment.Garage.Address,
            GaragePhone: activeAssignment.Garage.PhoneNumber,
            ConfirmedTotal: quotation.CustomerTotal,
            Currency: quotation.Currency,
            ConfirmedAtUtc: quotation.AcceptedAtUtc ?? DateTime.UtcNow,
            Status: "BookingConfirmed",
            VehicleSummary: $"{quotation.ServiceRequest.VehicleYear} {quotation.ServiceRequest.VehicleMake} {quotation.ServiceRequest.VehicleModel} ({quotation.ServiceRequest.VehicleLicensePlate})".Trim(),
            Message: "Service booking has been successfully confirmed."
        );

        return ApiResponse<BookingConfirmationDto>.Ok(confirmationDto, "Quotation accepted and service booking confirmed.");
    }

    public async Task<ApiResponse<CustomerQuotationDecisionDto>> RejectQuotationAsync(
        Guid quotationId,
        Guid customerId,
        RejectQuotationRequest request,
        string? clientIpAddress = null,
        string? userAgent = null,
        CancellationToken ct = default)
    {
        var resolvedCustomerId = await ResolveCustomerIdAsync(customerId, ct);
        var customerUserId = await ResolveCustomerUserIdAsync(customerId, ct);

        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            return ApiResponse<CustomerQuotationDecisionDto>.Fail("Decision reason is mandatory when declining a quotation.");
        }

        var quotation = await _context.CustomerQuotations
            .Include(cq => cq.ServiceRequest)
                .ThenInclude(sr => sr!.CustomerProfile)
            .Include(cq => cq.Versions)
            .Include(cq => cq.Decision)
            .FirstOrDefaultAsync(cq => cq.Id == quotationId, ct);

        if (quotation == null)
        {
            return ApiResponse<CustomerQuotationDecisionDto>.Fail("Customer quotation not found.");
        }

        // 1. Ownership validation
        if (quotation.ServiceRequest == null || quotation.ServiceRequest.CustomerId != resolvedCustomerId)
        {
            return ApiResponse<CustomerQuotationDecisionDto>.Fail("You do not have permission to reject this quotation.");
        }

        // 2. Idempotency Guard
        if (!string.IsNullOrWhiteSpace(request.IdempotencyKey) && quotation.Decision != null)
        {
            if (string.Equals(quotation.Decision.IdempotencyKey, request.IdempotencyKey.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                if (quotation.Decision.Decision == CustomerDecisionType.Rejected)
                {
                    _logger.LogInformation("Idempotent rejection replay for quotation {QuotationNumber} with key {Key}",
                        quotation.QuotationNumber, request.IdempotencyKey);

                    var existingDto = new CustomerQuotationDecisionDto(
                        Id: quotation.Decision.Id,
                        CustomerQuotationId: quotation.Id,
                        QuotationNumber: quotation.QuotationNumber,
                        CustomerQuotationVersionId: quotation.Decision.CustomerQuotationVersionId,
                        VersionNumber: quotation.Decision.VersionNumber,
                        CustomerId: quotation.Decision.CustomerId,
                        Decision: quotation.Decision.Decision.ToString(),
                        Category: quotation.Decision.DecisionCategory,
                        Reason: quotation.Decision.DecisionReason,
                        DecidedAtUtc: quotation.Decision.DecidedAtUtc,
                        IdempotencyKey: quotation.Decision.IdempotencyKey
                    );

                    return ApiResponse<CustomerQuotationDecisionDto>.Ok(existingDto, "Quotation was already declined.");
                }

                return ApiResponse<CustomerQuotationDecisionDto>.Fail("This quotation was previously accepted.");
            }
        }

        // 3. State & Validity Invariants
        if (quotation.Status == CustomerQuotationStatus.Accepted)
        {
            return ApiResponse<CustomerQuotationDecisionDto>.Fail("Cannot reject an already accepted customer quotation.");
        }

        if (quotation.Status == CustomerQuotationStatus.Rejected)
        {
            return ApiResponse<CustomerQuotationDecisionDto>.Fail("This quotation has already been rejected.");
        }

        if (quotation.Status != CustomerQuotationStatus.Sent)
        {
            return ApiResponse<CustomerQuotationDecisionDto>.Fail($"Cannot reject customer quotation in '{quotation.Status}' state. Allowed only when 'Sent'.");
        }

        if (quotation.Decision != null)
        {
            return ApiResponse<CustomerQuotationDecisionDto>.Fail("A decision has already been recorded for this quotation.");
        }

        // 4. Active Version Binding
        var activeVersion = quotation.Versions.OrderByDescending(v => v.VersionNumber).FirstOrDefault();
        if (activeVersion == null)
        {
            return ApiResponse<CustomerQuotationDecisionDto>.Fail("Quotation version snapshot is missing. Please contact advisor.");
        }

        // 5. Atomic Execution wrapped in execution strategy
        CustomerQuotationDecision decision = null!;
        try
        {
            var strategy = _context.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                await using var transaction = await _context.Database.BeginTransactionAsync(ct);

                quotation.Reject();
                quotation.ServiceRequest.RejectByCustomer(request.Reason);

                decision = new CustomerQuotationDecision(
                    customerQuotationId: quotation.Id,
                    customerQuotationVersionId: activeVersion.Id,
                    versionNumber: activeVersion.VersionNumber,
                    customerId: customerUserId,
                    decision: CustomerDecisionType.Rejected,
                    decisionCategory: request.Category,
                    decisionReason: request.Reason,
                    idempotencyKey: request.IdempotencyKey,
                    clientIpAddress: clientIpAddress,
                    userAgent: userAgent
                );

                _context.CustomerQuotationDecisions.Add(decision);

                await _context.SaveChangesAsync(ct);
                await transaction.CommitAsync(ct);
            });
        }
        catch (DbUpdateConcurrencyException)
        {
            _logger.LogWarning("Concurrency conflict detected while rejecting customer quotation {QuotationId}", quotationId);
            return ApiResponse<CustomerQuotationDecisionDto>.Fail("Quotation state was modified concurrently. Please refresh and try again.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error rejecting customer quotation {QuotationId}", quotationId);
            return ApiResponse<CustomerQuotationDecisionDto>.Fail("An unexpected error occurred while processing quotation decline.");
        }

        // 6. Audit Logging
        await _auditService.LogAsync(
            action: "CUSTOMER_QUOTATION_REJECTED",
            userId: customerUserId,
            userEmail: quotation.ServiceRequest.CustomerProfile?.User?.Email ?? "Customer",
            entityName: "CustomerQuotation",
            entityId: quotation.Id.ToString(),
            details: $"Customer rejected quotation {quotation.QuotationNumber} (Category: {request.Category ?? "None"}, Reason: {request.Reason})",
            cancellationToken: ct
        );

        // 7. Notify Advisor (Garage is NOT informed of customer's private rejection reason)
        if (quotation.ServiceRequest.AssignedAdvisorId.HasValue)
        {
            var advisorProfile = await _context.AdvisorProfiles
                .FirstOrDefaultAsync(ap => ap.Id == quotation.ServiceRequest.AssignedAdvisorId.Value, ct);

            if (advisorProfile != null)
            {
                await _notificationService.SendInAppNotificationAsync(
                    userId: advisorProfile.UserId,
                    title: "Customer Declined Quotation",
                    message: $"Customer declined quotation {quotation.QuotationNumber} for request #{quotation.ServiceRequest.RequestNumber}. Reason: {request.Reason}",
                    type: "CustomerQuotationRejected",
                    referenceId: quotation.Id,
                    referenceType: "CustomerQuotation",
                    cancellationToken: ct
                );
            }
        }

        var dto = new CustomerQuotationDecisionDto(
            Id: decision.Id,
            CustomerQuotationId: quotation.Id,
            QuotationNumber: quotation.QuotationNumber,
            CustomerQuotationVersionId: decision.CustomerQuotationVersionId,
            VersionNumber: decision.VersionNumber,
            CustomerId: decision.CustomerId,
            Decision: decision.Decision.ToString(),
            Category: decision.DecisionCategory,
            Reason: decision.DecisionReason,
            DecidedAtUtc: decision.DecidedAtUtc,
            IdempotencyKey: decision.IdempotencyKey
        );

        return ApiResponse<CustomerQuotationDecisionDto>.Ok(dto, "Quotation has been declined.");
    }

    public async Task<ApiResponse<CustomerQuotationDecisionDto>> GetDecisionAsync(
        Guid quotationId,
        Guid requestingUserId,
        string requestingRole,
        CancellationToken ct = default)
    {
        var quotation = await _context.CustomerQuotations
            .Include(cq => cq.ServiceRequest)
            .Include(cq => cq.Decision)
            .FirstOrDefaultAsync(cq => cq.Id == quotationId, ct);

        if (quotation == null)
        {
            return ApiResponse<CustomerQuotationDecisionDto>.Fail("Customer quotation not found.");
        }

        if (requestingRole == AppRoles.Customer)
        {
            var resolvedCustomerId = await ResolveCustomerIdAsync(requestingUserId, ct);
            if (quotation.ServiceRequest == null || quotation.ServiceRequest.CustomerId != resolvedCustomerId)
            {
                return ApiResponse<CustomerQuotationDecisionDto>.Fail("You do not have permission to view this decision.");
            }
        }

        if (quotation.Decision == null)
        {
            return ApiResponse<CustomerQuotationDecisionDto>.Fail("No decision has been recorded for this quotation.");
        }

        var d = quotation.Decision;
        var dto = new CustomerQuotationDecisionDto(
            Id: d.Id,
            CustomerQuotationId: quotation.Id,
            QuotationNumber: quotation.QuotationNumber,
            CustomerQuotationVersionId: d.CustomerQuotationVersionId,
            VersionNumber: d.VersionNumber,
            CustomerId: d.CustomerId,
            Decision: d.Decision.ToString(),
            Category: d.DecisionCategory,
            Reason: d.DecisionReason,
            DecidedAtUtc: d.DecidedAtUtc,
            IdempotencyKey: d.IdempotencyKey
        );

        return ApiResponse<CustomerQuotationDecisionDto>.Ok(dto);
    }
}
