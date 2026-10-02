namespace BroCoMod.Application.DTOs;

public record AcceptQuotationRequest(
    string? IdempotencyKey = null,
    string? CustomerRemarks = null
);

public record RejectQuotationRequest(
    string Reason,
    string? Category = null,
    string? IdempotencyKey = null
);

public record CustomerQuotationDecisionDto(
    Guid Id,
    Guid CustomerQuotationId,
    string QuotationNumber,
    Guid CustomerQuotationVersionId,
    int VersionNumber,
    Guid CustomerId,
    string Decision,
    string? Category,
    string? Reason,
    DateTime DecidedAtUtc,
    string? IdempotencyKey
);

public record BookingConfirmationDto(
    Guid QuotationId,
    string QuotationNumber,
    Guid ServiceRequestId,
    string RequestNumber,
    Guid GarageId,
    string GarageName,
    string GarageAddress,
    string? GaragePhone,
    decimal ConfirmedTotal,
    string Currency,
    DateTime ConfirmedAtUtc,
    string Status,
    string VehicleSummary,
    string Message
);

public record GarageConfirmedBookingDto(
    Guid AssignmentId,
    Guid ServiceRequestId,
    string RequestNumber,
    string VehicleMake,
    string VehicleModel,
    int VehicleYear,
    string VehicleLicensePlate,
    string ProblemDescription,
    DateTime ConfirmedAtUtc,
    decimal QuotedAmount,
    string QuoteNumber
);
