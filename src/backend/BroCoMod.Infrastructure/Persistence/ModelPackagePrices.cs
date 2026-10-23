using System.Text.Json;
using BroCoMod.Domain.Enums;

namespace BroCoMod.Infrastructure.Persistence;

/// <summary>
/// Per-model Basic / Standard / Premium prices from the embedded SeedData/package-prices-by-model.json
/// (GoMechanic Hyderabad + ₹350). They take precedence over the per-segment defaults in service-packages.json.
/// </summary>
public static class ModelPackagePrices
{
    public const string FileName = "package-prices-by-model.json";

    public sealed record Entry(string Brand, string Model, string Fuel, decimal? Basic, decimal? Standard, decimal? Premium, string? Basis);

    private sealed record PricesFile(List<Entry> Prices);

    private static readonly Lazy<IReadOnlyList<Entry>> All = new(Load);

    public static IReadOnlyList<Entry> Entries => All.Value;

    /// <summary>Package code → price for a brand, model and fuel, or null when the file has no row for it.</summary>
    public static IReadOnlyDictionary<string, decimal>? For(string brand, string model, FuelType fuel)
    {
        var entry = Entries.FirstOrDefault(e =>
            string.Equals(e.Brand.Trim(), brand.Trim(), StringComparison.OrdinalIgnoreCase) &&
            string.Equals(e.Model.Trim(), model.Trim(), StringComparison.OrdinalIgnoreCase) &&
            Enum.TryParse<FuelType>(e.Fuel, true, out var f) && f == fuel);
        return entry == null ? null : PricesOf(entry);
    }

    public static IReadOnlyDictionary<string, decimal> PricesOf(Entry entry)
    {
        var prices = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        if (entry.Basic is > 0) prices["BASIC"] = entry.Basic.Value;
        if (entry.Standard is > 0) prices["STANDARD"] = entry.Standard.Value;
        if (entry.Premium is > 0) prices["PREMIUM"] = entry.Premium.Value;
        return prices;
    }

    private static IReadOnlyList<Entry> Load()
    {
        var assembly = typeof(ModelPackagePrices).Assembly;
        var resource = assembly.GetManifestResourceNames().FirstOrDefault(n => n.EndsWith(FileName, StringComparison.OrdinalIgnoreCase));
        if (resource == null) return Array.Empty<Entry>();
        using var stream = assembly.GetManifestResourceStream(resource)!;
        var file = JsonSerializer.Deserialize<PricesFile>(stream, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        return file?.Prices ?? new List<Entry>();
    }
}
