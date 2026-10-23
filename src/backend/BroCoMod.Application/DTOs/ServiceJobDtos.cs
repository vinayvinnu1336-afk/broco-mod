using BroCoMod.Domain.Enums;

namespace BroCoMod.Application.DTOs;

public record ServiceInspectionDto(
    Guid Id,
    Guid InspectorUserId,
    string InspectorName,
    DateTime InspectionStartedAtUtc,
    DateTime? InspectionCompletedAtUtc,
    string? Findings,
    string? Recommendations,
    string? CustomerVisibleSummary,
    string OverallSeverity,
    DateTime CreatedAtUtc
);

public record CustomerServiceInspectionDto(
    DateTime InspectionStartedAtUtc,
    DateTime? InspectionCompletedAtUtc,
    string? CustomerVisibleSummary,
    string OverallSeverity
);

public record ServiceJobActivityDto(
    Guid Id,
    string ActivityType,
    string Message,
    bool IsCustomerVisible,
    string ActorName,
    DateTime CreatedAtUtc
);

public record CustomerJobActivityDto(
    string ActivityType,
    string Message,
    DateTime CreatedAtUtc
);

public record AdditionalWorkRequestDto(
    Guid Id,
    Guid ServiceJobId,
    string Description,
    decimal EstimatedAdditionalAmount,
    string Reason,
    string Status,
    Guid? ReviewedByAdvisorId,
    string? AdvisorRemarks,
    DateTime? ReviewedAtUtc,
    DateTime CreatedAtUtc
);

public record ServiceJobSummaryDto(
    Guid Id,
    string JobNumber,
    Guid ServiceRequestId,
    string RequestNumber,
    Guid GarageId,
    string GarageName,
    string Status,
    DateTime? ScheduledStartAtUtc,
    DateTime? EstimatedCompletionAtUtc,
    DateTime? ActualWorkCompletedAtUtc,
    DateTime CreatedAtUtc,
    string? VehicleSummary = null,
    string? VehicleLicensePlate = null,
    string? ServicePackageName = null,
    bool IsAdvancePaid = false
);

public record GarageServiceJobDetailDto(
    Guid Id,
    string JobNumber,
    Guid ServiceRequestId,
    string RequestNumber,
    Guid CustomerQuotationId,
    string QuotationNumber,
    Guid GarageId,
    string GarageName,
    string Status,
    string VehicleMake,
    string VehicleModel,
    int VehicleYear,
    string VehicleLicensePlate,
    int? CurrentMileageKm,
    string CustomerName,
    string CustomerPhone,
    string ProblemDescription,
    string CustomerComplaintSnapshot,
    DateTime? ScheduledStartAtUtc,
    DateTime? EstimatedCompletionAtUtc,
    DateTime? ActualVehicleReceivedAtUtc,
    DateTime? ActualWorkStartedAtUtc,
    DateTime? ActualWorkCompletedAtUtc,
    DateTime? VehicleReadyAtUtc,
    DateTime? HandedOverAtUtc,
    DateTime? ClosedAtUtc,
    DateTime? CancelledAtUtc,
    string? CancellationReason,
    string? GarageInternalNotes,
    string? CustomerFacingNotes,
    List<ServiceInspectionDto> Inspections,
    List<ServiceJobActivityDto> Activities,
    List<AdditionalWorkRequestDto> AdditionalWorkRequests,
    Guid ConcurrencyToken,
    string? ServicePackageName = null,
    decimal ServiceValue = 0,
    decimal AdvancePaidAmount = 0,
    bool IsAdvancePaid = false,
    decimal BalanceToCollect = 0,
    bool NeedsPickup = false,
    string? PickupNotes = null,
    string? PickupSlot = null,
    GarageCustomerLocationDto? CustomerLocation = null,
    IReadOnlyList<string>? ServiceItems = null,
    string? ServiceCategory = null,
    string? VehicleFuel = null,
    DateTime? PreferredServiceDate = null,
    DateTime? PaymentReceivedAtUtc = null,
    decimal? PaymentReceivedAmount = null,
    string? PaymentMode = null
);

