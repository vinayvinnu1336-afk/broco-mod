using System.Text.Json;
using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Enums;
using BroCoMod.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BroCoMod.Infrastructure.Services;

public class CustomerQuotationService : ICustomerQuotationService
{
    private readonly ApplicationDbContext _context;
    private readonly ICustomerQuotationNumberGenerator _numberGenerator;
    private readonly IAuditService _auditService;
    private readonly INotificationService _notificationService;
    private readonly ILogger<CustomerQuotationService> _logger;

    public CustomerQuotationService(
        ApplicationDbContext context,
        ICustomerQuotationNumberGenerator numberGenerator,
        IAuditService auditService,
        INotificationService notificationService,
        ILogger<CustomerQuotationService> logger)
    {
        _context = context;
        _numberGenerator = numberGenerator;
        _auditService = auditService;
        _notificationService = notificationService;
        _logger = logger;
    }

    public async Task<ApiResponse<CustomerQuotationDto>> CreateCustomerQuotationDraftAsync(
        Guid serviceRequestId,
        CreateCustomerQuotationRequest request,
        Guid advisorId,
        CancellationToken ct = default)
    {
        var serviceRequest = await _context.ServiceRequests
            .Include(sr => sr.GarageAssignments)
                .ThenInclude(ga => ga.Garage)
            .Include(sr => sr.CustomerQuotation)
                .ThenInclude(cq => cq!.LineItems)
            .Include(sr => sr.CustomerQuotation)
                .ThenInclude(cq => cq!.Versions)
            .FirstOrDefaultAsync(sr => sr.Id == serviceRequestId, ct);

        if (serviceRequest == null)
        {
            return ApiResponse<CustomerQuotationDto>.Fail("Service request not found.");
        }

        var activeAssignment = serviceRequest.GarageAssignments
            .FirstOrDefault(ga => ga.Status == GarageAssignmentStatus.Assigned);

        if (activeAssignment == null)
        {
            return ApiResponse<CustomerQuotationDto>.Fail(
                "Cannot prepare a customer quotation without an active garage assignment. Select an eligible garage first."
            );
        }

        if (request.ValidUntilUtc <= DateTime.UtcNow)
        {
            return ApiResponse<CustomerQuotationDto>.Fail("Quotation validity date must be in the future.");
        }

        if (request.LineItems == null || request.LineItems.Count == 0)
        {
            return ApiResponse<CustomerQuotationDto>.Fail("Customer quotation must contain at least one line item.");
        }

        CustomerQuotation quotation;
        if (serviceRequest.CustomerQuotation != null)
        {
            // If existing in Draft, update it instead of creating a duplicate
            if (serviceRequest.CustomerQuotation.Status == CustomerQuotationStatus.Draft)
            {
                quotation = serviceRequest.CustomerQuotation;
                _context.CustomerQuotationLineItems.RemoveRange(quotation.LineItems);
                quotation.LineItems.Clear();

                quotation.UpdateDraft(
                    request.ScopeSummary,
                    request.AdvisorRemarks,
                    request.ValidUntilUtc,
                    request.CustomerDiscount,
                    advisorId
                );
            }
            else
            {
                return ApiResponse<CustomerQuotationDto>.Fail(
                    $"A customer quotation already exists in '{serviceRequest.CustomerQuotation.Status}' state for this request."
                );
            }
        }
        else
        {
            var quoteNumber = await _numberGenerator.NextCustomerQuotationNumberAsync(ct);
            quotation = new CustomerQuotation(
                serviceRequestId,
                activeAssignment.Id,
                activeAssignment.GarageId,
                advisorId,
                quoteNumber,
                request.ScopeSummary,
                request.AdvisorRemarks,
                request.ValidUntilUtc,
                request.CustomerDiscount,
                request.Currency
            );

            _context.CustomerQuotations.Add(quotation);
        }

        // Add line items
        foreach (var itemInput in request.LineItems)
        {
            var lineItem = new CustomerQuotationLineItem(
                quotation.Id,
                itemInput.LineType,
                itemInput.Description,
                itemInput.Quantity,
                itemInput.UnitPrice,
                itemInput.TaxRate,
                itemInput.DiscountAmount,
                itemInput.SortOrder
            );

            quotation.LineItems.Add(lineItem);
            _context.Entry(lineItem).State = EntityState.Added;
        }

        quotation.RecalculateTotals();

        await _auditService.LogAsync(
            action: "CUSTOMER_QUOTATION_CREATED",
            userId: advisorId,
            userEmail: "Advisor",
            entityName: "CustomerQuotation",
            entityId: quotation.Id.ToString(),
            details: $"Created customer quotation draft {quotation.QuotationNumber} with {quotation.LineItems.Count} items totaling {quotation.CustomerTotal:C}",
            cancellationToken: ct
        );

        await _context.SaveChangesAsync(ct);

        return ApiResponse<CustomerQuotationDto>.Ok(
            MapToDto(quotation, serviceRequest.RequestNumber, activeAssignment.Garage?.Name ?? "Partner Garage"),
            "Customer quotation draft created successfully."
        );
    }

