using BroCoMod.Domain.Enums;

namespace BroCoMod.Application.DTOs;

/// <summary>
/// SAFE FOR CUSTOMER:
/// Strictly contains customer-facing price and scope summary.
/// Internal garage prices and cost breakdowns are NEVER present in this DTO.
/// </summary>
public record CustomerQuoteViewDto(
    Guid Id,
    Guid ServiceRequestId,
    decimal CustomerFacingPrice,
    string ScopeSummary,
    string AdvisorNotes,
    QuoteStatus Status,
    DateTime CreatedAtUtc
);

/// <summary>
/// CONFIDENTIAL FOR GARAGE & ADVISOR ONLY:
/// Contains garage internal price and cost breakdowns.
/// MUST NEVER be returned to Customer role endpoints.
/// </summary>
public record GarageInternalQuoteDto(
    Guid Id,
    Guid ServiceRequestId,
    Guid GarageId,
    string GarageName,
    decimal GarageInternalPrice,
    string InternalCostBreakdown,
    string GarageNotes,
    int EstimatedDurationHours,
    QuoteStatus Status,
    DateTime CreatedAtUtc
);

/// <summary>
/// ADVISOR / SUPER-ADMIN ONLY:
/// Contains full pricing matrix including garage internal cost, advisor margin, and customer facing price.
/// </summary>
public record AdvisorQuoteReviewDto(
    Guid QuoteId,
    Guid ServiceRequestId,
    Guid GarageId,
    string GarageName,
    decimal GarageInternalPrice,
    string InternalCostBreakdown,
    decimal AdvisorMargin,
    decimal RecommendedCustomerPrice,
    QuoteStatus Status
);

public record SubmitGarageQuoteRequest(
    Guid ServiceRequestId,
    Guid GarageId,
    decimal GarageInternalPrice,
    string InternalCostBreakdown,
    string GarageNotes,
    int EstimatedDurationHours
);

public record AssignCustomerQuotationRequest(
    Guid ServiceRequestId,
    Guid SelectedGarageId,
    decimal CustomerFacingPrice,
    decimal AdvisorMarginApplied,
    string ScopeSummary,
    string AdvisorNotes
);
