using BroCoMod.Domain.Enums;

namespace BroCoMod.Application.DTOs;

public record QuoteComparisonDto(
    Guid ServiceRequestId,
    string RequestNumber,
    string VehicleSummary,
    string ProblemDescription,
    string CustomerFormattedAddress,
    string RequestStatus,
    int TotalQuotesCount,
    int PendingGaragesCount,
    decimal? LowestQuotedAmount,
    DateTime? LatestQuoteReceivedAtUtc,
    GarageAssignmentDto? ActiveAssignment,
    List<QuoteComparisonItemDto> Quotes
);

public record QuoteComparisonItemDto(
    Guid QuoteId,
    string QuoteNumber,
    Guid GarageId,
    string GarageName,
    string GarageAddress,
    double DistanceKm,
    decimal Subtotal,
    decimal DiscountAmount,
    decimal TaxAmount,
    decimal GrandTotal,
    int EstimatedDurationHours,
    int EstimatedDurationDays,
    string Status,
    DateTime SubmittedAtUtc,
    DateTime ValidUntil,
    string? Notes,
    int LineItemsCount,
    List<GarageQuoteLineItemDto> LineItems
);

public record AdvisorRequestNoteDto(
    Guid Id,
    Guid ServiceRequestId,
    Guid AdvisorId,
    string AdvisorName,
    string Note,
    DateTime CreatedAtUtc,
    DateTime? UpdatedAtUtc,
    bool IsOwnNote
);

public record CreateAdvisorNoteRequest(
    string Note
);

public record UpdateAdvisorNoteRequest(
    string Note
);

public record AssignGarageRequest(
    Guid GarageId,
    Guid QuoteId,
    string? AssignmentReason
);

public record GarageAssignmentDto(
    Guid Id,
    Guid ServiceRequestId,
    string RequestNumber,
    Guid GarageId,
    string GarageName,
    Guid SelectedQuoteId,
    string SelectedQuoteNumber,
    decimal SelectedQuoteAmount,
    Guid AssignedByAdvisorId,
    string AssignedByAdvisorName,
    DateTime AssignedAtUtc,
    string Status,
    string? AssignmentReason,
    DateTime? CancelledAtUtc,
    string? CancellationReason
);