    public async Task<ApiResponse<CustomerQuotationDto>> GetCustomerQuotationByIdAsync(
        Guid quotationId,
        Guid requestingUserId,
        string requestingRole,
        CancellationToken ct = default)
    {
        var quotation = await _context.CustomerQuotations
            .Include(cq => cq.ServiceRequest)
            .Include(cq => cq.GarageAssignment)
                .ThenInclude(ga => ga!.Garage)
            .Include(cq => cq.LineItems)
            .Include(cq => cq.Versions)
            .FirstOrDefaultAsync(cq => cq.Id == quotationId, ct);

        if (quotation == null)
        {
            return ApiResponse<CustomerQuotationDto>.Fail("Customer quotation not found.");
        }

        var garageName = quotation.GarageAssignment?.Garage?.Name ?? "Partner Garage";
        var requestNumber = quotation.ServiceRequest?.RequestNumber ?? string.Empty;

        return ApiResponse<CustomerQuotationDto>.Ok(MapToDto(quotation, requestNumber, garageName));
    }

    public async Task<ApiResponse<CustomerQuotationDto>> UpdateCustomerQuotationDraftAsync(
        Guid quotationId,
        UpdateCustomerQuotationDraftRequest request,
        Guid advisorId,
        CancellationToken ct = default)
    {
        var quotation = await _context.CustomerQuotations
            .Include(cq => cq.ServiceRequest)
            .Include(cq => cq.GarageAssignment)
                .ThenInclude(ga => ga!.Garage)
            .Include(cq => cq.LineItems)
            .Include(cq => cq.Versions)
            .FirstOrDefaultAsync(cq => cq.Id == quotationId, ct);

        if (quotation == null)
        {
            return ApiResponse<CustomerQuotationDto>.Fail("Customer quotation not found.");
        }

        if (quotation.Status != CustomerQuotationStatus.Draft)
        {
            return ApiResponse<CustomerQuotationDto>.Fail($"Cannot update quotation in '{quotation.Status}' state. Allowed only when 'Draft'.");
        }

        if (request.ValidUntilUtc <= DateTime.UtcNow)
        {
            return ApiResponse<CustomerQuotationDto>.Fail("Quotation validity date must be in the future.");
        }

        if (request.LineItems == null || request.LineItems.Count == 0)
        {
            return ApiResponse<CustomerQuotationDto>.Fail("Quotation must contain at least one line item.");
        }

        // Remove old line items from context
        _context.CustomerQuotationLineItems.RemoveRange(quotation.LineItems);
        quotation.LineItems.Clear();

        // Update core draft properties
        quotation.UpdateDraft(
            request.ScopeSummary,
            request.AdvisorRemarks,
            request.ValidUntilUtc,
            request.CustomerDiscount,
            advisorId
        );

        // Add new line items
        foreach (var itemInput in request.LineItems)
        {
            var lineItem = new CustomerQuotationLineItem(
                quotation.Id,
                itemInput.LineType,
                itemInput.Description,
                itemInput.Quantity,
                itemInput.UnitPrice,
                itemInput.TaxRate,
                itemInput.DiscountAmount,
                itemInput.SortOrder
            );

            quotation.LineItems.Add(lineItem);
            _context.Entry(lineItem).State = EntityState.Added;
        }

        quotation.RecalculateTotals();

        await _auditService.LogAsync(
            action: "CUSTOMER_QUOTATION_UPDATED",
            userId: advisorId,
            userEmail: "Advisor",
            entityName: "CustomerQuotation",
            entityId: quotation.Id.ToString(),
            details: $"Updated customer quotation draft {quotation.QuotationNumber}",
            cancellationToken: ct
        );

        await _context.SaveChangesAsync(ct);

        var garageName = quotation.GarageAssignment?.Garage?.Name ?? "Partner Garage";
        var requestNumber = quotation.ServiceRequest?.RequestNumber ?? string.Empty;

        return ApiResponse<CustomerQuotationDto>.Ok(
            MapToDto(quotation, requestNumber, garageName),
            "Customer quotation updated successfully."
        );
    }

