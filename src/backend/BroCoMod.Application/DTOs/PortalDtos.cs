namespace BroCoMod.Application.DTOs;

// ==========================================
// Customer Portal DTOs
// ==========================================
public record CustomerDashboardDto(
    Guid CustomerId,
    string CustomerName,
    int ActiveRequestsCount,
    int AvailableQuotesCount,
    int RegisteredVehiclesCount,
    IReadOnlyList<CustomerRequestSummaryDto> RecentRequests,
    IReadOnlyList<CustomerQuoteSummaryDto> PendingQuotes
);

public record CustomerProfileDto(
    Guid CustomerId,
    Guid UserId,
    string FullName,
    string Email,
    string PhoneNumber,
    string Address,
    string PreferredContactMethod
);

public record CustomerVehicleDto(
    Guid Id,
    Guid CustomerId,
    string Make,
    string Model,
    int Year,
    string LicensePlate,
    string Vin,
    int Mileage
);

public record CreateVehicleDto(
    string Make,
    string Model,
    int Year,
    string LicensePlate,
    string Vin = "",
    int Mileage = 0
);

public record CustomerRequestSummaryDto(
    Guid Id,
    string VehicleMake,
    string VehicleModel,
    int VehicleYear,
    string Description,
    string Status,
    DateTime CreatedAtUtc,
    int QuotesReceivedCount
);

public record CustomerQuoteSummaryDto(
    Guid Id,
    Guid ServiceRequestId,
    string VehicleSummary,
    decimal CustomerFacingPrice, // Sanitized retail price
    string ScopeSummary,
    string AdvisorNotes,
    string Status,
    DateTime CreatedAtUtc
);

// ==========================================
// Garage Portal DTOs
// ==========================================
public record GarageDashboardDto(
    Guid GarageId,
    string GarageName,
    int NewRequestsCount,
    int SubmittedQuotesCount,
    int ActiveJobsCount,
    IReadOnlyList<GarageRequestSummaryDto> AvailableRequests,
    IReadOnlyList<GarageQuoteSummaryDto> SubmittedQuotes
);

public record GarageProfileDto(
    Guid GarageId,
    string Name,
    string Email,
    string PhoneNumber,
    string Address,
    double Longitude,
    double Latitude,
    bool IsActive,
    IReadOnlyList<GarageUserDto> TeamMembers
);

public record GarageUserDto(
    Guid UserId,
    string FullName,
    string Email,
    string RoleName,
    string Title
);

public record GarageRequestSummaryDto(
    Guid ServiceRequestId,
    string VehicleMake,
    string VehicleModel,
    int VehicleYear,
    string Description,
    double DistanceKm,
    DateTime CreatedAtUtc,
    string Status
);

// ==========================================
// Advisor Portal DTOs
// ==========================================
public record AdvisorDashboardDto(
    Guid AdvisorId,
    string AdvisorName,
    int PendingReviewsCount,
    int ActiveRequestsCount,
    int AssignedGaragesCount,
    IReadOnlyList<AdvisorRequestSummaryDto> RequestsUnderReview,
    IReadOnlyList<AdvisorQuoteSummaryDto> PendingQuoteApprovals
);

public record AdvisorProfileDto(
    Guid AdvisorId,
    Guid UserId,
    string FullName,
    string Email,
    string EmployeeCode,
    string Specialization,
    int MaxAssignedRequests
);

public record AdvisorRequestSummaryDto(
    Guid ServiceRequestId,
    Guid CustomerId,
    string CustomerName,
    string VehicleSummary,
    string Description,
    int QuotesReceivedCount,
    string Status,
    DateTime CreatedAtUtc
);

public record AdvisorQuoteSummaryDto(
    Guid QuoteId,
    Guid ServiceRequestId,
    Guid GarageId,
    string GarageName,
    decimal GarageInternalPrice,
    string InternalCostBreakdown,
    decimal RecommendedCustomerPrice,
    string Status,
    DateTime SubmittedAtUtc
);

public record AdvisorAssignmentSummaryDto(
    Guid ServiceRequestId,
    Guid GarageId,
    string GarageName,
    decimal CustomerFacingPrice,
    string Status,
    DateTime AssignedAtUtc
);

// ==========================================
// Super Admin Portal DTOs
// ==========================================
public record AdminDashboardDto(
    int TotalUsersCount,
    int TotalCustomersCount,
    int TotalGaragesCount,
    int TotalAdvisorsCount,
    int TotalRequestsCount,
    IReadOnlyList<AdminUserSummaryDto> RecentUsers,
    IReadOnlyList<AdminAuditLogSummaryDto> RecentAuditLogs
);

public record AdminUserSummaryDto(
    Guid Id,
    string Email,
    string FullName,
    string PhoneNumber,
    IReadOnlyList<string> Roles,
    bool IsActive,
    DateTime CreatedAtUtc
);

public record AdminGarageSummaryDto(
    Guid Id,
    string Name,
    string Email,
    string PhoneNumber,
    string Address,
    bool IsActive,
    int TotalStaffCount,
    DateTime CreatedAtUtc
);

public record AdminAdvisorSummaryDto(
    Guid Id,
    string FullName,
    string Email,
    string EmployeeCode,
    string Specialization,
    bool IsActive,
    DateTime CreatedAtUtc
);

public record AdminAuditLogSummaryDto(
    Guid Id,
    string Action,
    string? UserEmail,
    string? EntityName,
    string? EntityId,
    string? Details,
    string? IpAddress,
    DateTime TimestampUtc
);

public record AdminSettingsDto(
    double DefaultSearchRadiusKm,
    double MaxSearchRadiusKm,
    int MaxFailedLoginAttempts,
    int AccountLockoutMinutes,
    int JwtExpiryMinutes,
    int RefreshTokenExpiryDays
);