/// <summary>
/// Where the car is, for the garage that is doing the job (never for garages that only quoted):
/// the customer's full address and pin, the workshop's pin and the straight-line distance between them.
/// </summary>
public record GarageCustomerLocationDto(
    string AddressLine1,
    string? AddressLine2,
    string City,
    string State,
    string Pincode,
    string FormattedAddress,
    double Latitude,
    double Longitude,
    double? WorkshopLatitude = null,
    double? WorkshopLongitude = null,
    string? WorkshopAddress = null,
    double? DistanceKm = null
);

public record CustomerServiceJobDetailDto(
    Guid Id,
    string JobNumber,
    Guid ServiceRequestId,
    string RequestNumber,
    string GarageName,
    string Status,
    string VehicleMake,
    string VehicleModel,
    int VehicleYear,
    string VehicleLicensePlate,
    DateTime? ScheduledStartAtUtc,
    DateTime? EstimatedCompletionAtUtc,
    DateTime? ActualVehicleReceivedAtUtc,
    DateTime? ActualWorkStartedAtUtc,
    DateTime? ActualWorkCompletedAtUtc,
    DateTime? VehicleReadyAtUtc,
    DateTime? HandedOverAtUtc,
    DateTime? ClosedAtUtc,
    string? CustomerFacingNotes,
    CustomerServiceInspectionDto? Inspection,
    List<CustomerJobActivityDto> Timeline
);

public record AdvisorServiceJobDetailDto(
    Guid Id,
    string JobNumber,
    Guid ServiceRequestId,
    string RequestNumber,
    Guid CustomerQuotationId,
    string QuotationNumber,
    Guid GarageId,
    string GarageName,
    string Status,
    string VehicleMake,
    string VehicleModel,
    int VehicleYear,
    string VehicleLicensePlate,
    int? CurrentMileageKm,
    string CustomerName,
    string CustomerPhone,
    string ProblemDescription,
    string CustomerComplaintSnapshot,
    DateTime? ScheduledStartAtUtc,
    DateTime? EstimatedCompletionAtUtc,
    DateTime? ActualVehicleReceivedAtUtc,
    DateTime? ActualWorkStartedAtUtc,
    DateTime? ActualWorkCompletedAtUtc,
    DateTime? VehicleReadyAtUtc,
    DateTime? HandedOverAtUtc,
    DateTime? ClosedAtUtc,
    DateTime? CancelledAtUtc,
    string? CancellationReason,
    string? GarageInternalNotes,
    string? CustomerFacingNotes,
    List<ServiceInspectionDto> Inspections,
    List<ServiceJobActivityDto> Activities,
    List<AdditionalWorkRequestDto> AdditionalWorkRequests,
    Guid ConcurrencyToken,
    bool NeedsPickup = false,
    string? PickupNotes = null,
    string? PickupSlot = null,
    DateTime? PreferredServiceDate = null
);

// Command DTOs
public record ScheduleJobRequest(
    DateTime ScheduledStartAtUtc,
    DateTime EstimatedCompletionAtUtc,
    string? Notes
);

public record ReceiveVehicleRequest(
    int? CurrentMileageKm,
    string? Notes
);

public record StartInspectionRequest(
    InspectionSeverity Severity = InspectionSeverity.Info
);

public record CompleteInspectionRequest(
    string? Findings,
    string? Recommendations,
    string? CustomerVisibleSummary,
    InspectionSeverity Severity
);

public record StartWorkRequest(
    string? Notes
);

public record UpdateJobProgressRequest(
    string ProgressNotes,
    bool IsCustomerVisible = true
);

public record CompleteWorkRequest(
    string? Notes,
    string? CustomerFacingNotes
);

public record VehicleReadyRequest(
    string? CustomerFacingNotes
);

public record HandOverVehicleRequest(
    string? HandoverNotes
);

public record CloseJobRequest(
    string? ClosingRemarks
);

/// <summary>Mode is free text from the app: Cash, UPI, Card or Other.</summary>
public record RecordPaymentReceivedRequest(
    decimal AmountReceived,
    string? PaymentMode,
    string? Notes = null
);

public record CancelJobRequest(
    string Reason
);

public record CreateAdditionalWorkRequest(
    string Description,
    decimal EstimatedAdditionalAmount,
    string Reason
);

public record ReviewAdditionalWorkRequest(
    bool Approved,
    string? Remarks
);