    public async Task<ApiResponse<CustomerQuotationDto>> MarkCustomerQuotationReadyAsync(
        Guid quotationId,
        Guid advisorId,
        CancellationToken ct = default)
    {
        var quotation = await _context.CustomerQuotations
            .Include(cq => cq.ServiceRequest)
            .Include(cq => cq.GarageAssignment)
                .ThenInclude(ga => ga!.Garage)
            .Include(cq => cq.LineItems)
            .Include(cq => cq.Versions)
            .FirstOrDefaultAsync(cq => cq.Id == quotationId, ct);

        if (quotation == null)
        {
            return ApiResponse<CustomerQuotationDto>.Fail("Customer quotation not found.");
        }

        try
        {
            quotation.MarkReadyToSend(advisorId);
        }
        catch (InvalidOperationException ex)
        {
            return ApiResponse<CustomerQuotationDto>.Fail(ex.Message);
        }

        // Store immutable version snapshot
        var snapshotItems = quotation.LineItems.OrderBy(li => li.SortOrder).Select(li => new {
            li.Id,
            li.LineType,
            li.Description,
            li.Quantity,
            li.UnitPrice,
            li.TaxRate,
            li.DiscountAmount,
            li.LineTotal,
            li.SortOrder
        });

        var versionSnapshot = new CustomerQuotationVersion(
            quotation.Id,
            quotation.VersionNumber,
            quotation.CustomerSubtotal,
            quotation.CustomerDiscount,
            quotation.CustomerTax,
            quotation.CustomerTotal,
            quotation.ValidUntilUtc,
            quotation.AdvisorRemarks,
            quotation.ScopeSummary,
            JsonSerializer.Serialize(snapshotItems),
            advisorId
        );

        _context.CustomerQuotationVersions.Add(versionSnapshot);
        _context.Entry(versionSnapshot).State = EntityState.Added;

        await _auditService.LogAsync(
            action: "CUSTOMER_QUOTATION_READY",
            userId: advisorId,
            userEmail: "Advisor",
            entityName: "CustomerQuotation",
            entityId: quotation.Id.ToString(),
            details: $"Marked customer quotation {quotation.QuotationNumber} (v{quotation.VersionNumber}) READY_TO_SEND",
            cancellationToken: ct
        );

        await _context.SaveChangesAsync(ct);

        var garageName = quotation.GarageAssignment?.Garage?.Name ?? "Partner Garage";
        var requestNumber = quotation.ServiceRequest?.RequestNumber ?? string.Empty;

        return ApiResponse<CustomerQuotationDto>.Ok(
            MapToDto(quotation, requestNumber, garageName),
            "Quotation marked Ready to Send."
        );
    }

