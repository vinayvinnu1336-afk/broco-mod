using System.ComponentModel.DataAnnotations;
using BroCoMod.Application.Common;

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

/// <summary>
/// What a customer can change about themselves. Email is the login and stays read-only.
/// A null Address or an empty PreferredContactMethod keeps the current value.
/// </summary>
public record UpdateCustomerProfileRequest(
    [Required(ErrorMessage = "Enter your full name."), StringLength(100, MinimumLength = 2, ErrorMessage = "Name must be 2 to 100 characters.")] string FullName,
    [Required(ErrorMessage = IndianMobile.InvalidMessage), IndianMobile] string PhoneNumber,
    [StringLength(500, ErrorMessage = "Address must be 500 characters or fewer.")] string? Address = null,
    string? PreferredContactMethod = null
) : IValidatableObject
{
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if ((FullName ?? string.Empty).Trim().Length < 2)
            yield return new ValidationResult("Name must be 2 to 100 characters.", new[] { nameof(FullName) });
        if (!string.IsNullOrWhiteSpace(PreferredContactMethod) && ContactMethods.Normalize(PreferredContactMethod) == null)
            yield return new ValidationResult(
                $"Preferred contact must be one of: {string.Join(", ", ContactMethods.All)}.",
                new[] { nameof(PreferredContactMethod) });
    }
}

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
    IReadOnlyList<GarageUserDto> TeamMembers,
    // Read-only for the garage: only admins verify, suspend or reactivate a garage.
    string Status = "",
    bool IsVerified = false,
    DateTime? UpdatedAtUtc = null
);

/// <summary>
/// What a garage owner or manager can change about their garage. Leave Latitude and Longitude null to keep the
/// current workshop pin; a new pin must be inside a live service area. YourFullName (optional) renames the
/// signed-in user, as shown in the team list.
/// </summary>
public record UpdateGarageProfileRequest(
    [Required(ErrorMessage = "Enter the garage name."), StringLength(120, ErrorMessage = "Garage name must be 2 to 120 characters.")] string Name,
    [Required(ErrorMessage = IndianMobile.InvalidMessage), IndianMobile] string PhoneNumber,
    [Required(ErrorMessage = "Enter the garage email."), EmailAddress(ErrorMessage = "Enter a valid email address."), StringLength(200, ErrorMessage = "Email must be 200 characters or fewer.")] string Email,
    [Required(ErrorMessage = "Enter the workshop address."), StringLength(500, ErrorMessage = "Address must be 500 characters or fewer.")] string Address,
    double? Latitude = null,
    double? Longitude = null,
    [StringLength(100, ErrorMessage = "Your name must be 2 to 100 characters.")] string? YourFullName = null
) : IValidatableObject
{
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if ((Name ?? string.Empty).Trim().Length < 2)
            yield return new ValidationResult("Garage name must be 2 to 120 characters.", new[] { nameof(Name) });
        if ((Address ?? string.Empty).Trim().Length < 5)
            yield return new ValidationResult("Enter the workshop address.", new[] { nameof(Address) });
        if (Latitude.HasValue != Longitude.HasValue)
            yield return new ValidationResult("Send both latitude and longitude for the workshop pin.", new[] { nameof(Latitude) });
        else if (Latitude is { } lat && Longitude is { } lng &&
                 (lat is < -90 or > 90 || lng is < -180 or > 180 || (lat == 0 && lng == 0)))
            yield return new ValidationResult("The workshop pin is not a valid location.", new[] { nameof(Latitude) });
        if (YourFullName != null && YourFullName.Trim().Length < 2)
            yield return new ValidationResult("Your name must be 2 to 100 characters.", new[] { nameof(YourFullName) });
    }
}

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
