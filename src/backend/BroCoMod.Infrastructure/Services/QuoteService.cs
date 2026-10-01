using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Application.Security;
using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace BroCoMod.Infrastructure.Services;

public class QuoteService : IQuoteService
{
    private readonly IApplicationDbContext _context;

    public QuoteService(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<GarageInternalQuoteDto> SubmitGarageQuoteAsync(
        SubmitGarageQuoteRequest request,
        CancellationToken cancellationToken = default)
    {
        var quote = new GarageQuote(
            request.ServiceRequestId,
            request.GarageId,
            request.GarageInternalPrice,
            request.InternalCostBreakdown,
            request.GarageNotes,
            request.EstimatedDurationHours
        );

        _context.GarageQuotes.Add(quote);
        await _context.SaveChangesAsync(cancellationToken);

        return QuoteDataIsolationPolicy.ProjectToGarageInternalView(quote, UserRole.Garage, request.GarageId);
    }

    public async Task<CustomerQuoteViewDto> AssignCustomerQuotationAsync(
        AssignCustomerQuotationRequest request,
        CancellationToken cancellationToken = default)
    {
        var quotation = new CustomerQuotation(
            request.ServiceRequestId,
            request.SelectedGarageId,
            request.CustomerFacingPrice,
            request.AdvisorMarginApplied,
            request.ScopeSummary,
            request.AdvisorNotes
        );

        _context.CustomerQuotations.Add(quotation);
        await _context.SaveChangesAsync(cancellationToken);

        return QuoteDataIsolationPolicy.ProjectToCustomerView(quotation);
    }

    public async Task<CustomerQuoteViewDto?> GetCustomerQuotationAsync(
        Guid serviceRequestId,
        UserRole requestingRole,
        CancellationToken cancellationToken = default)
    {
        var quotation = await _context.CustomerQuotations
            .AsNoTracking()
            .FirstOrDefaultAsync(cq => cq.ServiceRequestId == serviceRequestId, cancellationToken);

        if (quotation == null) return null;

        return QuoteDataIsolationPolicy.ProjectToCustomerView(quotation);
    }

    public async Task<IEnumerable<GarageInternalQuoteDto>> GetGarageQuotesForAdvisorAsync(
        Guid serviceRequestId,
        UserRole requestingRole,
        CancellationToken cancellationToken = default)
    {
        // Assert role permissions - Customers are barred from internal pricing
        QuoteDataIsolationPolicy.AssertCanViewInternalPricing(requestingRole);

        var quotes = await _context.GarageQuotes
            .Include(gq => gq.Garage)
            .AsNoTracking()
            .Where(gq => gq.ServiceRequestId == serviceRequestId)
            .ToListAsync(cancellationToken);

        return quotes.Select(q => QuoteDataIsolationPolicy.ProjectToGarageInternalView(q, requestingRole));
    }
}
