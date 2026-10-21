namespace BroCoMod.Application.DTOs;

/// <summary>Only BroCo (a super admin) cancels a booking once money has changed hands; see IBookingCancellationService.</summary>
public static class BookingCancellationRules
{
    public const string SupportEmail = "support@brocomob.com";
    public const int ReasonMaxLength = 500;

    public const string CustomerAfterPaymentMessage =
        "This booking can't be cancelled after payment. Please contact BroCo support.";

    public const string CustomerCarAtGarageMessage =
        "This booking can't be cancelled now that the garage has your car. Please contact BroCo support.";

    public const string GarageCannotCancelMessage =
        "Garages can't cancel bookings. Use \"Ask BroCo to reassign or cancel\" on the job and our team will take it from here.";
}

public record AdminCancelBookingRequest(string Reason);

public record GarageCancellationAskRequest(string Reason);

public record BookingCancellationPaymentDto(
    Guid Id,
    string PaymentNumber,
    string Purpose,
    string Status,
    decimal Amount,
    decimal RefundedAmount,
    DateTime? PaidAtUtc);

/// <summary>What an admin needs to see before (and after) cancelling a booking. No refund is made automatically.</summary>
public record AdminBookingCancellationDto(
    Guid ServiceRequestId,
    string RequestNumber,
    string RequestStatus,
    bool IsCancelled,
    bool CanCancel,
    string? CannotCancelReason,
    DateTime? CancelledAtUtc,
    string? CancellationReason,
    Guid? ServiceJobId,
    string? JobNumber,
    string? JobStatus,
    string? GarageName,
    string Currency,
    // Money the customer paid BroCo online (booking advance and any extra work), before refunds.
    decimal PaidOnline,
    decimal RefundedSoFar,
    decimal RefundableNow,
    IReadOnlyList<BookingCancellationPaymentDto> Payments,
    string? CommissionNumber,
    string? CommissionStatus,
    decimal? CommissionTotalDue,
    // Admin -> Payments filtered to this booking: refunds are made there per the Cancellation & Refund Policy.
    string RefundLink);

public record GarageCancellationAskResultDto(
    Guid ServiceJobId,
    string JobNumber,
    int NotifiedCount);
