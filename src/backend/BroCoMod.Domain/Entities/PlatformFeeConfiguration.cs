using BroCoMod.Domain.Common;

namespace BroCoMod.Domain.Entities;

/// <summary>
/// Configurable platform fee policy applied at transaction time.
/// Avoids hardcoding commission rates in application code.
/// </summary>
public class PlatformFeeConfiguration : BaseEntity
{
    public string Name { get; private set; } = string.Empty;
    public decimal FeePercentage { get; private set; }
    public decimal FixedFee { get; private set; }
    public decimal TaxPercentage { get; private set; } = 18.0m; // Default GST on service commission
    public bool IsActive { get; private set; } = true;
    public DateTime EffectiveFromUtc { get; private set; } = DateTime.UtcNow;
    public DateTime? EffectiveToUtc { get; private set; }

    protected PlatformFeeConfiguration() { }

    public PlatformFeeConfiguration(
        string name,
        decimal feePercentage,
        decimal fixedFee = 0.0m,
        decimal taxPercentage = 18.0m,
        bool isActive = true,
        DateTime? effectiveFromUtc = null,
        DateTime? effectiveToUtc = null)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Name cannot be empty.", nameof(name));

        Name = name.Trim();
        FeePercentage = Math.Max(0m, feePercentage);
        FixedFee = Math.Max(0m, fixedFee);
        TaxPercentage = Math.Max(0m, taxPercentage);
        IsActive = isActive;
        EffectiveFromUtc = effectiveFromUtc ?? DateTime.UtcNow;
        EffectiveToUtc = effectiveToUtc;
    }

    public void Deactivate()
    {
        IsActive = false;
        EffectiveToUtc = DateTime.UtcNow;
    }

    public void UpdateTerms(decimal feePercentage, decimal fixedFee, decimal taxPercentage)
    {
        FeePercentage = Math.Max(0m, feePercentage);
        FixedFee = Math.Max(0m, fixedFee);
        TaxPercentage = Math.Max(0m, taxPercentage);
    }
}
