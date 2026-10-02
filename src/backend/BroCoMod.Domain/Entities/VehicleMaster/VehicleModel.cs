using BroCoMod.Domain.Common;

namespace BroCoMod.Domain.Entities.VehicleMaster;

public class VehicleModel : BaseEntity
{
    public Guid ManufacturerId { get; private set; }
    public VehicleManufacturer? Manufacturer { get; private set; }

    public string Name { get; private set; } = string.Empty;
    public string NormalizedName { get; private set; } = string.Empty;
    public string BodyType { get; private set; } = string.Empty; // Sedan, SUV, Coupe, Hatchback, Wagon, Convertible
    public int YearFrom { get; private set; }
    public int? YearTo { get; private set; }
    public bool IsActive { get; private set; } = true;

    public ICollection<VehicleVariant> Variants { get; private set; } = new List<VehicleVariant>();

    protected VehicleModel() { }

    public VehicleModel(Guid manufacturerId, string name, string bodyType, int yearFrom, int? yearTo = null)
    {
        ManufacturerId = manufacturerId;
        Name = name.Trim();
        NormalizedName = Name.ToUpperInvariant();
        BodyType = bodyType.Trim();
        YearFrom = yearFrom;
        YearTo = yearTo;
        IsActive = true;
    }

    public void Update(string name, string bodyType, int yearFrom, int? yearTo, bool isActive)
    {
        Name = name.Trim();
        NormalizedName = Name.ToUpperInvariant();
        BodyType = bodyType.Trim();
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
