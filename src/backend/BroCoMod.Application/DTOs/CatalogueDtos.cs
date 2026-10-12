using System.ComponentModel.DataAnnotations;

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
    [Required, RegularExpression(@"^(\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$", ErrorMessage = "Enter a valid 10-digit Indian mobile number.")] string MobileNumber,
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
    decimal TaxPercentage,
    decimal TaxAmount,
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
    DateTime CreatedAtUtc
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
    int GaragesWithOverdue
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
    decimal GstPercentage,
    decimal BookingAdvancePercentage
);

public record UpdateCommissionTermsRequest(
    [Range(0, 50)] decimal CommissionPercentage,
    [Range(0, 28)] decimal GstPercentage
);
