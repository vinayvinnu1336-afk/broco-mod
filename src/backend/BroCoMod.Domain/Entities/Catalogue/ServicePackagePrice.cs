using BroCoMod.Domain.Common;
using BroCoMod.Domain.Entities.VehicleMaster;
using BroCoMod.Domain.Enums;

namespace BroCoMod.Domain.Entities.Catalogue;

/// <summary>
/// Customer price of a service package for one car model and fuel type.
/// </summary>
public class ServicePackagePrice : BaseEntity
{
    public Guid ServicePackageId { get; private set; }
    public Guid VehicleModelId { get; private set; }
    public FuelType FuelType { get; private set; }
    public decimal Price { get; private set; }
    public Guid? UpdatedByUserId { get; private set; }

    public ServicePackage? ServicePackage { get; private set; }
    public VehicleModel? VehicleModel { get; private set; }

    protected ServicePackagePrice() { }

    public ServicePackagePrice(Guid servicePackageId, Guid vehicleModelId, FuelType fuelType, decimal price, Guid? updatedByUserId = null)
    {
        if (servicePackageId == Guid.Empty) throw new ArgumentException("Package is required.", nameof(servicePackageId));
        if (vehicleModelId == Guid.Empty) throw new ArgumentException("Model is required.", nameof(vehicleModelId));
        ServicePackageId = servicePackageId;
        VehicleModelId = vehicleModelId;
        FuelType = fuelType;
        SetPrice(price, updatedByUserId);
    }

    public void SetPrice(decimal price, Guid? updatedByUserId)
    {
        if (price <= 0) throw new ArgumentException("Price must be greater than zero.", nameof(price));
        Price = decimal.Round(price, 2);
        UpdatedByUserId = updatedByUserId;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
