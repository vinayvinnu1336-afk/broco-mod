using System.Reflection;
using System.Text.Json;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Entities.Catalogue;
using BroCoMod.Domain.Entities.VehicleMaster;
using BroCoMod.Domain.Enums;
using BroCoMod.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BroCoMod.Infrastructure.Persistence;

/// <summary>
/// Loads the Indian car catalogue (brands, models, fuels, pricing segments, logos) and the
/// Basic / Standard / Premium packages with default prices from the embedded SeedData JSON.
/// Idempotent and conservative: it adds what is missing and never overwrites admin edits.
/// </summary>
public class CatalogueSeeder
{
    private static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };

    private readonly ApplicationDbContext _context;
    private readonly ICacheService _cache;
    private readonly ILogger _logger;

    public CatalogueSeeder(ApplicationDbContext context, ICacheService cache, ILogger logger)
    {
        _context = context;
        _cache = cache;
        _logger = logger;
    }

    private sealed record CatalogueFile(List<BrandSeed> Brands);
    private sealed record BrandSeed(string Name, string Slug, string Country, bool Popular, string Logo, List<ModelSeed> Models);
    private sealed record ModelSeed(string Name, string BodyType, string Segment, List<string> Fuels, int YearFrom, int? YearTo);
    private sealed record PackagesFile(List<PackageSeed> Packages, Dictionary<string, Dictionary<string, Dictionary<string, decimal>>> Prices);
    private sealed record PackageSeed(string Code, string Name, string Tagline, int IntervalKm, int IntervalMonths, decimal DurationHours,
        int WarrantyKm, int WarrantyDays, List<string> Includes);

    public async Task SeedAsync(CancellationToken ct = default)
    {
        var catalogue = Load<CatalogueFile>("vehicle-catalogue.json");
        var packages = Load<PackagesFile>("service-packages.json");
        if (catalogue == null || packages == null)
        {
            _logger.LogWarning("Catalogue seed files are missing; skipping catalogue seeding.");
            return;
        }

        var newlyDetailedModels = await SeedVehiclesAsync(catalogue, ct);
        var logos = new Dictionary<string, string>();
        foreach (var brand in catalogue.Brands) logos[brand.Name] = brand.Logo ?? string.Empty;
        await SyncBundledLogosAsync(logos, ct);
        await SeedPackagesAndPricesAsync(packages, newlyDetailedModels, ct);
    }

    /// <summary>
    /// Points brands at the logo file bundled for them (keyed by brand name) when they have no logo yet or still show
    /// another bundled file, so existing databases pick up new or replaced files in /public/brands. A logo an admin
    /// uploaded (served from /api/v1/vehicle-manufacturers/{id}/logo) is never replaced.
    /// </summary>
    public async Task<int> SyncBundledLogosAsync(IReadOnlyDictionary<string, string> logosByBrand, CancellationToken ct = default)
    {
        var wanted = new Dictionary<string, string>();
        foreach (var (brand, logo) in logosByBrand)
        {
            if (!string.IsNullOrWhiteSpace(logo)) wanted[brand.Trim().ToUpperInvariant()] = logo.Trim();
        }
        if (wanted.Count == 0) return 0;

        var names = wanted.Keys.ToList();
        var manufacturers = await _context.VehicleManufacturers.Where(m => names.Contains(m.NormalizedName)).ToListAsync(ct);
        var ids = manufacturers.Select(m => m.Id).ToList();
        var uploaded = (await _context.VehicleManufacturerLogos.AsNoTracking()
                .Where(l => ids.Contains(l.ManufacturerId))
                .Select(l => l.ManufacturerId)
                .ToListAsync(ct))
            .ToHashSet();

        var updated = 0;
        foreach (var manufacturer in manufacturers)
        {
            var logo = wanted[manufacturer.NormalizedName];
            if (manufacturer.LogoUrl == logo || uploaded.Contains(manufacturer.Id) || !IsBundledOrMissing(manufacturer.LogoUrl)) continue;
            manufacturer.SetLogoUrl(logo);
            updated++;
        }
        if (updated == 0) return 0;

        await _context.SaveChangesAsync(ct);
        await VehicleMasterService.InvalidateCatalogCacheAsync(_cache, cancellationToken: ct);
        _logger.LogInformation("Vehicle catalogue: updated {Count} brand logos.", updated);
        return updated;
    }

    // Empty, the bundled /brands/ files or the old /logos/ placeholders; anything else was set by an admin.
    private static bool IsBundledOrMissing(string logoUrl) =>
        string.IsNullOrWhiteSpace(logoUrl)
        || logoUrl.StartsWith("/brands/", StringComparison.Ordinal)
        || logoUrl.StartsWith("/logos/", StringComparison.Ordinal);

    private async Task<HashSet<Guid>> SeedVehiclesAsync(CatalogueFile file, CancellationToken ct)
    {
        var detailed = new HashSet<Guid>();
        var manufacturers = await _context.VehicleManufacturers.Include(m => m.Models).ToListAsync(ct);
        int addedBrands = 0, addedModels = 0;

        for (var i = 0; i < file.Brands.Count; i++)
        {
            var seed = file.Brands[i];
            var normalized = seed.Name.Trim().ToUpperInvariant();
            var manufacturer = manufacturers.FirstOrDefault(m => m.NormalizedName == normalized);
            if (manufacturer == null)
            {
                manufacturer = new VehicleManufacturer(seed.Name, seed.Country, seed.Logo ?? string.Empty, i + 1);
                manufacturer.SetPopular(seed.Popular);
                _context.VehicleManufacturers.Add(manufacturer);
                manufacturers.Add(manufacturer);
                addedBrands++;
            }
            else if (string.IsNullOrWhiteSpace(manufacturer.LogoUrl) || manufacturer.LogoUrl.StartsWith("/logos/", StringComparison.Ordinal))
            {
                // Not curated by an admin yet (no logo, or the old placeholder path): take the seed's look and order.
                manufacturer.Update(manufacturer.Name, string.IsNullOrWhiteSpace(manufacturer.Country) ? seed.Country : manufacturer.Country,
                    seed.Logo ?? string.Empty, manufacturer.IsActive, i + 1);
                manufacturer.SetPopular(seed.Popular);
            }

            foreach (var modelSeed in seed.Models)
            {
                var modelNormalized = modelSeed.Name.Trim().ToUpperInvariant();
                var model = manufacturer.Models.FirstOrDefault(m => m.NormalizedName == modelNormalized);
                if (model == null)
                {
                    model = new VehicleModel(manufacturer.Id, modelSeed.Name, modelSeed.BodyType, modelSeed.YearFrom, modelSeed.YearTo);
                    model.SetCatalogueDetails(modelSeed.Segment, modelSeed.Fuels);
                    _context.VehicleModels.Add(model);
                    manufacturer.Models.Add(model);
                    detailed.Add(model.Id);
                    addedModels++;
                }
                else if (model.Fuels.Count == 0)
                {
                    model.SetCatalogueDetails(modelSeed.Segment, modelSeed.Fuels);
                    detailed.Add(model.Id);
                }
            }
        }

        // Models that exist only in older seed data: infer segment and fuels so they can be priced.
        var luxuryBrands = file.Brands
            .Where(b => b.Models.Count > 0 && b.Models.Count(m => m.Segment == "Luxury") * 2 > b.Models.Count)
            .Select(b => b.Name.Trim().ToUpperInvariant())
            .ToHashSet();
        var undetailed = manufacturers.SelectMany(m => m.Models.Select(model => (Brand: m, Model: model))).Where(x => x.Model.Fuels.Count == 0).ToList();
        if (undetailed.Count > 0)
        {
            var modelIds = undetailed.Select(x => x.Model.Id).ToList();
            var variantFuels = await _context.VehicleVariants.AsNoTracking()
                .Where(v => modelIds.Contains(v.ModelId))
                .Select(v => new { v.ModelId, v.FuelType })
                .ToListAsync(ct);
            foreach (var (brand, model) in undetailed)
            {
                var segment = luxuryBrands.Contains(brand.NormalizedName) ? "Luxury" : model.BodyType switch
                {
                    "SUV" or "MUV" => "SUV",
                    "Sedan" or "Coupe" or "Convertible" or "Wagon" => "Sedan",
                    _ => "Hatchback"
                };
                var fuels = variantFuels.Where(v => v.ModelId == model.Id)
                    .Select(v => v.FuelType == FuelType.PlugInHybrid ? FuelType.Hybrid : v.FuelType == FuelType.LPG ? FuelType.CNG : v.FuelType)
                    .Select(f => f.ToString())
                    .Distinct()
                    .ToList();
                model.SetCatalogueDetails(segment, fuels.Count > 0 ? fuels : new List<string> { "Petrol", "Diesel" });
                detailed.Add(model.Id);
            }
        }

        await _context.SaveChangesAsync(ct);
        await VehicleMasterService.InvalidateCatalogCacheAsync(_cache, cancellationToken: ct);
        if (addedBrands + addedModels > 0)
            _logger.LogInformation("Vehicle catalogue: added {Brands} brands and {Models} models.", addedBrands, addedModels);
        return detailed;
    }

    private async Task SeedPackagesAndPricesAsync(PackagesFile file, HashSet<Guid> newlyDetailedModels, CancellationToken ct)
    {
        var existing = await _context.ServicePackages.ToListAsync(ct);
        for (var i = 0; i < file.Packages.Count; i++)
        {
            var seed = file.Packages[i];
            if (existing.Any(p => p.Code == seed.Code.ToUpperInvariant())) continue;
            var package = new ServicePackage(seed.Code, seed.Name, i + 1);
            package.Update(seed.Name, seed.Tagline, seed.IntervalKm, seed.IntervalMonths, seed.DurationHours, seed.WarrantyKm,
                seed.WarrantyDays, seed.Includes, i + 1, isActive: true, isRecommended: seed.Code.Equals("STANDARD", StringComparison.OrdinalIgnoreCase));
            _context.ServicePackages.Add(package);
            existing.Add(package);
        }
        await _context.SaveChangesAsync(ct);

        // Default prices: everything on first run, afterwards only models the import just added or filled in.
        var firstRun = !await _context.ServicePackagePrices.AnyAsync(ct);
        var models = await _context.VehicleModels.AsNoTracking()
            .Where(m => m.IsActive)
            .Select(m => new { m.Id, m.Name, Brand = m.Manufacturer!.Name, m.Segment, m.Fuels })
            .ToListAsync(ct);
        if (!firstRun) models = models.Where(m => newlyDetailedModels.Contains(m.Id)).ToList();
        if (models.Count == 0) return;

        var ids = models.Select(m => m.Id).ToList();
        var priced = (await _context.ServicePackagePrices.AsNoTracking()
                .Where(p => ids.Contains(p.VehicleModelId))
                .Select(p => new { p.VehicleModelId, p.ServicePackageId, p.FuelType })
                .ToListAsync(ct))
            .Select(p => (p.VehicleModelId, p.ServicePackageId, p.FuelType))
            .ToHashSet();

        var added = 0;
        foreach (var model in models)
        {
            file.Prices.TryGetValue(model.Segment, out var byFuel);
            foreach (var fuelName in model.Fuels)
            {
                if (!Enum.TryParse<FuelType>(fuelName, out var fuel)) continue;
                // This model's own price (GoMechanic + ₹350) when listed, else the segment default.
                IReadOnlyDictionary<string, decimal>? byPackage = ModelPackagePrices.For(model.Brand, model.Name, fuel);
                if (byPackage == null && byFuel != null && byFuel.TryGetValue(fuelName, out var segmentPrices)) byPackage = segmentPrices;
                if (byPackage == null) continue;
                foreach (var package in existing)
                {
                    if (!byPackage.TryGetValue(package.Code, out var price) || price <= 0) continue;
                    if (priced.Contains((model.Id, package.Id, fuel))) continue;
                    _context.ServicePackagePrices.Add(new ServicePackagePrice(package.Id, model.Id, fuel, price));
                    added++;
                }
            }
        }

        await _context.SaveChangesAsync(ct);
        if (added > 0) _logger.LogInformation("Service packages: added {Count} default prices.", added);
    }

    private T? Load<T>(string fileName) where T : class
    {
        var assembly = typeof(CatalogueSeeder).Assembly;
        var resource = assembly.GetManifestResourceNames().FirstOrDefault(n => n.EndsWith(fileName, StringComparison.OrdinalIgnoreCase));
        if (resource == null) return null;
        using var stream = assembly.GetManifestResourceStream(resource)!;
        return JsonSerializer.Deserialize<T>(stream, Json);
    }
}
