using BroCoMod.Domain.Enums;

namespace BroCoMod.Application.DTOs;

// ==========================================
// Admin Dashboard KPIs
// ==========================================
public record AdminDashboardKpiDto(
    // Backward-compatible counts for existing admin dashboard
    int TotalUsersCount,
    int TotalCustomersCount,
    int TotalGaragesCount,
    int TotalAdvisorsCount,
    int TotalRequestsCount,
    // Milestone 9 Operational Metrics
    int TotalServiceRequests,
    int ActiveServiceRequests,
    int CompletedServiceRequests,
    int CancelledServiceRequests,
    int TotalGarages,
    int ActiveGarages,
    int PendingVerificationGarages,
    int SuspendedGarages,
    int InactiveGarages,
    int TotalAdvisors,
    int ActiveAdvisors,
    int TotalCustomers,
    int ActiveCustomers,
    int ServiceJobsInProgress,
    int CompletedServiceJobs,
    int RequestsNeedingAttention,
    int FailedNotificationsCount,
    IReadOnlyList<AdminUserSummaryDto> RecentUsers,
    IReadOnlyList<AdminAuditLogSummaryDto> RecentAuditLogs,
    IReadOnlyList<AdminRequestSummaryDto> RecentRequests
);

// ==========================================
// Service Request Management DTOs
// ==========================================
public record AdminRequestFilter(
    string? Status = null,
    string? Search = null,
    Guid? AssignedAdvisorId = null,
    DateTime? FromDateUtc = null,
    DateTime? ToDateUtc = null,
    int PageNumber = 1,
    int PageSize = 25
);

public record AdminRequestSummaryDto(
    Guid Id,
    string RequestNumber,
    Guid CustomerId,
    string CustomerName,
    string CustomerEmail,
    string VehicleMake,
    string VehicleModel,
    string VehicleLicensePlate,
    string Status,
    Guid? AssignedAdvisorId,
    string? AssignedAdvisorName,
    int DispatchedGaragesCount,
    int QuotesReceivedCount,
    string? AssignedGarageName,
    string? ServiceJobStatus,
    DateTime CreatedAtUtc,
    string VehicleSummary = "",
    string LocationSummary = "",
    int EligibleGaragesCount = 0,
    DateTime SubmittedAtUtc = default
);

public record AdminRequestOperationalDetailDto(
    Guid Id,
    string RequestNumber,
    string Status,
    DateTime CreatedAtUtc,
    // Customer & Vehicle
    Guid CustomerId,
    string CustomerName,
    string CustomerEmail,
    string CustomerPhone,
    string VehicleMake,
    string VehicleModel,
    string VehicleLicensePlate,
    string ProblemDescription,
    string? ServiceCategory,
    double CustomerLatitude,
    double CustomerLongitude,
    string? CustomerAddress,
    // Assigned Advisor
    Guid? AssignedAdvisorId,
    string? AssignedAdvisorName,
    string? AssignedAdvisorEmail,
    // Operational Stages
    IReadOnlyList<AdminDispatchedGarageDto> DispatchedGarages,
    IReadOnlyList<AdminReceivedQuoteDto> QuotesReceived,
    IReadOnlyList<AdminAdvisorNoteDto> AdvisorNotes,
    AdminGarageAssignmentDto? CurrentAssignment,
    AdminCustomerQuotationDto? CustomerQuotation,
    AdminCustomerDecisionDto? CustomerDecision,
    AdminServiceJobSummaryDto? ServiceJob,
    IReadOnlyList<AdminAuditLogSummaryDto> TimelineEvents
);

public record AdminDispatchedGarageDto(
    Guid GarageId,
    string GarageName,
    string GarageEmail,
    string GaragePhone,
    double DistanceKm,
    string Status,
    DateTime CreatedAtUtc,
    DateTime? RespondedAtUtc,
    string? DeclineReason
);

public record AdminReceivedQuoteDto(
    Guid QuoteId,
    string QuoteNumber,
    Guid GarageId,
    string GarageName,
    decimal Subtotal,
    decimal TaxAmount,
    decimal DiscountAmount,
    decimal TotalAmount,
    string Currency,
    string Status,
    DateTime ValidUntil,
    DateTime SubmittedAtUtc,
    IReadOnlyList<AdminQuoteLineItemDto> LineItems
);

public record AdminQuoteLineItemDto(
    string Description,
    string ItemType,
    decimal Quantity,
    decimal UnitPrice,
    decimal TotalPrice,
    string? PartNumber
);

public record AdminAdvisorNoteDto(
    Guid Id,
    Guid AdvisorId,
    string AdvisorName,
    string Note,
    DateTime CreatedAtUtc
);

