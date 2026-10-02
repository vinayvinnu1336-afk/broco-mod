using BroCoMod.Application.DTOs;

namespace BroCoMod.Application.Interfaces;

public interface ICustomerVehicleService
{
    Task<IReadOnlyList<CustomerVehicleDetailDto>> GetCustomerVehiclesAsync(
        Guid customerId,
        CancellationToken cancellationToken = default);

    Task<CustomerVehicleDetailDto?> GetCustomerVehicleByIdAsync(
        Guid customerId,
        Guid vehicleId,
        CancellationToken cancellationToken = default);

    Task<CustomerVehicleDetailDto> AddVehicleAsync(
        Guid customerId,
        CreateCustomerVehicleRequest request,
        CancellationToken cancellationToken = default);

    Task<CustomerVehicleDetailDto> UpdateVehicleAsync(
        Guid customerId,
        Guid vehicleId,
        UpdateCustomerVehicleRequest request,
        CancellationToken cancellationToken = default);

    Task<bool> DeleteVehicleAsync(
        Guid customerId,
        Guid vehicleId,
        CancellationToken cancellationToken = default);

    Task<bool> SetPrimaryVehicleAsync(
        Guid customerId,
        Guid vehicleId,
        CancellationToken cancellationToken = default);
}
