using BroCoMod.Application.DTOs;

namespace BroCoMod.Application.Interfaces;

/// <summary>
/// Domain service for Garage Quotations.
/// Enforces multi-tenant data isolation:
/// - Garages can only access/manage their own quotes
/// - Advisors have read-only visibility into submitted quotes
/// - Customers have zero access to garage quotations or line items
/// </summary>
public interface IGarageQuoteService
{
    // Garage Operations
    Task<GarageQuoteDetailDto> CreateDraftQuoteAsync(
        Guid garageId,
        Guid userId,
        CreateGarageQuoteRequest request,
        CancellationToken cancellationToken = default);

    Task<GarageQuoteDetailDto> UpdateDraftQuoteAsync(
        Guid garageId,
        Guid quoteId,
        Guid userId,
        UpdateGarageQuoteDraftRequest request,
        CancellationToken cancellationToken = default);

    Task<GarageQuoteDetailDto> SubmitQuoteAsync(
        Guid garageId,
        Guid quoteId,
        Guid userId,
        SubmitGarageQuoteCommand command,
        CancellationToken cancellationToken = default);

    Task<GarageQuoteDetailDto> CreateRevisionAsync(
        Guid garageId,
        Guid quoteId,
        Guid userId,
        CancellationToken cancellationToken = default);

    Task<GarageQuoteDetailDto> WithdrawQuoteAsync(
        Guid garageId,
        Guid quoteId,
        Guid userId,
        WithdrawGarageQuoteCommand command,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<GarageQuoteSummaryDto>> GetQuotesForGarageAsync(
        Guid garageId,
        string? status = null,
        CancellationToken cancellationToken = default);

    Task<GarageQuoteDetailDto?> GetGarageQuoteDetailAsync(
        Guid garageId,
        Guid quoteId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<GarageQuoteSummaryDto>> GetQuotesForGarageRequestAsync(
        Guid garageId,
        Guid garageRequestId,
        CancellationToken cancellationToken = default);

    // Advisor Operations (Read-Only)
    Task<IReadOnlyList<AdvisorGarageQuoteSummaryDto>> GetQuotesForAdvisorAsync(
        string? status = null,
        Guid? serviceRequestId = null,
        CancellationToken cancellationToken = default);

    Task<AdvisorGarageQuoteDetailDto?> GetAdvisorQuoteDetailAsync(
        Guid quoteId,
        CancellationToken cancellationToken = default);

    // Super Admin Operations
    Task<IReadOnlyList<AdminGarageQuoteSummaryDto>> GetAllQuotesForAdminAsync(
        string? status = null,
        Guid? garageId = null,
        Guid? serviceRequestId = null,
        CancellationToken cancellationToken = default);

    Task<AdminGarageQuoteDetailDto?> GetAdminQuoteDetailAsync(
        Guid quoteId,
        CancellationToken cancellationToken = default);

    // Background Expiration
    Task<int> ExpireStaleQuotesAsync(CancellationToken cancellationToken = default);
}
