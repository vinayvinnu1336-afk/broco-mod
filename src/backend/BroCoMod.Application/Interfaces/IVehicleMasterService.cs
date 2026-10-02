using BroCoMod.Application.DTOs;

namespace BroCoMod.Application.Interfaces;

public interface IVehicleMasterService
{
    Task<IReadOnlyList<VehicleManufacturerDto>> GetManufacturersAsync(
        string? search = null,
        bool activeOnly = true,
        CancellationToken cancellationToken = default);

    Task<VehicleManufacturerDto?> GetManufacturerByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<VehicleModelDto>> GetModelsByManufacturerAsync(
        Guid manufacturerId,
        string? bodyType = null,
        bool activeOnly = true,
        CancellationToken cancellationToken = default);

    Task<VehicleModelDto?> GetModelByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<VehicleVariantDto>> GetVariantsByModelAsync(
        Guid modelId,
        bool activeOnly = true,
        CancellationToken cancellationToken = default);

    Task<VehicleVariantDto?> GetVariantByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default);

    IReadOnlyList<VehicleFuelTypeDto> GetFuelTypes();
}
