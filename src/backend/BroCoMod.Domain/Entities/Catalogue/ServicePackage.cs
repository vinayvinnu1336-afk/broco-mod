using BroCoMod.Domain.Common;

namespace BroCoMod.Domain.Entities.Catalogue;

/// <summary>
/// A fixed-scope periodic service (Basic / Standard / Premium) sold at a published price per car model and fuel.
/// </summary>
public class ServicePackage : BaseEntity
{
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string Tagline { get; private set; } = string.Empty;
    public int IntervalKm { get; private set; }
    public int IntervalMonths { get; private set; }
    public decimal DurationHours { get; private set; }
    public int WarrantyKm { get; private set; }
    public int WarrantyDays { get; private set; }
    public List<string> Includes { get; private set; } = new();
    public int DisplayOrder { get; private set; }
    public bool IsActive { get; private set; } = true;
    public bool IsRecommended { get; private set; }

    public ICollection<ServicePackagePrice> Prices { get; private set; } = new List<ServicePackagePrice>();

    protected ServicePackage() { }

    public ServicePackage(string code, string name, int displayOrder)
    {
        if (string.IsNullOrWhiteSpace(code)) throw new ArgumentException("Code is required.", nameof(code));
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Name is required.", nameof(name));
        Code = code.Trim().ToUpperInvariant();
        Name = name.Trim();
        DisplayOrder = displayOrder;
    }

    public void Update(
        string name, string tagline, int intervalKm, int intervalMonths, decimal durationHours,
        int warrantyKm, int warrantyDays, IEnumerable<string> includes, int displayOrder, bool isActive, bool isRecommended)
    {
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Name is required.", nameof(name));
        Name = name.Trim();
        Tagline = tagline?.Trim() ?? string.Empty;
        IntervalKm = Math.Max(0, intervalKm);
        IntervalMonths = Math.Max(0, intervalMonths);
        DurationHours = Math.Round(Math.Max(0m, durationHours), 1);
        WarrantyKm = Math.Max(0, warrantyKm);
        WarrantyDays = Math.Max(0, warrantyDays);
        Includes = includes.Select(i => i.Trim()).Where(i => i.Length > 0).Distinct().ToList();
        DisplayOrder = displayOrder;
        IsActive = isActive;
        IsRecommended = isRecommended;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
