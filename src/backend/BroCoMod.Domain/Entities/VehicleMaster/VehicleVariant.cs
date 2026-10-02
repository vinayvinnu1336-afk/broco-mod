using BroCoMod.Domain.Common;
using BroCoMod.Domain.Enums;

namespace BroCoMod.Domain.Entities.VehicleMaster;

public class VehicleVariant : BaseEntity
{
    public Guid ModelId { get; private set; }
    public VehicleModel? Model { get; private set; }

    public string Name { get; private set; } = string.Empty;
    public string Transmission { get; private set; } = string.Empty; // Automatic, Manual, Dual-Clutch, Direct Drive
    public FuelType FuelType { get; private set; }
    public int? EngineDisplacementCc { get; private set; }
    public int? Horsepower { get; private set; }
    public int YearFrom { get; private set; }
    public int? YearTo { get; private set; }
    public bool IsActive { get; private set; } = true;

    protected VehicleVariant() { }

    public VehicleVariant(
        Guid modelId,
        string name,
        string transmission,
        FuelType fuelType,
        int? engineDisplacementCc = null,
        int? horsepower = null,
        int yearFrom = 2015,
        int? yearTo = null)
    {
        ModelId = modelId;
        Name = name.Trim();
        Transmission = transmission.Trim();
        FuelType = fuelType;
        EngineDisplacementCc = engineDisplacementCc;
        Horsepower = horsepower;
        YearFrom = yearFrom;
        YearTo = yearTo;
        IsActive = true;
    }

    public void Update(
        string name,
        string transmission,
        FuelType fuelType,
        int? engineDisplacementCc,
        int? horsepower,
        int yearFrom,
        int? yearTo,
        bool isActive)
    {
        Name = name.Trim();
        Transmission = transmission.Trim();
        FuelType = fuelType;
        EngineDisplacementCc = engineDisplacementCc;
        Horsepower = horsepower;
        YearFrom = yearFrom;
        YearTo = yearTo;
        IsActive = isActive;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Deactivate()
    {
        IsActive = false;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Activate()
    {
        IsActive = true;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
