namespace BroCoMod.Application.DTOs;

public record CreateServiceBookingRequest(
    Guid VehicleId,
    string AddressLine1,
    string? AddressLine2,
    string City,
    string State,
    string Pincode,
    string Country,
    double Latitude,
    double Longitude,
    string ProblemDescription,
    string? ServiceCategory = "General",
    DateTime? PreferredServiceDate = null
);

public record CancelServiceRequestCommand(
    string Reason
);

public record ServiceLocationDto(
    Guid Id,
    string AddressLine1,
    string? AddressLine2,
    string City,
    string State,
    string Pincode,
    string Country,
    double Latitude,
    double Longitude,
    string FormattedAddress
);

public record ServiceRequestDetailDto(
    Guid Id,
    string RequestNumber,
    Guid CustomerId,
    string CustomerName,
    Guid? CustomerVehicleId,
    string VehicleSummary,
    string VehicleLicensePlate,
    ServiceLocationDto ServiceLocation,
    string ProblemDescription,
    string ServiceCategory,
    DateTime? PreferredServiceDate,
    string Status,
    Guid? AssignedAdvisorId,
    string? AssignedAdvisorName,
    int MatchedGaragesCount,
    DateTime SubmittedAtUtc,
    DateTime? CancelledAtUtc,
    string? CancellationReason
);

public record CustomerServiceRequestSummaryDto(
    Guid Id,
    string RequestNumber,
    string VehicleSummary,
    string LicensePlate,
    string LocationSummary,
    string ProblemDescription,
    string Status,
    DateTime CreatedAtUtc,
    DateTime SubmittedAtUtc,
    int QuotesCount = 0
);

public record GarageIncomingRequestDto(
    Guid GarageRequestId,
    Guid ServiceRequestId,
    string RequestNumber,
    string VehicleSummary,
    string ProblemDescription,
    string LocationArea,
    double DistanceKm,
    string Status,
    DateTime SentAtUtc
);

public record GarageIncomingRequestDetailDto(
    Guid GarageRequestId,
    Guid ServiceRequestId,
    string RequestNumber,
    string VehicleMake,
    string VehicleModel,
    int VehicleYear,
    string VehicleLicensePlate,
    string ProblemDescription,
    string ServiceCategory,
    DateTime? PreferredServiceDate,
    string LocationArea,
    double DistanceKm,
    string Status,
    DateTime SentAtUtc,
    DateTime? ViewedAtUtc,
    DateTime? RespondedAtUtc
);

public record AdvisorServiceRequestSummaryDto(
    Guid Id,
    string RequestNumber,
    Guid CustomerId,
    string CustomerName,
    string CustomerEmail,
    string CustomerPhone,
    string VehicleSummary,
    string LocationSummary,
    string ProblemDescription,
    string ServiceCategory,
    string Status,
    int EligibleGaragesCount,
    int DispatchedGaragesCount,
    DateTime SubmittedAtUtc
);

public record DispatchedGarageSummaryDto(
    Guid GarageRequestId,
    Guid GarageId,
    string GarageName,
    string GaragePhoneNumber,
    double DistanceKm,
    string Status,
    DateTime SentAtUtc
);

public record AdvisorServiceRequestDetailDto(
    Guid Id,
    string RequestNumber,
    Guid CustomerId,
    string CustomerName,
    string CustomerEmail,
    string CustomerPhone,
    string VehicleSummary,
    string VehicleLicensePlate,
    ServiceLocationDto ServiceLocation,
    string ProblemDescription,
    string ServiceCategory,
    DateTime? PreferredServiceDate,
    string Status,
    Guid? AssignedAdvisorId,
    IReadOnlyList<DispatchedGarageSummaryDto> DispatchedGarages,
    DateTime SubmittedAtUtc
);

public record AdminServiceRequestSummaryDto(
    Guid Id,
    string RequestNumber,
    Guid CustomerId,
    string CustomerName,
    string VehicleSummary = "",
    string LocationSummary = "",
    string Status = "",
    string? AssignedAdvisorName = null,
    int EligibleGaragesCount = 0,
    int DispatchedGaragesCount = 0,
    DateTime SubmittedAtUtc = default,
    string? CustomerEmail = null,
    string? VehicleMake = null,
    string? VehicleModel = null,
    string? VehicleLicensePlate = null,
    Guid? AssignedAdvisorId = null,
    int QuotesReceivedCount = 0,
    string? AssignedGarageName = null,
    string? ServiceJobStatus = null,
    DateTime? CreatedAtUtc = null
);

public record AdminServiceRequestDetailDto(
    Guid Id,
    string RequestNumber,
    Guid CustomerId,
    string CustomerName,
    string CustomerEmail,
    string CustomerPhone,
    string VehicleSummary,
    string VehicleLicensePlate,
    ServiceLocationDto ServiceLocation,
    string ProblemDescription,
    string ServiceCategory,
    DateTime? PreferredServiceDate,
    string Status,
    Guid? AssignedAdvisorId,
    string? AssignedAdvisorName,
    IReadOnlyList<DispatchedGarageSummaryDto> DispatchedGarages,
    DateTime SubmittedAtUtc,
    DateTime? CancelledAtUtc,
    string? CancellationReason
);

public record PagedResult<T>(
    IReadOnlyList<T> Items,
    int Page,
    int PageSize,
    int TotalCount
)
{
    public int TotalPages => (int)Math.Ceiling((double)TotalCount / (PageSize > 0 ? PageSize : 1));
}