    public async Task<ApiResponse<CustomerQuotationDto>> SendCustomerQuotationAsync(
        Guid quotationId,
        Guid advisorId,
        CancellationToken ct = default)
    {
        var quotation = await _context.CustomerQuotations
            .Include(cq => cq.ServiceRequest)
            .Include(cq => cq.GarageAssignment)
                .ThenInclude(ga => ga!.Garage)
            .Include(cq => cq.LineItems)
            .Include(cq => cq.Versions)
            .FirstOrDefaultAsync(cq => cq.Id == quotationId, ct);

        if (quotation == null)
        {
            return ApiResponse<CustomerQuotationDto>.Fail("Customer quotation not found.");
        }

        try
        {
            quotation.Send(advisorId);
            quotation.ServiceRequest?.MarkCustomerQuotationSent();
        }
        catch (InvalidOperationException ex)
        {
            return ApiResponse<CustomerQuotationDto>.Fail(ex.Message);
        }

        // Notify customer
        if (quotation.ServiceRequest != null)
        {
            var customerUser = await _context.CustomerProfiles
                .Where(cp => cp.Id == quotation.ServiceRequest.CustomerId)
                .Select(cp => cp.UserId)
                .FirstOrDefaultAsync(ct);

            if (customerUser != Guid.Empty)
            {
                await _notificationService.SendInAppNotificationAsync(
                    userId: customerUser,
                    title: "Official Quotation Received",
                    message: $"Your customized quote {quotation.QuotationNumber} for request {quotation.ServiceRequest.RequestNumber} is ready for your review.",
                    type: "CustomerQuotation",
                    referenceId: quotation.Id,
                    referenceType: "CustomerQuotation",
                    cancellationToken: ct
                );
            }
        }

        await _auditService.LogAsync(
            action: "CUSTOMER_QUOTATION_SENT",
            userId: advisorId,
            userEmail: "Advisor",
            entityName: "CustomerQuotation",
            entityId: quotation.Id.ToString(),
            details: $"Sent customer quotation {quotation.QuotationNumber} to customer",
            cancellationToken: ct
        );

        await _context.SaveChangesAsync(ct);

        var garageName = quotation.GarageAssignment?.Garage?.Name ?? "Partner Garage";
        var requestNumber = quotation.ServiceRequest?.RequestNumber ?? string.Empty;

        return ApiResponse<CustomerQuotationDto>.Ok(
            MapToDto(quotation, requestNumber, garageName),
            "Quotation successfully sent to customer."
        );
    }

    public async Task<ApiResponse<List<CustomerFacingQuotationDto>>> GetQuotationsForCustomerAsync(
        Guid customerId,
        CancellationToken ct = default)
    {
        // STRICT CUSTOMER VISIBILITY: Customer can view Sent, Accepted, Rejected, and Expired quotations
        var quotations = await _context.CustomerQuotations
            .Include(cq => cq.ServiceRequest)
            .Include(cq => cq.GarageAssignment)
                .ThenInclude(ga => ga!.Garage)
            .Include(cq => cq.LineItems)
            .Where(cq => cq.ServiceRequest != null &&
                         cq.ServiceRequest.CustomerId == customerId &&
                         (cq.Status == CustomerQuotationStatus.Sent ||
                          cq.Status == CustomerQuotationStatus.Accepted ||
                          cq.Status == CustomerQuotationStatus.Rejected ||
                          cq.Status == CustomerQuotationStatus.Expired))
            .OrderByDescending(cq => cq.SentAtUtc ?? cq.CreatedAtUtc)
            .ToListAsync(ct);

        var dtos = quotations.Select(MapToCustomerFacingDto).ToList();
        return ApiResponse<List<CustomerFacingQuotationDto>>.Ok(dtos);
    }

    public async Task<ApiResponse<CustomerFacingQuotationDto>> GetCustomerQuotationForCustomerAsync(
        Guid quotationId,
        Guid customerId,
        CancellationToken ct = default)
    {
        var quotation = await _context.CustomerQuotations
            .Include(cq => cq.ServiceRequest)
            .Include(cq => cq.GarageAssignment)
                .ThenInclude(ga => ga!.Garage)
            .Include(cq => cq.LineItems)
            .FirstOrDefaultAsync(cq => cq.Id == quotationId, ct);

        if (quotation == null)
        {
            return ApiResponse<CustomerFacingQuotationDto>.Fail("Quotation not found.");
        }

        // Ownership validation
        if (quotation.ServiceRequest == null || quotation.ServiceRequest.CustomerId != customerId)
        {
            return ApiResponse<CustomerFacingQuotationDto>.Fail("You do not have permission to view this quotation.");
        }

        // Visibility constraint: draft and ready to send are hidden from customer
        if (quotation.Status == CustomerQuotationStatus.Draft || quotation.Status == CustomerQuotationStatus.ReadyToSend)
        {
            return ApiResponse<CustomerFacingQuotationDto>.Fail("This quotation is not currently available for customer review.");
        }

        return ApiResponse<CustomerFacingQuotationDto>.Ok(MapToCustomerFacingDto(quotation));
    }

