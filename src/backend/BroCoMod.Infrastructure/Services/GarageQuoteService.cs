using System.Text.Json;
using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BroCoMod.Infrastructure.Services;

public class GarageQuoteService : IGarageQuoteService
{
    private readonly IApplicationDbContext _context;
    private readonly IQuoteNumberGenerator _quoteNumberGenerator;
    private readonly INotificationService _notificationService;
    private readonly IAuditService _auditService;
    private readonly ILogger<GarageQuoteService> _logger;

    public GarageQuoteService(
        IApplicationDbContext context,
        IQuoteNumberGenerator quoteNumberGenerator,
        INotificationService notificationService,
        IAuditService auditService,
        ILogger<GarageQuoteService> logger)
    {
        _context = context;
        _quoteNumberGenerator = quoteNumberGenerator;
        _notificationService = notificationService;
        _auditService = auditService;
        _logger = logger;
    }

    public async Task<GarageQuoteDetailDto> CreateDraftQuoteAsync(
        Guid garageId,
        Guid userId,
        CreateGarageQuoteRequest request,
        CancellationToken cancellationToken = default)
    {
        // 1. Validate GarageRequest belongs to this garage
        var garageRequest = await _context.GarageRequests
            .Include(gr => gr.ServiceRequest)
            .FirstOrDefaultAsync(gr => gr.Id == request.GarageRequestId && gr.GarageId == garageId, cancellationToken);

        if (garageRequest == null)
        {
            throw new KeyNotFoundException($"Garage request {request.GarageRequestId} not found or not dispatched to this garage.");
        }

        // 2. Generate unique human-readable quote reference BQ-XXXXXX
        var quoteNumber = await _quoteNumberGenerator.GenerateNextQuoteNumberAsync(cancellationToken);

        // 3. Create Draft Quote Entity
        var quote = new GarageQuote(
            garageRequestId: request.GarageRequestId,
            garageId: garageId,
            serviceRequestId: garageRequest.ServiceRequestId,
            quoteNumber: quoteNumber,
            currency: request.Currency ?? "INR",
            validUntil: request.ValidUntil,
            estimatedCompletionHours: request.EstimatedCompletionHours,
            estimatedCompletionDays: request.EstimatedCompletionDays,
            garageRemarks: request.GarageRemarks,
            createdByUserId: userId);

        // 4. Add initial line items if provided
        if (request.LineItems != null && request.LineItems.Count > 0)
        {
            int order = 0;
            foreach (var item in request.LineItems)
            {
                quote.AddLineItem(
                    lineType: item.LineType,
                    description: item.Description,
                    quantity: item.Quantity,
                    unitPrice: item.UnitPrice,
                    taxRate: item.TaxRate,
                    discountAmount: item.DiscountAmount,
                    sortOrder: item.SortOrder != 0 ? item.SortOrder : ++order);
            }
        }

        _context.GarageQuotes.Add(quote);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: "GARAGE_QUOTE_DRAFT_CREATED",
            userId: userId,
            entityName: "GarageQuote",
            entityId: quote.Id.ToString(),
            details: $"Draft quote {quote.QuoteNumber} created for request {garageRequest.ServiceRequest.RequestNumber}",
            cancellationToken: cancellationToken);