public record AdminGarageAssignmentDto(
    Guid Id,
    Guid GarageId,
    string GarageName,
    Guid SelectedQuoteId,
    string SelectedQuoteNumber,
    string Status,
    string? AssignmentReason,
    DateTime AssignedAtUtc,
    DateTime? ConfirmedAtUtc
);

public record AdminCustomerQuotationDto(
    Guid Id,
    string QuotationNumber,
    decimal TotalAmount,
    decimal PlatformMarginPercentage,
    string Status,
    DateTime ExpiresAtUtc,
    DateTime CreatedAtUtc,
    DateTime? SentToCustomerAtUtc,
    int CurrentVersionNumber
);

public record AdminCustomerDecisionDto(
    Guid Id,
    string Decision,
    DateTime DecidedAtUtc,
    string? DecisionCategory,
    string? DecisionReason
);

public record AdminServiceJobSummaryDto(
    Guid Id,
    string JobNumber,
    string Status,
    DateTime? ScheduledStartAtUtc,
    DateTime? VehicleReceivedAtUtc,
    DateTime? WorkStartedAtUtc,
    DateTime? WorkCompletedAtUtc,
    DateTime? VehicleHandedOverAtUtc,
    DateTime? ClosedAtUtc,
    string? OverallSeverity,
    int ActivitiesCount,
    int AdditionalWorkRequestsCount
);

// ==========================================
// Garage Operations DTOs
// ==========================================
public record AdminGarageFilter(
    GarageStatus? Status = null,
    string? Search = null,
    int PageNumber = 1,
    int PageSize = 25
);

public record AdminGarageListDto(
    Guid Id,
    string Name,
    string Email,
    string PhoneNumber,
    string Address,
    double ServiceRadiusKm,
    GarageStatus Status,
    bool IsActive,
    bool IsOperational,
    DateTime CreatedAtUtc,
    DateTime? StatusChangedAtUtc,
    string? StatusReason,
    int ActiveJobsCount,
    int TotalQuotesCount
);

public record AdminGarageDetailDto(
    Guid Id,
    string Name,
    string Email,
    string PhoneNumber,
    string Address,
    double Longitude,
    double Latitude,
    double ServiceRadiusKm,
    GarageStatus Status,
    bool IsActive,
    bool IsOperational,
    string? StatusReason,
    DateTime? StatusChangedAtUtc,
    DateTime CreatedAtUtc,
    Guid ConcurrencyToken,
    int TotalDispatchesReceived,
    int TotalQuotesSubmitted,
    int TotalQuotesWon,
    decimal WinRatePercentage,
    int ActiveJobsCount,
    int CompletedJobsCount,
    IReadOnlyList<AdminGarageRecentJobDto> RecentJobs,
    IReadOnlyList<AdminAuditLogSummaryDto> AuditHistory
);

public record AdminGarageRecentJobDto(
    Guid Id,
    string JobNumber,
    string RequestNumber,
    string VehicleSummary,
    string Status,
    DateTime CreatedAtUtc
);

public record VerifyGarageRequest();
public record SuspendGarageRequest(string Reason);
public record ActivateGarageRequest();
public record DeactivateGarageRequest(string Reason);
public record UpdateGarageRadiusRequest(double RadiusKm);

// ==========================================
// Advisor Operations DTOs
// ==========================================
public record AdminAdvisorFilter(
    string? Search = null,
    bool? IsActive = null,
    int PageNumber = 1,
    int PageSize = 25
);

public record AdminAdvisorListDto(
    Guid Id,
    Guid UserId,
    string FullName,
    string Email,
    string EmployeeCode,
    string Specialization,
    bool IsActive,
    int ActiveAssignedRequestsCount,
    int TotalQuotesReviewedCount,
    int ActiveJobsOverseeingCount,
    DateTime CreatedAtUtc
);

public record ActivateAdvisorRequest();
public record DeactivateAdvisorRequest(string Reason);

// ==========================================
// Customer Operations DTOs
// ==========================================
public record AdminCustomerFilter(
    string? Search = null,
    int PageNumber = 1,
    int PageSize = 25
);

public record AdminCustomerListDto(
    Guid Id,
    Guid UserId,
    string FullName,
    string Email,
    string PhoneNumber,
    int VehiclesCount,
    int RequestsCount,
    DateTime CreatedAtUtc
);

public record AdminCustomerDetailDto(
    Guid Id,
    Guid UserId,
    string FullName,
    string Email,
    string PhoneNumber,
    string Address,
    string PreferredContactMethod,
    DateTime CreatedAtUtc,
    IReadOnlyList<CustomerVehicleDto> Vehicles,
    IReadOnlyList<AdminRequestSummaryDto> ServiceRequests
);

