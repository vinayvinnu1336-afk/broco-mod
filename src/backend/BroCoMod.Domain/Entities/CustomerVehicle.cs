using BroCoMod.Domain.Common;
using BroCoMod.Domain.Entities.VehicleMaster;
using BroCoMod.Domain.Enums;

namespace BroCoMod.Domain.Entities;

public class CustomerVehicle : BaseEntity
{
    public Guid CustomerId { get; private set; }

    // Vehicle Master Relationships
    public Guid ManufacturerId { get; private set; }
    public VehicleManufacturer? Manufacturer { get; private set; }

    public Guid ModelId { get; private set; }
    public VehicleModel? ModelEntity { get; private set; }

    public Guid? VariantId { get; private set; }
    public VehicleVariant? Variant { get; private set; }

    // Denormalized strings for display and reporting
    public string Make { get; private set; } = string.Empty;
    public string Model { get; private set; } = string.Empty;
    public string VariantName { get; private set; } = string.Empty;

    public int Year { get; private set; }
    public FuelType FuelType { get; private set; } = FuelType.Petrol;
    public string Transmission { get; private set; } = "Automatic";
    public string LicensePlate { get; private set; } = string.Empty;
    public string Vin { get; private set; } = string.Empty;
    public int Mileage { get; private set; }
    public string Color { get; private set; } = string.Empty;

    public bool IsPrimary { get; private set; } = false;
    public bool IsActive { get; private set; } = true;

    protected CustomerVehicle() { }

    // Full constructor with vehicle master hierarchy
    public CustomerVehicle(
        Guid customerId,
        Guid manufacturerId,
        string make,
        Guid modelId,
        string model,
        Guid? variantId,
        string variantName,
        int year,
        FuelType fuelType,
        string transmission,
        string licensePlate,
        string vin = "",
        int mileage = 0,
        string color = "",
        bool isPrimary = false)
    {
        CustomerId = customerId;
        ManufacturerId = manufacturerId;
        Make = make.Trim();
        ModelId = modelId;
        Model = model.Trim();
        VariantId = variantId;
        VariantName = variantName.Trim();
        Year = year;
        FuelType = fuelType;
        Transmission = string.IsNullOrWhiteSpace(transmission) ? "Automatic" : transmission.Trim();
        LicensePlate = licensePlate.Trim().ToUpperInvariant();
        Vin = vin.Trim().ToUpperInvariant();
        Mileage = mileage;
        Color = color.Trim();
        IsPrimary = isPrimary;
        IsActive = true;
    }

    // Convenience constructor for legacy/simple initialization
    public CustomerVehicle(
        Guid customerId,
        string make,
        string model,
        int year,
        string licensePlate,
        string vin = "",
        int mileage = 0)
    {
        CustomerId = customerId;
        Make = make.Trim();
        Model = model.Trim();
        Year = year;
        LicensePlate = licensePlate.Trim().ToUpperInvariant();
        Vin = vin.Trim().ToUpperInvariant();
        Mileage = mileage;
        FuelType = FuelType.Petrol;
        Transmission = "Automatic";
        IsActive = true;
    }

    public void UpdateDetails(
        Guid manufacturerId,
        string make,
        Guid modelId,
        string model,
        Guid? variantId,
        string variantName,
        int year,
        FuelType fuelType,
        string transmission,
        string licensePlate,
        string vin,
        int mileage,
        string color,
        bool isPrimary)
    {
        ManufacturerId = manufacturerId;
        Make = make.Trim();
        ModelId = modelId;
        Model = model.Trim();
        VariantId = variantId;
        VariantName = variantName.Trim();
        Year = year;
        FuelType = fuelType;
        Transmission = string.IsNullOrWhiteSpace(transmission) ? "Automatic" : transmission.Trim();
        LicensePlate = licensePlate.Trim().ToUpperInvariant();
        Vin = vin.Trim().ToUpperInvariant();
        Mileage = mileage;
        Color = color.Trim();
        IsPrimary = isPrimary;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void UpdateMileage(int mileage)
    {
        Mileage = mileage;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void SetPrimary(bool isPrimary)
    {
        IsPrimary = isPrimary;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Deactivate()
    {
        IsActive = false;
        IsPrimary = false; // A deactivated vehicle cannot be primary
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Activate()
    {
        IsActive = true;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
