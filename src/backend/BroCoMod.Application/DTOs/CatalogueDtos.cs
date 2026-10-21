using System.ComponentModel.DataAnnotations;
using BroCoMod.Application.Common;

namespace BroCoMod.Application.DTOs;

// ---------- Service packages (Basic / Standard / Premium) ----------

public record ServicePackageDto(
    Guid Id,
    string Code,
    string Name,
    string Tagline,
    int IntervalKm,
    int IntervalMonths,
    decimal DurationHours,
    int WarrantyKm,
    int WarrantyDays,
    List<string> Includes,
    int DisplayOrder,
    bool IsActive,
    bool IsRecommended
);

/// <summary>A package with its price for one car (model + fuel) and how the payment splits.</summary>
public record PackageOfferDto(
    ServicePackageDto Package,
    decimal? Price,
    decimal? AdvanceAmount,
    decimal? PayAtGarageAmount
);

public record PackageOffersResponse(
    Guid ModelId,
    string ManufacturerName,
    string ModelName,
    string FuelType,
    decimal AdvancePercentage,
    List<PackageOfferDto> Offers
);

public record PackagePriceCellDto(
    string PackageCode,
    string FuelType,
    decimal? Price
);

public record ModelPriceSheetDto(
    Guid ModelId,
    string ManufacturerName,
    string ModelName,
    string Segment,
    List<string> Fuels,
    List<PackagePriceCellDto> Prices
);

public record SetModelPricesRequest(
    [Required] List<PackagePriceCellDto> Prices
);

public record ApplySegmentPriceRequest(
    [Required] string Segment,
    [Required] string FuelType,
    [Required] string PackageCode,
    [Range(1, 1_000_000)] decimal Price,
    bool OverwriteExisting = false
);

public record ApplySegmentPriceResult(int Created, int Updated, int Skipped);

public record UpdateServicePackageRequest(
    [Required, StringLength(100, MinimumLength = 2)] string Name,
    [StringLength(300)] string? Tagline,
    [Range(0, 100_000)] int IntervalKm,
    [Range(0, 60)] int IntervalMonths,
    [Range(0, 72)] decimal DurationHours,
    [Range(0, 100_000)] int WarrantyKm,
    [Range(0, 3650)] int WarrantyDays,
    [Required] List<string> Includes,
    int DisplayOrder,
    bool IsActive,
    bool IsRecommended
);

// ---------- Vehicle catalogue administration ----------

public record UpsertManufacturerRequest(
    [Required, StringLength(100, MinimumLength = 1)] string Name,
    [StringLength(100)] string? Country,
    int DisplayOrder,
    bool IsActive = true,
    bool IsPopular = false
);

public record UpsertVehicleModelRequest(
    [Required, StringLength(100, MinimumLength = 1)] string Name,
    [Required, StringLength(50)] string BodyType,
    [Required] string Segment,
    [Required] List<string> Fuels,
    [Range(1950, 2100)] int YearFrom,
    int? YearTo,
    bool IsActive = true
);

public record ManufacturerLogoFile(byte[] Content, string ContentType, DateTime UpdatedAtUtc);

// ---------- Service areas ----------

public record ServiceAreaDto(
    string City,
    string State,
    double Latitude,
    double Longitude,
    double RadiusKm,
    bool IsLive
);

// ---------- Leads from the public website ----------

public record CreateLeadRequest(
    [Required(ErrorMessage = IndianMobile.InvalidMessage), IndianMobile] string MobileNumber,
    [Required, StringLength(100)] string City,
    Guid? VehicleModelId,
    [StringLength(30)] string? FuelType,
    [StringLength(100)] string? ServiceInterest
);

public record LeadDto(
    Guid Id,
    string MobileNumber,
    string City,
    Guid? VehicleModelId,
    string VehicleSummary,
    string? FuelType,
    string? ServiceInterest,
    string Source,
    string Status,
    string? Notes,
    DateTime CreatedAtUtc
);

public record UpdateLeadRequest(
    [Required] string Status,
    [StringLength(2000)] string? Notes
);

// ---------- Booking advance & garage commission ----------

public record InitiateAdvancePaymentRequest(
    string? IdempotencyKey
);