// ==========================================
// Service Jobs Operations DTOs
// ==========================================
public record AdminJobFilter(
    ServiceJobStatus? Status = null,
    Guid? GarageId = null,
    string? Search = null,
    int PageNumber = 1,
    int PageSize = 25
);

public record AdminJobListItemDto(
    Guid Id,
    string JobNumber,
    Guid ServiceRequestId,
    string RequestNumber,
    Guid GarageId,
    string GarageName,
    string CustomerName,
    string VehicleSummary,
    string Status,
    DateTime? ScheduledStartAtUtc,
    DateTime? VehicleReceivedAtUtc,
    DateTime? WorkCompletedAtUtc,
    DateTime CreatedAtUtc
);

public record AdminJobDetailDto(
    Guid Id,
    string JobNumber,
    Guid ServiceRequestId,
    string RequestNumber,
    Guid GarageId,
    string GarageName,
    string CustomerName,
    string VehicleSummary,
    string Status,
    string? CustomerComplaintSnapshot,
    string? GarageInternalNotes,
    string? CustomerFacingNotes,
    DateTime? ScheduledStartAtUtc,
    DateTime? VehicleReceivedAtUtc,
    DateTime? WorkStartedAtUtc,
    DateTime? WorkCompletedAtUtc,
    DateTime? VehicleReadyAtUtc,
    DateTime? VehicleHandedOverAtUtc,
    DateTime? ClosedAtUtc,
    DateTime CreatedAtUtc,
    IReadOnlyList<ServiceInspectionDto> Inspections,
    IReadOnlyList<ServiceJobActivityDto> Activities,
    IReadOnlyList<AdditionalWorkRequestDto> AdditionalWorkRequests
);

// ==========================================
// Operational Attention Queue DTOs
// ==========================================
public record AttentionItemDto(
    string Category,
    string Severity,
    Guid ReferenceId,
    string ReferenceNumber,
    string Title,
    string Description,
    DateTime CreatedAtUtc,
    string ActionUrl
);

public record AdminAttentionQueueDto(
    int TotalAttentionItemsCount,
    IReadOnlyList<AttentionItemDto> Items
);

// ==========================================
// Audit Log Explorer DTOs
// ==========================================
public record AdminAuditFilter(
    string? EntityName = null,
    string? EntityId = null,
    string? Action = null,
    Guid? UserId = null,
    DateTime? FromDateUtc = null,
    DateTime? ToDateUtc = null,
    int PageNumber = 1,
    int PageSize = 25
);

// ==========================================
// Notification Monitoring DTOs
// ==========================================
public record AdminNotificationFilter(
    NotificationStatus? Status = null,
    Guid? UserId = null,
    string? Search = null,
    int PageNumber = 1,
    int PageSize = 25
);

public record AdminNotificationListDto(
    Guid Id,
    Guid UserId,
    string UserEmail,
    string Title,
    string Message,
    string Type,
    string? ReferenceType,
    Guid? ReferenceId,
    bool IsRead,
    NotificationStatus Status,
    int RetryCount,
    DateTime? LastAttemptAtUtc,
    string? ErrorSummary,
    DateTime CreatedAtUtc
);

// ==========================================
// System Health DTOs
// ==========================================
public record SystemHealthDto(
    string OverallStatus,
    DateTime TimestampUtc,
    TimeSpan Uptime,
    long ProcessMemoryBytes,
    DatabaseHealthDto Database,
    PostGisHealthDto PostGis,
    RedisHealthDto Redis,
    BackgroundWorkerHealthDto BackgroundWorkers
);

public record DatabaseHealthDto(
    string Status,
    double LatencyMs,
    string? Error = null
);

public record PostGisHealthDto(
    string Status,
    string? Version = null,
    string? Error = null
);

public record RedisHealthDto(
    string Status,
    double LatencyMs,
    string? Error = null
);

public record BackgroundWorkerHealthDto(
    string Status,
    int ActiveJobsCount,
    string? Notes = null
);

// ==========================================
// Advisor Work Queue & Dashboard DTOs
// ==========================================
public record AdvisorDashboardKpiDto(
    int AssignedRequestsCount,
    int QuotesAwaitingReviewCount,
    int CustomerQuotationsPendingCount,
    int ActiveJobsOverseeingCount,
    int AdditionalWorkPendingCount,
    IReadOnlyList<AdminRequestSummaryDto> RecentAssignedRequests
);

public record AdvisorWorkQueueDto(
    IReadOnlyList<AdminRequestSummaryDto> NewRequests,
    IReadOnlyList<AdminRequestSummaryDto> QuotesToReview,
    IReadOnlyList<AdminRequestSummaryDto> CustomerQuotationsPending,
    IReadOnlyList<AdminJobListItemDto> ActiveJobs,
    IReadOnlyList<AdditionalWorkRequestDto> AdditionalWorkPending
);
