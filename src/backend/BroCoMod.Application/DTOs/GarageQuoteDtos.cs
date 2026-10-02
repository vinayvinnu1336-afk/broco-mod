using BroCoMod.Domain.Enums;

namespace BroCoMod.Application.DTOs;

public record CreateQuoteLineItemRequest(
    QuoteLineType LineType,
    string Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal TaxRate = 0m,
    decimal DiscountAmount = 0m,
    int SortOrder = 0
);

public record CreateGarageQuoteRequest(
    Guid GarageRequestId,
    string Currency = "INR",
    int? EstimatedCompletionHours = null,
    int? EstimatedCompletionDays = null,
    DateTime? ValidUntil = null,
    string? GarageRemarks = null,
    List<CreateQuoteLineItemRequest>? LineItems = null
);

public record UpdateGarageQuoteDraftRequest(
    string Currency = "INR",
    int? EstimatedCompletionHours = null,
    int? EstimatedCompletionDays = null,
    DateTime? ValidUntil = null,
    string? GarageRemarks = null,
    List<CreateQuoteLineItemRequest>? LineItems = null
);

public record SubmitGarageQuoteCommand(
    string? IdempotencyKey = null
);

public record WithdrawGarageQuoteCommand(
    string Reason
);

public record GarageQuoteLineItemDto(
    Guid Id,
    string LineType,
    string Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal TaxRate,
    decimal DiscountAmount,
    decimal ItemSubtotal,
    decimal LineTax,
    decimal LineTotal,
    int SortOrder
);

public record GarageQuoteVersionSummaryDto(
    Guid Id,
    int VersionNumber,
    decimal Subtotal,
    decimal TaxAmount,
    decimal DiscountAmount,
    decimal TotalAmount,
    int? EstimatedCompletionDays,
    DateTime ValidUntil,
    string? GarageRemarks,
    DateTime SubmittedAtUtc,
    List<GarageQuoteLineItemDto> LineItems
);

public record GarageQuoteSummaryDto(
    Guid Id,
    Guid GarageRequestId,
    Guid ServiceRequestId,
    string RequestNumber,
    string VehicleSummary,
    string QuoteNumber,
    int VersionNumber,
    string Status,
    string Currency,
    decimal TotalAmount,
    int? EstimatedCompletionDays,
    DateTime ValidUntil,
    DateTime? SubmittedAtUtc,
    DateTime CreatedAtUtc
);

public record GarageQuoteDetailDto(
    Guid Id,
    Guid GarageRequestId,
    Guid ServiceRequestId,
    string ServiceRequestNumber,
    string VehicleSummary,
    string QuoteNumber,
    int VersionNumber,
    string Status,
    string Currency,
    decimal Subtotal,
    decimal TaxAmount,
    decimal DiscountAmount,
    decimal TotalAmount,
    int? EstimatedCompletionHours,
    int? EstimatedCompletionDays,
    DateTime ValidUntil,
    string? GarageRemarks,
    DateTime CreatedAtUtc,
    DateTime? SubmittedAtUtc,
    DateTime? WithdrawnAtUtc,
    string? WithdrawalReason,
    List<GarageQuoteLineItemDto> LineItems,
    List<GarageQuoteVersionSummaryDto> Versions
);

public record AdvisorGarageQuoteSummaryDto(
    Guid Id,
    string QuoteNumber,
    string ServiceRequestNumber,
    Guid GarageId,
    string GarageName,
    double GarageDistanceKm,
    string VehicleSummary,
    string ProblemSummary,
    decimal TotalAmount,
    string Currency,
    int? EstimatedCompletionDays,
    DateTime ValidUntil,
    string Status,
    DateTime? SubmittedAtUtc
);

public record AdvisorGarageQuoteDetailDto(
    Guid Id,
    string QuoteNumber,
    string ServiceRequestNumber,
    Guid GarageId,
    string GarageName,
    string GaragePhone,
    string GarageAddress,
    double GarageDistanceKm,
    string VehicleSummary,
    string ProblemSummary,
    decimal Subtotal,
    decimal TaxAmount,
    decimal DiscountAmount,
    decimal TotalAmount,
    string Currency,
    int? EstimatedCompletionHours,
    int? EstimatedCompletionDays,
    DateTime ValidUntil,
    string? GarageRemarks,
    string Status,
    DateTime? SubmittedAtUtc,
    List<GarageQuoteLineItemDto> LineItems,
    List<GarageQuoteVersionSummaryDto> Versions
);

public record AdminGarageQuoteSummaryDto(
    Guid Id,
    string QuoteNumber,
    string ServiceRequestNumber,
    Guid GarageId,
    string GarageName,
    string VehicleSummary,
    decimal TotalAmount,
    string Currency,
    string Status,
    DateTime? SubmittedAtUtc,
    DateTime CreatedAtUtc
);

public record AdminGarageQuoteDetailDto(
    Guid Id,
    string QuoteNumber,
    string ServiceRequestNumber,
    Guid GarageId,
    string GarageName,
    string GaragePhone,
    string GarageAddress,
    string VehicleSummary,
    decimal Subtotal,
    decimal TaxAmount,
    decimal DiscountAmount,
    decimal TotalAmount,
    string Currency,
    int? EstimatedCompletionHours,
    int? EstimatedCompletionDays,
    DateTime ValidUntil,
    string? GarageRemarks,
    string Status,
    DateTime? SubmittedAtUtc,
    DateTime? WithdrawnAtUtc,
    string? WithdrawalReason,
    List<GarageQuoteLineItemDto> LineItems,
    List<GarageQuoteVersionSummaryDto> Versions
);