    public async Task<ApiResponse<List<CustomerQuotationSummaryDto>>> GetPlatformCustomerQuotationsAsync(
        int page = 1,
        int pageSize = 50,
        CancellationToken ct = default)
    {
        var quotations = await _context.CustomerQuotations
            .Include(cq => cq.ServiceRequest)
            .OrderByDescending(cq => cq.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var dtos = quotations.Select(q => new CustomerQuotationSummaryDto(
            q.Id,
            q.ServiceRequestId,
            q.ServiceRequest?.RequestNumber ?? string.Empty,
            q.QuotationNumber,
            q.CustomerTotal,
            q.Status.ToString(),
            q.VersionNumber,
            q.ValidUntilUtc,
            q.CreatedAtUtc
        )).ToList();

        return ApiResponse<List<CustomerQuotationSummaryDto>>.Ok(dtos);
    }

    private static CustomerQuotationDto MapToDto(CustomerQuotation quotation, string requestNumber, string garageName)
    {
        return new CustomerQuotationDto(
            quotation.Id,
            quotation.ServiceRequestId,
            requestNumber,
            quotation.GarageAssignmentId,
            quotation.AssignedGarageId,
            garageName,
            quotation.QuotationNumber,
            quotation.Currency,
            quotation.CustomerSubtotal,
            quotation.CustomerDiscount,
            quotation.CustomerTax,
            quotation.CustomerTotal,
            quotation.ValidUntilUtc,
            quotation.Status.ToString(),
            quotation.VersionNumber,
            quotation.ScopeSummary,
            quotation.AdvisorRemarks,
            quotation.SentAtUtc,
            quotation.AcceptedAtUtc,
            quotation.RejectedAtUtc,
            quotation.CreatedAtUtc,
            quotation.LineItems.OrderBy(li => li.SortOrder).Select(li => new CustomerQuotationLineItemDto(
                li.Id,
                li.LineType,
                li.Description,
                li.Quantity,
                li.UnitPrice,
                li.TaxRate,
                li.DiscountAmount,
                li.LineTotal,
                li.SortOrder
            )).ToList(),
            quotation.Versions.OrderByDescending(v => v.VersionNumber).Select(v => new CustomerQuotationVersionDto(
                v.Id,
                v.VersionNumber,
                v.CustomerSubtotal,
                v.CustomerDiscount,
                v.CustomerTax,
                v.CustomerTotal,
                v.ValidUntilUtc,
                v.AdvisorRemarks,
                v.ScopeSummary,
                v.CreatedAtUtc
            )).ToList()
        );
    }

    private static CustomerFacingQuotationDto MapToCustomerFacingDto(CustomerQuotation quotation)
    {
        var sr = quotation.ServiceRequest;
        return new CustomerFacingQuotationDto(
            quotation.Id,
            quotation.QuotationNumber,
            quotation.ServiceRequestId,
            sr?.RequestNumber ?? string.Empty,
            sr?.VehicleMake ?? string.Empty,
            sr?.VehicleModel ?? string.Empty,
            sr?.VehicleYear ?? 0,
            sr?.VehicleLicensePlate ?? string.Empty,
            quotation.ScopeSummary,
            quotation.AdvisorRemarks,
            quotation.Currency,
            quotation.CustomerSubtotal,
            quotation.CustomerDiscount,
            quotation.CustomerTax,
            quotation.CustomerTotal,
            quotation.ValidUntilUtc,
            quotation.Status.ToString(),
            quotation.CreatedAtUtc,
            quotation.LineItems.OrderBy(li => li.SortOrder).Select(li => new CustomerFacingLineItemDto(
                li.Id,
                li.LineType.ToString(),
                li.Description,
                li.Quantity,
                li.UnitPrice,
                li.TaxRate,
                li.DiscountAmount,
                li.LineTotal,
                li.SortOrder
            )).ToList(),
            quotation.GarageAssignment?.Garage?.Name ?? "Partner Garage",
            quotation.AcceptedAtUtc,
            quotation.RejectedAtUtc
        );
    }
}
