using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Enums;
using BroCoMod.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BroCoMod.Infrastructure.Services;

public class AdvisorQuotationService : IAdvisorQuotationService
{
    private readonly ApplicationDbContext _context;
    private readonly IAuditService _auditService;
    private readonly INotificationService _notificationService;
    private readonly ILogger<AdvisorQuotationService> _logger;

    public AdvisorQuotationService(
        ApplicationDbContext context,
        IAuditService auditService,
        INotificationService notificationService,
        ILogger<AdvisorQuotationService> logger)
    {
        _context = context;
        _auditService = auditService;
        _notificationService = notificationService;
        _logger = logger;
    }

    public async Task<ApiResponse<QuoteComparisonDto>> GetQuoteComparisonAsync(
        Guid serviceRequestId,
        Guid requestingAdvisorId,
        CancellationToken ct = default)
    {
        var request = await _context.ServiceRequests
            .Include(sr => sr.CustomerProfile)
            .Include(sr => sr.CustomerVehicle)
            .Include(sr => sr.ServiceLocation)
            .Include(sr => sr.GarageRequests)
                .ThenInclude(gr => gr.Garage)
            .Include(sr => sr.GarageQuotes)
                .ThenInclude(gq => gq.Garage)
            .Include(sr => sr.GarageQuotes)
                .ThenInclude(gq => gq.LineItems)
            .Include(sr => sr.GarageAssignments)
                .ThenInclude(ga => ga.Garage)
            .Include(sr => sr.GarageAssignments)
                .ThenInclude(ga => ga.SelectedQuote)
            .FirstOrDefaultAsync(sr => sr.Id == serviceRequestId, ct);

        if (request == null)
        {
            return ApiResponse<QuoteComparisonDto>.Fail("Service request not found.");
        }

        // Transition to AdvisorReview if applicable
        if (request.Status == ServiceRequestStatus.QuotesReceived ||
            request.Status == ServiceRequestStatus.GaragesNotified ||
            request.Status == ServiceRequestStatus.UnderReview)
        {
            try
            {
                request.TransitionToAdvisorReview();
                await _context.SaveChangesAsync(ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to transition request {RequestId} to AdvisorReview", serviceRequestId);
            }
        }

        // Filter submitted, under review, or selected quotes (exclude drafts/withdrawn unless relevant)
        var validQuotes = request.GarageQuotes
            .Where(q => q.Status != QuoteStatus.Draft)
            .OrderBy(q => q.TotalAmount)
            .ToList();

        var quotesComparison = new List<QuoteComparisonItemDto>();
        foreach (var q in validQuotes)
        {
            // Find distance from garage request
            var matchingGarageRequest = request.GarageRequests.FirstOrDefault(gr => gr.GarageId == q.GarageId);
            var distance = matchingGarageRequest?.DistanceKm ?? 0.0;

            quotesComparison.Add(new QuoteComparisonItemDto(
                q.Id,
                q.QuoteNumber,
                q.GarageId,
                q.Garage?.Name ?? "Partner Garage",
                q.Garage?.Address ?? string.Empty,
                distance,
                q.Subtotal,
                q.DiscountAmount,
                q.TaxAmount,
                q.TotalAmount,
                q.EstimatedCompletionHours ?? 0,
                q.EstimatedCompletionDays ?? 0,
                q.Status.ToString(),
                q.SubmittedAtUtc ?? q.CreatedAtUtc,
                q.ValidUntil,
                q.GarageRemarks,
                q.LineItems.Count,
                q.LineItems.OrderBy(li => li.SortOrder).Select(li => new GarageQuoteLineItemDto(
                    li.Id,
                    li.LineType.ToString(),
                    li.Description,
                    li.Quantity,
                    li.UnitPrice,
                    li.TaxRate,
                    li.DiscountAmount,
                    li.ItemSubtotal,
                    li.LineTax,
                    li.LineTotal,
                    li.SortOrder
                )).ToList()
            ));
        }

        // Active assignment if present
        var activeAssignmentEntity = request.GarageAssignments
            .FirstOrDefault(ga => ga.Status == GarageAssignmentStatus.Assigned);

        GarageAssignmentDto? activeAssignmentDto = null;
        if (activeAssignmentEntity != null)
        {
            activeAssignmentDto = new GarageAssignmentDto(
                activeAssignmentEntity.Id,
                activeAssignmentEntity.ServiceRequestId,
                request.RequestNumber,
                activeAssignmentEntity.GarageId,
                activeAssignmentEntity.Garage?.Name ?? "Partner Workshop",
                activeAssignmentEntity.SelectedQuoteId,
                activeAssignmentEntity.SelectedQuote?.QuoteNumber ?? string.Empty,
                activeAssignmentEntity.SelectedQuote?.TotalAmount ?? 0.0m,
                activeAssignmentEntity.AssignedByAdvisorId,
                "Advisor",
                activeAssignmentEntity.AssignedAtUtc,
                activeAssignmentEntity.Status.ToString(),
                activeAssignmentEntity.AssignmentReason,
                activeAssignmentEntity.CancelledAtUtc,
                activeAssignmentEntity.CancellationReason
            );
        }

        var vehicleSummary = $"{request.VehicleMake} {request.VehicleModel} ({request.VehicleYear}) - {request.VehicleLicensePlate}";
        var address = request.ServiceLocation?.FormattedAddress ?? "Location not specified";
        var lowest = validQuotes.Any() ? validQuotes.Min(q => q.TotalAmount) : (decimal?)null;
        var latest = validQuotes.Any() ? validQuotes.Max(q => q.SubmittedAtUtc) : (DateTime?)null;
        var pendingCount = request.GarageRequests.Count(gr => gr.Status != GarageRequestStatus.Accepted && gr.Status != GarageRequestStatus.Declined);

        await _auditService.LogAsync(
            action: "ADVISOR_QUOTE_VIEWED",
            userId: requestingAdvisorId,
            userEmail: null,
            entityName: "ServiceRequest",
            entityId: serviceRequestId.ToString(),
            details: $"Advisor reviewed {validQuotes.Count} quotes for request {request.RequestNumber}",
            cancellationToken: ct
        );

        var dto = new QuoteComparisonDto(
            request.Id,
            request.RequestNumber,
            vehicleSummary,
            request.ProblemDescription,
            address,
            request.Status.ToString(),
            validQuotes.Count,
            pendingCount,
            lowest,
            latest,
            activeAssignmentDto,
            quotesComparison
        );

        return ApiResponse<QuoteComparisonDto>.Ok(dto);
    }

    public async Task<ApiResponse<AdvisorRequestNoteDto>> AddInternalNoteAsync(
        Guid serviceRequestId,
        CreateAdvisorNoteRequest request,
        Guid advisorId,
        string advisorName,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Note))
        {
            return ApiResponse<AdvisorRequestNoteDto>.Fail("Note content cannot be empty.");
        }

