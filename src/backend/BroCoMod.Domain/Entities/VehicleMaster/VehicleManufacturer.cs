using BroCoMod.Domain.Common;

namespace BroCoMod.Domain.Entities.VehicleMaster;

public class VehicleManufacturer : BaseEntity
{
    public string Name { get; private set; } = string.Empty;
    public string NormalizedName { get; private set; } = string.Empty;
    public string Country { get; private set; } = string.Empty;
    public string LogoUrl { get; private set; } = string.Empty;
    public bool IsActive { get; private set; } = true;
    public int DisplayOrder { get; private set; } = 0;

    public ICollection<VehicleModel> Models { get; private set; } = new List<VehicleModel>();

    protected VehicleManufacturer() { }

    public VehicleManufacturer(string name, string country = "", string logoUrl = "", int displayOrder = 0)
    {
        Name = name.Trim();
        NormalizedName = Name.ToUpperInvariant();
        Country = country.Trim();
        LogoUrl = logoUrl.Trim();
        DisplayOrder = displayOrder;
        IsActive = true;
    }

    public void Update(string name, string country, string logoUrl, bool isActive, int displayOrder)
    {
        Name = name.Trim();
        NormalizedName = Name.ToUpperInvariant();
        Country = country.Trim();
        LogoUrl = logoUrl.Trim();
        IsActive = isActive;
        DisplayOrder = displayOrder;
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
