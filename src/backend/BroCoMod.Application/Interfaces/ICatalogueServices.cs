using BroCoMod.Application.DTOs;

namespace BroCoMod.Application.Interfaces;

/// <summary>Service packages, their per-model prices and vehicle catalogue administration.</summary>
public interface ICatalogueService
{
    Task<IReadOnlyList<ServicePackageDto>> GetPackagesAsync(bool activeOnly = true, CancellationToken ct = default);
    Task<PackageOffersResponse> GetPackageOffersAsync(Guid modelId, string fuelType, CancellationToken ct = default);
    Task<ServicePackageDto> UpdatePackageAsync(Guid packageId, UpdateServicePackageRequest request, CancellationToken ct = default);

    Task<ModelPriceSheetDto> GetModelPriceSheetAsync(Guid modelId, CancellationToken ct = default);
    Task<ModelPriceSheetDto> SetModelPricesAsync(Guid modelId, SetModelPricesRequest request, Guid userId, CancellationToken ct = default);
    Task<ApplySegmentPriceResult> ApplySegmentPriceAsync(ApplySegmentPriceRequest request, Guid userId, CancellationToken ct = default);

    Task<VehicleManufacturerDto> CreateManufacturerAsync(UpsertManufacturerRequest request, CancellationToken ct = default);
    Task<VehicleManufacturerDto> UpdateManufacturerAsync(Guid id, UpsertManufacturerRequest request, CancellationToken ct = default);
    Task<VehicleManufacturerDto> SetManufacturerLogoAsync(Guid id, byte[] content, string contentType, CancellationToken ct = default);
    Task<VehicleManufacturerDto> RemoveManufacturerLogoAsync(Guid id, CancellationToken ct = default);
    Task<ManufacturerLogoFile?> GetManufacturerLogoAsync(Guid id, CancellationToken ct = default);

    Task<VehicleModelDto> CreateModelAsync(Guid manufacturerId, UpsertVehicleModelRequest request, CancellationToken ct = default);
    Task<VehicleModelDto> UpdateModelAsync(Guid modelId, UpsertVehicleModelRequest request, CancellationToken ct = default);
}

/// <summary>Cities BroCo operates in and the checks that keep bookings inside them.</summary>
public interface IServiceAreaService
{
    IReadOnlyList<ServiceAreaDto> GetAreas();
    ServiceAreaDto? FindLiveAreaFor(double latitude, double longitude);
    bool IsPincodeServed(ServiceAreaDto area, string pincode);
}

public record ReverseGeocodeResult(string? Pincode, string? City, string? State, string FormattedAddress);

/// <summary>Server-side address lookup (Google Geocoding API when a server key is configured).</summary>
public interface IGeocodingService
{
    bool IsConfigured { get; }
    Task<ReverseGeocodeResult?> ReverseGeocodeAsync(double latitude, double longitude, CancellationToken ct = default);
}

public interface ILeadService
{
    Task<LeadDto> CreateAsync(CreateLeadRequest request, CancellationToken ct = default);
    Task<PagedResult<LeadDto>> GetLeadsAsync(string? status, int page, int pageSize, CancellationToken ct = default);
    Task<LeadDto> UpdateAsync(Guid id, UpdateLeadRequest request, CancellationToken ct = default);
}

/// <summary>Commission garages owe BroCo after each completed job, with reminders and settlement.</summary>
public interface ICommissionService
{
    Task<GarageCommissionDto?> CreateForJobAsync(Guid serviceJobId, CancellationToken ct = default);

    Task<IReadOnlyList<GarageCommissionDto>> GetGarageCommissionsAsync(Guid garageId, string? status, CancellationToken ct = default);
    Task<GarageCommissionSummaryDto> GetGarageSummaryAsync(Guid garageId, CancellationToken ct = default);
    Task<InitiatePaymentResponseDto> InitiateCommissionPaymentAsync(Guid garageId, Guid payerUserId, PayCommissionsRequest request, CancellationToken ct = default);
    Task SettleCommissionsForPaymentAsync(Guid paymentId, CancellationToken ct = default);

    Task<PagedResult<GarageCommissionDto>> GetAdminCommissionsAsync(string? status, Guid? garageId, int page, int pageSize, CancellationToken ct = default);
    Task<AdminCommissionOverviewDto> GetAdminOverviewAsync(CancellationToken ct = default);
    Task<GarageCommissionDto> MarkReceivedAsync(Guid commissionId, MarkCommissionReceivedRequest request, Guid adminUserId, CancellationToken ct = default);
    Task<GarageCommissionDto> WaiveAsync(Guid commissionId, WaiveCommissionRequest request, Guid adminUserId, CancellationToken ct = default);

    Task<CommissionTermsDto> GetTermsAsync(CancellationToken ct = default);
    Task<CommissionTermsDto> UpdateTermsAsync(UpdateCommissionTermsRequest request, Guid adminUserId, CancellationToken ct = default);

    Task<bool> IsGarageBlockedForNewJobsAsync(Guid garageId, CancellationToken ct = default);
    Task<int> SendDueRemindersAsync(CancellationToken ct = default);
}

/// <summary>Turns a paid package booking into a confirmed job at the chosen garage.</summary>
public interface IPackageBookingService
{
    Task<IReadOnlyList<PackageGarageCandidateDto>> GetCandidateGaragesAsync(Guid serviceRequestId, CancellationToken ct = default);
    Task<PackageAssignmentResultDto> AssignGarageAsync(Guid serviceRequestId, Guid garageId, Guid advisorUserId, string? reason, CancellationToken ct = default);
}