        var exists = await _context.ServiceRequests.AnyAsync(sr => sr.Id == serviceRequestId, ct);
        if (!exists)
        {
            return ApiResponse<AdvisorRequestNoteDto>.Fail("Service request not found.");
        }

        var note = new AdvisorRequestNote(serviceRequestId, advisorId, advisorName, request.Note);
        _context.AdvisorRequestNotes.Add(note);

        await _auditService.LogAsync(
            action: "ADVISOR_NOTE_CREATED",
            userId: advisorId,
            userEmail: advisorName,
            entityName: "AdvisorRequestNote",
            entityId: note.Id.ToString(),
            details: $"Added internal note for service request {serviceRequestId}",
            cancellationToken: ct
        );

        await _context.SaveChangesAsync(ct);

        var dto = new AdvisorRequestNoteDto(
            note.Id,
            note.ServiceRequestId,
            note.AdvisorId,
            note.AdvisorName,
            note.Note,
            note.CreatedAtUtc,
            note.UpdatedAtUtc,
            true
        );

        return ApiResponse<AdvisorRequestNoteDto>.Ok(dto, "Internal note added successfully.");
    }

    public async Task<ApiResponse<List<AdvisorRequestNoteDto>>> GetInternalNotesAsync(
        Guid serviceRequestId,
        Guid requestingUserId,
        CancellationToken ct = default)
    {
        var notes = await _context.AdvisorRequestNotes
            .AsNoTracking()
            .Where(n => n.ServiceRequestId == serviceRequestId)
            .OrderByDescending(n => n.CreatedAtUtc)
            .ToListAsync(ct);

        var dtos = notes.Select(n => new AdvisorRequestNoteDto(
            n.Id,
            n.ServiceRequestId,
            n.AdvisorId,
            n.AdvisorName,
            n.Note,
            n.CreatedAtUtc,
            n.UpdatedAtUtc,
            n.AdvisorId == requestingUserId
        )).ToList();

        return ApiResponse<List<AdvisorRequestNoteDto>>.Ok(dtos);
    }

    public async Task<ApiResponse<AdvisorRequestNoteDto>> UpdateInternalNoteAsync(
        Guid noteId,
        UpdateAdvisorNoteRequest request,
        Guid requestingUserId,
        bool isAdmin,
        CancellationToken ct = default)
    {
        var note = await _context.AdvisorRequestNotes.FirstOrDefaultAsync(n => n.Id == noteId, ct);
        if (note == null)
        {
            return ApiResponse<AdvisorRequestNoteDto>.Fail("Internal note not found.");
        }

        try
        {
            note.Update(request.Note, requestingUserId, isAdmin);
        }
        catch (UnauthorizedAccessException ex)
        {
            return ApiResponse<AdvisorRequestNoteDto>.Fail(ex.Message);
        }
        catch (ArgumentException ex)
        {
            return ApiResponse<AdvisorRequestNoteDto>.Fail(ex.Message);
        }

        await _auditService.LogAsync(
            action: "ADVISOR_NOTE_UPDATED",
            userId: requestingUserId,
            userEmail: note.AdvisorName,
            entityName: "AdvisorRequestNote",
            entityId: note.Id.ToString(),
            details: $"Updated internal note {noteId}",
            cancellationToken: ct
        );

        await _context.SaveChangesAsync(ct);

        var dto = new AdvisorRequestNoteDto(
            note.Id,
            note.ServiceRequestId,
            note.AdvisorId,
            note.AdvisorName,
            note.Note,
            note.CreatedAtUtc,
            note.UpdatedAtUtc,
            note.AdvisorId == requestingUserId
        );

        return ApiResponse<AdvisorRequestNoteDto>.Ok(dto, "Internal note updated successfully.");
    }

    public async Task<ApiResponse<bool>> DeleteInternalNoteAsync(
        Guid noteId,
        Guid requestingUserId,
        bool isAdmin,
        CancellationToken ct = default)
    {
        var note = await _context.AdvisorRequestNotes.FirstOrDefaultAsync(n => n.Id == noteId, ct);
        if (note == null)
        {
            return ApiResponse<bool>.Fail("Internal note not found.");
        }

        if (!isAdmin && note.AdvisorId != requestingUserId)
        {
            return ApiResponse<bool>.Fail("Only the authoring advisor can delete this note.");
        }

        _context.AdvisorRequestNotes.Remove(note);

        await _auditService.LogAsync(
            action: "ADVISOR_NOTE_DELETED",
            userId: requestingUserId,
            userEmail: null,
            entityName: "AdvisorRequestNote",
            entityId: noteId.ToString(),
            details: $"Deleted internal note {noteId}",
            cancellationToken: ct
        );

        await _context.SaveChangesAsync(ct);
        return ApiResponse<bool>.Ok(true, "Internal note deleted.");
    }

    public async Task<ApiResponse<GarageAssignmentDto>> AssignGarageAsync(
        Guid serviceRequestId,
        AssignGarageRequest request,
        Guid advisorId,
        string advisorName,
        CancellationToken ct = default)
    {
        // 1. Load ServiceRequest
        var serviceRequest = await _context.ServiceRequests
            .Include(sr => sr.GarageRequests)
            .Include(sr => sr.GarageAssignments)
            .FirstOrDefaultAsync(sr => sr.Id == serviceRequestId, ct);

        if (serviceRequest == null)
        {
            return ApiResponse<GarageAssignmentDto>.Fail("Service request not found.");
        }

        // 2. Validate Garage existence, active status, verified status
        var garage = await _context.Garages.FirstOrDefaultAsync(g => g.Id == request.GarageId, ct);
        if (garage == null)
        {
            return ApiResponse<GarageAssignmentDto>.Fail("Target garage not found.");
        }

        if (!garage.IsActive)
        {
            return ApiResponse<GarageAssignmentDto>.Fail("Cannot assign an inactive garage.");
        }

        if (!garage.IsVerified)
        {
            return ApiResponse<GarageAssignmentDto>.Fail("Cannot assign an unverified garage.");
        }

        // 3. Validate that Garage was dispatched for this ServiceRequest
        var isDispatched = serviceRequest.GarageRequests.Any(gr => gr.GarageId == request.GarageId);
        if (!isDispatched)
        {
            return ApiResponse<GarageAssignmentDto>.Fail("This garage was not dispatched for this service request.");
        }

        // 4. Validate Quote: must belong to this ServiceRequest, this Garage, and have a valid submitted status
        var quote = await _context.GarageQuotes
            .FirstOrDefaultAsync(q => q.Id == request.QuoteId, ct);

        if (quote == null)
        {
            return ApiResponse<GarageAssignmentDto>.Fail("Selected garage quote not found.");
        }

        if (quote.ServiceRequestId != serviceRequestId || quote.GarageId == Guid.Empty || quote.GarageId != request.GarageId)
        {
            return ApiResponse<GarageAssignmentDto>.Fail("The quote does not match the service request and garage.");
        }

        if (quote.Status != QuoteStatus.Submitted && quote.Status != QuoteStatus.UnderReview && quote.Status != QuoteStatus.SelectedByAdvisor)
        {
            return ApiResponse<GarageAssignmentDto>.Fail($"Cannot assign garage with quote in '{quote.Status}' state. Allowed only from 'Submitted' or 'UnderReview'.");
        }

        if (quote.ValidUntil <= DateTime.UtcNow)
        {
            return ApiResponse<GarageAssignmentDto>.Fail("Cannot assign garage with an expired quote.");
        }

        // 5. Concurrency & Idempotency: Single active assignment check
        var activeAssignment = serviceRequest.GarageAssignments
            .FirstOrDefault(ga => ga.Status == GarageAssignmentStatus.Assigned);

        if (activeAssignment != null)
        {
            if (activeAssignment.GarageId == request.GarageId && activeAssignment.SelectedQuoteId == request.QuoteId)
            {
                // Idempotent return
                var existingDto = new GarageAssignmentDto(
                    activeAssignment.Id,
                    serviceRequestId,
                    serviceRequest.RequestNumber,
                    garage.Id,
                    garage.Name,
                    quote.Id,
                    quote.QuoteNumber,
                    quote.TotalAmount,
                    activeAssignment.AssignedByAdvisorId,
                    advisorName,
                    activeAssignment.AssignedAtUtc,
                    activeAssignment.Status.ToString(),
                    activeAssignment.AssignmentReason,
                    activeAssignment.CancelledAtUtc,
                    activeAssignment.CancellationReason
                );
                return ApiResponse<GarageAssignmentDto>.Ok(existingDto, "Garage is already assigned.");
            }

            return ApiResponse<GarageAssignmentDto>.Fail(
                "An active assignment already exists for this service request. To reassign, cancel the existing assignment first."
            );
        }

        // 6. Create Assignment atomically
        var assignment = new GarageAssignment(
            serviceRequestId,
            request.GarageId,
            request.QuoteId,
            advisorId,
            request.AssignmentReason
        );

        _context.GarageAssignments.Add(assignment);

        // Update quote status
        quote.MarkSelectedByAdvisor();

        // Update service request status
        serviceRequest.MarkGarageSelected();

        // Audit events
        await _auditService.LogAsync(
            action: "GARAGE_SELECTED",
            userId: advisorId,
            userEmail: advisorName,
            entityName: "GarageQuote",
            entityId: quote.Id.ToString(),
            details: $"Advisor selected garage '{garage.Name}' with quote {quote.QuoteNumber}",
            cancellationToken: ct
        );

        await _auditService.LogAsync(
            action: "GARAGE_ASSIGNMENT_CREATED",
            userId: advisorId,
            userEmail: advisorName,
            entityName: "GarageAssignment",
            entityId: assignment.Id.ToString(),
            details: $"Created garage assignment {assignment.Id} for workshop '{garage.Name}'",
            cancellationToken: ct
        );

        // Notification to assigned garage
        var garageUsers = await _context.GarageUsers
            .Where(gu => gu.GarageId == request.GarageId)
            .Select(gu => gu.UserId)
            .ToListAsync(ct);

        foreach (var garageUserId in garageUsers)
        {
            await _notificationService.SendInAppNotificationAsync(
                userId: garageUserId,
                title: "Workshop Selected for Service",
                message: $"Congratulations! Your workshop '{garage.Name}' has been selected by our Technical Advisor for Request {serviceRequest.RequestNumber}.",
                type: "ServiceRequest",
                referenceId: serviceRequestId,
                referenceType: "ServiceRequest",
                cancellationToken: ct
            );
        }

        await _context.SaveChangesAsync(ct);

        var resultDto = new GarageAssignmentDto(
            assignment.Id,
            serviceRequestId,
            serviceRequest.RequestNumber,
            garage.Id,
            garage.Name,
            quote.Id,
            quote.QuoteNumber,
            quote.TotalAmount,
            advisorId,
            advisorName,
            assignment.AssignedAtUtc,
            assignment.Status.ToString(),
            assignment.AssignmentReason,
            null,
            null
        );

        return ApiResponse<GarageAssignmentDto>.Ok(resultDto, $"Garage '{garage.Name}' successfully assigned.");
    }

    public async Task<ApiResponse<GarageAssignmentDto?>> GetActiveAssignmentAsync(
        Guid serviceRequestId,
        CancellationToken ct = default)
    {
        var assignment = await _context.GarageAssignments
            .Include(ga => ga.ServiceRequest)
            .Include(ga => ga.Garage)
            .Include(ga => ga.SelectedQuote)
            .FirstOrDefaultAsync(ga => ga.ServiceRequestId == serviceRequestId && ga.Status == GarageAssignmentStatus.Assigned, ct);

        if (assignment == null)
        {
            return ApiResponse<GarageAssignmentDto?>.Ok(null, "No active assignment.");
        }

        var dto = new GarageAssignmentDto(
            assignment.Id,
            assignment.ServiceRequestId,
            assignment.ServiceRequest?.RequestNumber ?? string.Empty,
            assignment.GarageId,
            assignment.Garage?.Name ?? "Partner Garage",
            assignment.SelectedQuoteId,
            assignment.SelectedQuote?.QuoteNumber ?? string.Empty,
            assignment.SelectedQuote?.TotalAmount ?? 0.0m,
            assignment.AssignedByAdvisorId,
            "Advisor",
            assignment.AssignedAtUtc,
            assignment.Status.ToString(),
            assignment.AssignmentReason,
            assignment.CancelledAtUtc,
            assignment.CancellationReason
        );

        return ApiResponse<GarageAssignmentDto?>.Ok(dto);
    }

    public async Task<ApiResponse<List<GarageAssignmentDto>>> GetAllAssignmentsAsync(
        int page = 1,
        int pageSize = 50,
        CancellationToken ct = default)
    {
        var assignments = await _context.GarageAssignments
            .Include(ga => ga.ServiceRequest)
            .Include(ga => ga.Garage)
            .Include(ga => ga.SelectedQuote)
            .OrderByDescending(ga => ga.AssignedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var dtos = assignments.Select(a => new GarageAssignmentDto(
            a.Id,
            a.ServiceRequestId,
            a.ServiceRequest?.RequestNumber ?? string.Empty,
            a.GarageId,
            a.Garage?.Name ?? "Partner Garage",
            a.SelectedQuoteId,
            a.SelectedQuote?.QuoteNumber ?? string.Empty,
            a.SelectedQuote?.TotalAmount ?? 0.0m,
            a.AssignedByAdvisorId,
            "Advisor",
            a.AssignedAtUtc,
            a.Status.ToString(),
            a.AssignmentReason,
            a.CancelledAtUtc,
            a.CancellationReason
        )).ToList();

        return ApiResponse<List<GarageAssignmentDto>>.Ok(dtos);
    }
}
