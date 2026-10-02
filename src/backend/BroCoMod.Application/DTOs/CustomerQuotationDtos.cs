using BroCoMod.Domain.Enums;

namespace BroCoMod.Application.DTOs;

public record CustomerQuotationLineItemInputDto(
    QuoteLineType LineType,
    string Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal TaxRate,
    decimal DiscountAmount,
    int SortOrder
);

public record CreateCustomerQuotationRequest(
    string ScopeSummary,
    string? AdvisorRemarks,
    DateTime ValidUntilUtc,
    decimal CustomerDiscount,
    string Currency,
    List<CustomerQuotationLineItemInputDto> LineItems
);

public record UpdateCustomerQuotationDraftRequest(
    string ScopeSummary,
    string? AdvisorRemarks,
    DateTime ValidUntilUtc,
    decimal CustomerDiscount,
    List<CustomerQuotationLineItemInputDto> LineItems
);

public record CustomerQuotationLineItemDto(
    Guid Id,
    QuoteLineType LineType,
    string Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal TaxRate,
    decimal DiscountAmount,
    decimal LineTotal,
    int SortOrder
);

public record CustomerQuotationVersionDto(
    Guid Id,
    int VersionNumber,
    decimal CustomerSubtotal,
    decimal CustomerDiscount,
    decimal CustomerTax,
    decimal CustomerTotal,
    DateTime ValidUntilUtc,
    string? AdvisorRemarks,
    string? ScopeSummary,
    DateTime CreatedAtUtc
);

/// <summary>
/// Operational DTO for Advisor and Super Admin portals.
/// Contains complete quotation details including lineage to garage assignment and immutable version snapshots.
/// </summary>
public record CustomerQuotationDto(
    Guid Id,
    Guid ServiceRequestId,
    string RequestNumber,
    Guid? GarageAssignmentId,
    Guid AssignedGarageId,
    string AssignedGarageName,
    string QuotationNumber,
    string Currency,
    decimal CustomerSubtotal,
    decimal CustomerDiscount,
    decimal CustomerTax,
    decimal CustomerTotal,
    DateTime ValidUntilUtc,
    string Status,
    int VersionNumber,
    string ScopeSummary,
    string? AdvisorRemarks,
    DateTime? SentAtUtc,
    DateTime? AcceptedAtUtc,
    DateTime? RejectedAtUtc,
    DateTime CreatedAtUtc,
    List<CustomerQuotationLineItemDto> LineItems,
    List<CustomerQuotationVersionDto> Versions
);

public record CustomerQuotationSummaryDto(
    Guid Id,
    Guid ServiceRequestId,
    string RequestNumber,
    string QuotationNumber,
    decimal CustomerTotal,
    string Status,
    int VersionNumber,
    DateTime ValidUntilUtc,
    DateTime CreatedAtUtc
);

/// <summary>
/// STRICT CUSTOMER PORTAL VIEW:
/// Contains ONLY customer-facing information.
/// Garage internal quotes, wholesale costs, margins, and competitor bids are completely absent.
/// </summary>
public record CustomerFacingQuotationDto(
    Guid Id,
    string QuotationNumber,
    Guid ServiceRequestId,
    string RequestNumber,
    string VehicleMake,
    string VehicleModel,
    int VehicleYear,
    string VehicleLicensePlate,
    string ScopeSummary,
    string? AdvisorRemarks,
    string Currency,
    decimal CustomerSubtotal,
    decimal CustomerDiscount,
    decimal CustomerTax,
    decimal CustomerTotal,
    DateTime ValidUntilUtc,
    string Status,
    DateTime CreatedAtUtc,
    List<CustomerFacingLineItemDto> LineItems
);

public record CustomerFacingLineItemDto(
    Guid Id,
    string LineType,
    string Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal TaxRate,
    decimal DiscountAmount,
    decimal LineTotal,
    int SortOrder
);