public record GarageCommissionDto(
    Guid Id,
    string CommissionNumber,
    Guid GarageId,
    string GarageName,
    Guid ServiceJobId,
    string JobNumber,
    Guid ServiceRequestId,
    string RequestNumber,
    string VehicleSummary,
    string Currency,
    decimal ServiceValue,
    decimal AdvanceCollectedByPlatform,
    decimal BalanceCollectedByGarage,
    decimal CommissionPercentage,
    decimal CommissionAmount,
    decimal TotalDue,
    string Status,
    DateTime DueAtUtc,
    bool IsOverdue,
    DateTime? PaidAtUtc,
    string? SettledVia,
    string? PaymentReference,
    string? WaiverReason,
    int RemindersSent,
    DateTime? LastReminderAtUtc,
    DateTime CreatedAtUtc,
    // Filled on the staff "Garage dues" lists.
    string? GaragePhone = null,
    int DaysOverdue = 0,
    bool GarageBlocked = false,
    // When staff may send the next manual reminder for this due; null = now.
    DateTime? NextManualReminderAtUtc = null
);

public record GarageCommissionSummaryDto(
    decimal OutstandingAmount,
    int OutstandingCount,
    decimal OverdueAmount,
    int OverdueCount,
    decimal PaidThisMonth,
    DateTime? OldestDueAtUtc,
    bool NewJobsBlocked
);

public record PayCommissionsRequest(
    List<Guid>? CommissionIds,
    string? IdempotencyKey
);

public record MarkCommissionReceivedRequest(
    [Required, StringLength(200, MinimumLength = 2)] string Reference,
    [StringLength(50)] string? Method
);

public record WaiveCommissionRequest(
    [Required, StringLength(1000, MinimumLength = 3)] string Reason
);

public record AdminCommissionOverviewDto(
    decimal OutstandingAmount,
    int OutstandingCount,
    decimal OverdueAmount,
    int OverdueCount,
    decimal CollectedAmount,
    int GaragesWithOverdue,
    int GaragesWithDues = 0,
    int GaragesBlocked = 0
);

/// <summary>Filters for the staff "Garage dues" lists (admin and advisor portals).</summary>
public record CommissionDuesQuery(
    string? Search = null,
    // Due (default), Overdue, Paid, Waived or All.
    string? Status = null,
    Guid? GarageId = null,
    DateTime? DueFrom = null,
    DateTime? DueTo = null,
    // due (oldest first, default), garage, amount or reminded (least recently reminded first).
    string? Sort = null,
    int Page = 1,
    int PageSize = 20,
    // The garage's city; advisors are always limited to their own.
    string? City = null
);

/// <summary>Unpaid commission totals for staff; advisors see this without the collected revenue.</summary>
public record GarageDuesOverviewDto(
    decimal OutstandingAmount,
    int OutstandingCount,
    decimal OverdueAmount,
    int OverdueCount,
    int GaragesWithDues,
    int GaragesWithOverdue,
    int GaragesBlocked
);

/// <summary>One garage's unpaid commission, for the garage filter and the grouped view.</summary>
public record GarageDuesSummaryDto(
    Guid GarageId,
    string GarageName,
    string GaragePhone,
    decimal OutstandingAmount,
    int OutstandingCount,
    decimal OverdueAmount,
    int OverdueCount,
    DateTime? OldestDueAtUtc,
    bool NewJobsBlocked,
    DateTime? LastReminderAtUtc
);

public record RemindOverdueCommissionsRequest(
    // Only this garage's overdue dues; null = every garage.
    Guid? GarageId
);

public record CommissionReminderResultDto(
    bool Sent,
    string Message,
    GarageCommissionDto Commission,
    // When not sent: "TooSoon" (reminded in the last hour) or "NoRecipients" (garage has no active users).
    string? NotSentReason = null
);

public static class ReminderNotSent
{
    public const string TooSoon = "TooSoon";
    public const string NoRecipients = "NoRecipients";
}

public record BulkCommissionReminderResultDto(
    int DuesReminded,
    int GaragesReminded,
    // Overdue dues left out because staff already reminded them in the last hour.
    int SkippedRecentlyReminded
);

public record AssignPackageGarageRequest(
    [Required] Guid GarageId,
    [StringLength(1000)] string? Reason
);

public record PackageAssignmentResultDto(
    Guid ServiceRequestId,
    Guid GarageId,
    string GarageName,
    Guid ServiceJobId,
    string JobNumber,
    Guid CustomerQuotationId,
    decimal PackagePrice
);

public record PackageGarageCandidateDto(
    Guid GarageId,
    string Name,
    string Address,
    string PhoneNumber,
    double DistanceKm,
    bool IsBlocked
);

/// <summary>What BroCo charges garages per completed job, and the advance customers pay online.</summary>
public record CommissionTermsDto(
    decimal CommissionPercentage,
    decimal BookingAdvancePercentage
);

public record UpdateCommissionTermsRequest(
    [Range(0, 50)] decimal CommissionPercentage
);
