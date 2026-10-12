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

    /// <summary>Pricing segment: Hatchback, Sedan, CompactSUV, SUV or Luxury.</summary>
    public string Segment { get; private set; } = "Hatchback";

    /// <summary>Fuel types the model was sold with (FuelType enum names).</summary>
    public List<string> Fuels { get; private set; } = new();

    public static readonly string[] Segments = { "Hatchback", "Sedan", "CompactSUV", "SUV", "Luxury" };

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

    public void SetCatalogueDetails(string segment, IEnumerable<string> fuels)
    {
        var normalizedSegment = Segments.FirstOrDefault(s => string.Equals(s, segment?.Trim(), StringComparison.OrdinalIgnoreCase))
            ?? throw new ArgumentException($"Segment must be one of: {string.Join(", ", Segments)}.", nameof(segment));
        var fuelNames = fuels
            .Select(f => Enum.TryParse<Enums.FuelType>(f?.Trim(), true, out var parsed) ? parsed.ToString() : null)
            .Where(f => f != null)
            .Select(f => f!)
            .Distinct()
            .ToList();
        if (fuelNames.Count == 0)
            throw new ArgumentException("At least one valid fuel type is required.", nameof(fuels));

        Segment = normalizedSegment;
        Fuels = fuelNames;
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