        return await GetGarageQuoteDetailAsync(garageId, quote.Id, cancellationToken)
            ?? throw new InvalidOperationException("Failed to retrieve created quote.");
    }

    public async Task<GarageQuoteDetailDto> UpdateDraftQuoteAsync(
        Guid garageId,
        Guid quoteId,
        Guid userId,
        UpdateGarageQuoteDraftRequest request,
        CancellationToken cancellationToken = default)
    {
        var quote = await _context.GarageQuotes
            .Include(q => q.LineItems)
            .Include(q => q.GarageRequest)
                .ThenInclude(gr => gr.ServiceRequest)
            .FirstOrDefaultAsync(q => q.Id == quoteId && q.GarageId == garageId, cancellationToken);

        if (quote == null)
        {
            throw new KeyNotFoundException($"Quote {quoteId} not found or does not belong to your garage.");
        }

        if (quote.Status != QuoteStatus.Draft)
        {
            throw new InvalidOperationException($"Cannot update quote in status '{quote.Status}'. Only draft quotes can be updated.");
        }

        // Update header fields
        quote.UpdateDraft(
            estimatedCompletionHours: request.EstimatedCompletionHours,
            estimatedCompletionDays: request.EstimatedCompletionDays,
            validUntil: request.ValidUntil ?? DateTime.UtcNow.AddDays(7),
            garageRemarks: request.GarageRemarks,
            updatedByUserId: userId);

        // Replace line items
        _context.GarageQuoteLineItems.RemoveRange(quote.LineItems);
        quote.ClearLineItems();
        int order = 0;
        if (request.LineItems != null)
        {
            foreach (var item in request.LineItems)
            {
                quote.AddLineItem(
                    lineType: item.LineType,
                    description: item.Description,
                    quantity: item.Quantity,
                    unitPrice: item.UnitPrice,
                    taxRate: item.TaxRate,
                    discountAmount: item.DiscountAmount,
                    sortOrder: item.SortOrder != 0 ? item.SortOrder : ++order);
            }
        }

        if (_context is DbContext dbContext)
        {
            foreach (var item in quote.LineItems)
            {
                dbContext.Entry(item).State = EntityState.Added;
            }
        }

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: "GARAGE_QUOTE_DRAFT_UPDATED",
            userId: userId,
            entityName: "GarageQuote",
            entityId: quote.Id.ToString(),
            details: $"Draft quote {quote.QuoteNumber} updated. New Total: {quote.Currency} {quote.TotalAmount:N2}",
            cancellationToken: cancellationToken);

        return await GetGarageQuoteDetailAsync(garageId, quote.Id, cancellationToken)
            ?? throw new InvalidOperationException("Failed to retrieve updated quote.");
    }

    public async Task<GarageQuoteDetailDto> SubmitQuoteAsync(
        Guid garageId,
        Guid quoteId,
        Guid userId,
        SubmitGarageQuoteCommand command,
        CancellationToken cancellationToken = default)
    {
        var quote = await _context.GarageQuotes
            .Include(q => q.LineItems)
            .Include(q => q.Versions)
            .Include(q => q.GarageRequest)
            .Include(q => q.ServiceRequest)
            .FirstOrDefaultAsync(q => q.Id == quoteId && q.GarageId == garageId, cancellationToken);

        if (quote == null)
        {
            throw new KeyNotFoundException($"Quote {quoteId} not found or does not belong to your garage.");
        }

        // Idempotency check: if already submitted with matching idempotency key, return submitted quote
        if (quote.Status == QuoteStatus.Submitted &&
            !string.IsNullOrWhiteSpace(command.IdempotencyKey) &&
            quote.IdempotencyKey == command.IdempotencyKey)
        {
            _logger.LogInformation("Idempotent quote submission received for quote {QuoteNumber} with key {IdempotencyKey}",
                quote.QuoteNumber, command.IdempotencyKey);
            return await GetGarageQuoteDetailAsync(garageId, quote.Id, cancellationToken)
                ?? throw new InvalidOperationException("Failed to retrieve submitted quote.");
        }

        if (quote.Status != QuoteStatus.Draft)
        {
            throw new InvalidOperationException($"Cannot submit quote in status '{quote.Status}'. Only draft quotes can be submitted.");
        }

        if (quote.LineItems.Count == 0)
        {
            throw new InvalidOperationException("Quote must contain at least one line item before submission.");
        }

        if (quote.ValidUntil <= DateTime.UtcNow)
        {
            throw new InvalidOperationException("Quote validity date must be in the future.");
        }

        if (quote.TotalAmount <= 0)
        {
            throw new InvalidOperationException("Quote total amount must be greater than zero.");
        }

        // Domain submission logic (creates immutable GarageQuoteVersion and marks Submitted)
        quote.Submit(userId, command.IdempotencyKey);

        var newVersion = quote.Versions.FirstOrDefault(v => v.VersionNumber == quote.VersionNumber);
        if (_context is DbContext dbCtx && newVersion != null)
        {
            dbCtx.Entry(newVersion).State = EntityState.Added;
        }

        // Update GarageRequest status to Accepted (garage accepted opportunity to quote)
        if (quote.GarageRequest != null && quote.GarageRequest.Status != GarageRequestStatus.Accepted)
        {
            quote.GarageRequest.Accept();
        }

        // Transition ServiceRequest to QuotesReceived if it was GaragesNotified
        if (quote.ServiceRequest != null &&
            (quote.ServiceRequest.Status == ServiceRequestStatus.GaragesNotified ||
             quote.ServiceRequest.Status == ServiceRequestStatus.AssignedToAdvisor))
        {
            quote.ServiceRequest.MarkQuotesReceived();
        }

        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException ex)
        {
            var details = string.Join("; ", ex.Entries.Select(e => $"{e.Entity.GetType().Name} (State={e.State}, Key={string.Join(",", e.Properties.Where(p => p.Metadata.IsKey()).Select(p => p.CurrentValue))})"));
            _logger.LogError("Concurrency failure details: {Details}", details);
            throw new InvalidOperationException($"Concurrency failure on: {details}", ex);
        }

        // Notify advisors of the new submitted quote
        try
        {
            await _notificationService.NotifyAdvisorsOfGarageQuoteAsync(quote, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send advisor notification for submitted quote {QuoteNumber}", quote.QuoteNumber);
        }

        // Audit log
        await _auditService.LogAsync(
            action: "GARAGE_QUOTE_SUBMITTED",
            userId: userId,
            entityName: "GarageQuote",
            entityId: quote.Id.ToString(),
            details: $"Quote {quote.QuoteNumber} v{quote.VersionNumber} submitted. Total: {quote.Currency} {quote.TotalAmount:N2}",
            cancellationToken: cancellationToken);

        return await GetGarageQuoteDetailAsync(garageId, quote.Id, cancellationToken)
            ?? throw new InvalidOperationException("Failed to retrieve submitted quote.");
    }

    public async Task<GarageQuoteDetailDto> CreateRevisionAsync(
        Guid garageId,
        Guid quoteId,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var quote = await _context.GarageQuotes
            .Include(q => q.LineItems)
            .Include(q => q.Versions)
            .FirstOrDefaultAsync(q => q.Id == quoteId && q.GarageId == garageId, cancellationToken);

        if (quote == null)
        {
            throw new KeyNotFoundException($"Quote {quoteId} not found or does not belong to your garage.");
        }

        if (quote.Status != QuoteStatus.Submitted && quote.Status != QuoteStatus.UnderReview)
        {
            throw new InvalidOperationException($"Cannot create revision for quote in status '{quote.Status}'. Only submitted or under-review quotes can be revised.");
        }

        quote.CreateRevision(userId);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: "GARAGE_QUOTE_REVISION_CREATED",
            userId: userId,
            entityName: "GarageQuote",
            entityId: quote.Id.ToString(),
            details: $"Revision created for quote {quote.QuoteNumber}. Current version: v{quote.VersionNumber} (Draft)",
            cancellationToken: cancellationToken);

        return await GetGarageQuoteDetailAsync(garageId, quote.Id, cancellationToken)
            ?? throw new InvalidOperationException("Failed to retrieve revised quote.");
    }

    public async Task<GarageQuoteDetailDto> WithdrawQuoteAsync(
        Guid garageId,
        Guid quoteId,
        Guid userId,
        WithdrawGarageQuoteCommand command,
        CancellationToken cancellationToken = default)
    {
        var quote = await _context.GarageQuotes
            .Include(q => q.LineItems)
            .Include(q => q.Versions)
            .FirstOrDefaultAsync(q => q.Id == quoteId && q.GarageId == garageId, cancellationToken);

        if (quote == null)
        {
            throw new KeyNotFoundException($"Quote {quoteId} not found or does not belong to your garage.");
        }

        if (quote.Status == QuoteStatus.Withdrawn)
        {
            return await GetGarageQuoteDetailAsync(garageId, quote.Id, cancellationToken)
                ?? throw new InvalidOperationException("Failed to retrieve quote.");
        }

        quote.Withdraw(userId, command.Reason);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: "GARAGE_QUOTE_WITHDRAWN",
            userId: userId,
            entityName: "GarageQuote",
            entityId: quote.Id.ToString(),
            details: $"Quote {quote.QuoteNumber} withdrawn. Reason: {command.Reason}",
            cancellationToken: cancellationToken);

        return await GetGarageQuoteDetailAsync(garageId, quote.Id, cancellationToken)
            ?? throw new InvalidOperationException("Failed to retrieve withdrawn quote.");
    }

    public async Task<IReadOnlyList<GarageQuoteSummaryDto>> GetQuotesForGarageAsync(
        Guid garageId,
        string? status = null,
        CancellationToken cancellationToken = default)
    {
        var query = _context.GarageQuotes
            .AsNoTracking()
            .Where(q => q.GarageId == garageId);

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<QuoteStatus>(status, true, out var parsedStatus))
        {
            query = query.Where(q => q.Status == parsedStatus);
        }

        return await query
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

    public async Task<GarageQuoteDetailDto?> GetGarageQuoteDetailAsync(
        Guid garageId,
        Guid quoteId,
        CancellationToken cancellationToken = default)
    {
        var quote = await _context.GarageQuotes
            .AsNoTracking()
            .Include(q => q.LineItems.OrderBy(li => li.SortOrder))
            .Include(q => q.Versions.OrderByDescending(v => v.VersionNumber))
            .Include(q => q.ServiceRequest)
            .FirstOrDefaultAsync(q => q.Id == quoteId && q.GarageId == garageId, cancellationToken);

        if (quote == null) return null;

        return MapToDetailDto(quote);
    }

    public async Task<IReadOnlyList<GarageQuoteSummaryDto>> GetQuotesForGarageRequestAsync(
        Guid garageId,
        Guid garageRequestId,
        CancellationToken cancellationToken = default)
    {
        return await _context.GarageQuotes
            .AsNoTracking()
            .Where(q => q.GarageId == garageId && q.GarageRequestId == garageRequestId)
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

    public async Task<IReadOnlyList<AdvisorGarageQuoteSummaryDto>> GetQuotesForAdvisorAsync(
        string? status = null,
        Guid? serviceRequestId = null,
        CancellationToken cancellationToken = default)
    {
        // Advisors can view submitted, under review, selected, etc. (never draft quotes)
        var query = _context.GarageQuotes
            .AsNoTracking()
            .Include(q => q.Garage)
            .Include(q => q.GarageRequest)
            .Include(q => q.ServiceRequest)
            .Where(q => q.Status != QuoteStatus.Draft);

        if (serviceRequestId.HasValue)
        {
            query = query.Where(q => q.ServiceRequestId == serviceRequestId.Value);
        }

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<QuoteStatus>(status, true, out var parsedStatus))
        {
            query = query.Where(q => q.Status == parsedStatus);
        }

        return await query
            .OrderByDescending(q => q.SubmittedAtUtc ?? q.CreatedAtUtc)
            .Select(q => new AdvisorGarageQuoteSummaryDto(
                q.Id,
                q.QuoteNumber,
                q.ServiceRequest != null ? q.ServiceRequest.RequestNumber : "",
                q.GarageId,
                q.Garage != null ? q.Garage.Name : "Garage",
                q.GarageRequest != null ? q.GarageRequest.DistanceKm : 0.0,
                q.ServiceRequest != null ? (q.ServiceRequest.VehicleMake + " " + q.ServiceRequest.VehicleModel) : "",
                q.ServiceRequest != null ? q.ServiceRequest.ProblemDescription : "",
                q.TotalAmount,
                q.Currency,
                q.EstimatedCompletionDays,
                q.ValidUntil,
                q.Status.ToString(),
                q.SubmittedAtUtc))
            .ToListAsync(cancellationToken);
    }

    public async Task<AdvisorGarageQuoteDetailDto?> GetAdvisorQuoteDetailAsync(
        Guid quoteId,
        CancellationToken cancellationToken = default)
    {
        var quote = await _context.GarageQuotes
            .AsNoTracking()
            .Include(q => q.Garage)
            .Include(q => q.GarageRequest)
            .Include(q => q.ServiceRequest)
            .Include(q => q.LineItems.OrderBy(li => li.SortOrder))
            .Include(q => q.Versions.OrderByDescending(v => v.VersionNumber))
            .FirstOrDefaultAsync(q => q.Id == quoteId && q.Status != QuoteStatus.Draft, cancellationToken);

        if (quote == null) return null;

        var lineItemDtos = quote.LineItems.Select(MapToLineItemDto).ToList();
        var versionDtos = quote.Versions.Select(MapToVersionDto).ToList();

        return new AdvisorGarageQuoteDetailDto(
            quote.Id,
            quote.QuoteNumber,
            quote.ServiceRequest?.RequestNumber ?? "",
            quote.GarageId,
            quote.Garage?.Name ?? "Garage",
            quote.Garage?.PhoneNumber ?? "",
            quote.Garage?.Address ?? "",
            quote.GarageRequest?.DistanceKm ?? 0.0,
            quote.ServiceRequest != null ? $"{quote.ServiceRequest.VehicleMake} {quote.ServiceRequest.VehicleModel}" : "",
            quote.ServiceRequest?.ProblemDescription ?? "",
            quote.Subtotal,
            quote.TaxAmount,
            quote.DiscountAmount,
            quote.TotalAmount,
            quote.Currency,
            quote.EstimatedCompletionHours,
            quote.EstimatedCompletionDays,
            quote.ValidUntil,
            quote.GarageRemarks,
            quote.Status.ToString(),
            quote.SubmittedAtUtc,
            lineItemDtos,
            versionDtos);
    }

    public async Task<IReadOnlyList<AdminGarageQuoteSummaryDto>> GetAllQuotesForAdminAsync(
        string? status = null,
        Guid? garageId = null,
        Guid? serviceRequestId = null,
        CancellationToken cancellationToken = default)
    {
        var query = _context.GarageQuotes
            .AsNoTracking()
            .Include(q => q.Garage)
            .Include(q => q.ServiceRequest)
            .AsQueryable();

        if (garageId.HasValue) query = query.Where(q => q.GarageId == garageId.Value);
        if (serviceRequestId.HasValue) query = query.Where(q => q.ServiceRequestId == serviceRequestId.Value);
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<QuoteStatus>(status, true, out var parsedStatus))
        {
            query = query.Where(q => q.Status == parsedStatus);
        }

        return await query
            .OrderByDescending(q => q.CreatedAtUtc)
            .Select(q => new AdminGarageQuoteSummaryDto(
                q.Id,
                q.QuoteNumber,
                q.ServiceRequest != null ? q.ServiceRequest.RequestNumber : "",
                q.GarageId,
                q.Garage != null ? q.Garage.Name : "Garage",
                q.ServiceRequest != null ? (q.ServiceRequest.VehicleMake + " " + q.ServiceRequest.VehicleModel) : "",
                q.TotalAmount,
                q.Currency,
                q.Status.ToString(),
                q.SubmittedAtUtc,
                q.CreatedAtUtc))
            .ToListAsync(cancellationToken);
    }

    public async Task<AdminGarageQuoteDetailDto?> GetAdminQuoteDetailAsync(
        Guid quoteId,
        CancellationToken cancellationToken = default)
    {
        var quote = await _context.GarageQuotes
            .AsNoTracking()
            .Include(q => q.Garage)
            .Include(q => q.ServiceRequest)
            .Include(q => q.LineItems.OrderBy(li => li.SortOrder))
            .Include(q => q.Versions.OrderByDescending(v => v.VersionNumber))
            .FirstOrDefaultAsync(q => q.Id == quoteId, cancellationToken);

        if (quote == null) return null;

        var lineItemDtos = quote.LineItems.Select(MapToLineItemDto).ToList();
        var versionDtos = quote.Versions.Select(MapToVersionDto).ToList();

        return new AdminGarageQuoteDetailDto(
            quote.Id,
            quote.QuoteNumber,
            quote.ServiceRequest?.RequestNumber ?? "",
            quote.GarageId,
            quote.Garage?.Name ?? "Garage",
            quote.Garage?.PhoneNumber ?? "",
            quote.Garage?.Address ?? "",
            quote.ServiceRequest != null ? $"{quote.ServiceRequest.VehicleMake} {quote.ServiceRequest.VehicleModel}" : "",
            quote.Subtotal,
            quote.TaxAmount,
            quote.DiscountAmount,
            quote.TotalAmount,
            quote.Currency,
            quote.EstimatedCompletionHours,
            quote.EstimatedCompletionDays,
            quote.ValidUntil,
            quote.GarageRemarks,
            quote.Status.ToString(),
            quote.SubmittedAtUtc,
            quote.WithdrawnAtUtc,
            quote.WithdrawalReason,
            lineItemDtos,
            versionDtos);
    }

    public async Task<int> ExpireStaleQuotesAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var staleQuotes = await _context.GarageQuotes
            .Where(q => (q.Status == QuoteStatus.Draft || q.Status == QuoteStatus.Submitted || q.Status == QuoteStatus.UnderReview) &&
                        q.ValidUntil < now)
            .ToListAsync(cancellationToken);

        if (staleQuotes.Count == 0) return 0;

        foreach (var quote in staleQuotes)
        {
            quote.MarkExpired();
        }

        await _context.SaveChangesAsync(cancellationToken);
        _logger.LogInformation("Expired {Count} stale garage quotes past ValidUntil timestamp", staleQuotes.Count);
        return staleQuotes.Count;
    }

    private static GarageQuoteDetailDto MapToDetailDto(GarageQuote quote)
    {
        var lineItemDtos = quote.LineItems.Select(MapToLineItemDto).ToList();
        var versionDtos = quote.Versions.Select(MapToVersionDto).ToList();

        return new GarageQuoteDetailDto(
            quote.Id,
            quote.GarageRequestId,
            quote.ServiceRequestId,
            quote.ServiceRequest?.RequestNumber ?? "",
            quote.ServiceRequest != null ? $"{quote.ServiceRequest.VehicleMake} {quote.ServiceRequest.VehicleModel}" : "",
            quote.QuoteNumber,
            quote.VersionNumber,
            quote.Status.ToString(),
            quote.Currency,
            quote.Subtotal,
            quote.TaxAmount,
            quote.DiscountAmount,
            quote.TotalAmount,
            quote.EstimatedCompletionHours,
            quote.EstimatedCompletionDays,
            quote.ValidUntil,
            quote.GarageRemarks,
            quote.CreatedAtUtc,
            quote.SubmittedAtUtc,
            quote.WithdrawnAtUtc,
            quote.WithdrawalReason,
            lineItemDtos,
            versionDtos);
    }

    private static GarageQuoteLineItemDto MapToLineItemDto(GarageQuoteLineItem item)
    {
        return new GarageQuoteLineItemDto(
            item.Id,
            item.LineType.ToString(),
            item.Description,
            item.Quantity,
            item.UnitPrice,
            item.TaxRate,
            item.DiscountAmount,
            item.ItemSubtotal,
            item.LineTax,
            item.LineTotal,
            item.SortOrder);
    }

    private static GarageQuoteVersionSummaryDto MapToVersionDto(GarageQuoteVersion version)
    {
        List<GarageQuoteLineItemDto> snapshotLineItems;
        try
        {
            snapshotLineItems = JsonSerializer.Deserialize<List<GarageQuoteLineItemDto>>(version.LineItemsJson)
                ?? new List<GarageQuoteLineItemDto>();
        }
        catch
        {
            snapshotLineItems = new List<GarageQuoteLineItemDto>();
        }

        return new GarageQuoteVersionSummaryDto(
            version.Id,
            version.VersionNumber,
            version.Subtotal,
            version.TaxAmount,
            version.DiscountAmount,
            version.TotalAmount,
            version.EstimatedCompletionDays,
            version.ValidUntil,
            version.GarageRemarks,
            version.SubmittedAtUtc,
            snapshotLineItems);
    }
}
