using System.Text;
using System.Text.RegularExpressions;
using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Entities.Catalogue;
using BroCoMod.Domain.Entities.VehicleMaster;
using BroCoMod.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace BroCoMod.Infrastructure.Services;

public class CatalogueService : ICatalogueService
{
    public const int MaxLogoBytes = 512 * 1024;

    private static readonly HashSet<string> AllowedLogoTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/png", "image/jpeg", "image/webp", "image/svg+xml"
    };

    private static readonly Regex UnsafeSvg = new(
        @"<\s*script|<\s*foreignObject|\bon[a-z]+\s*=|javascript:|<\s*iframe|<\s*embed|<\s*object",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private readonly IApplicationDbContext _context;
    private readonly ICacheService _cache;
    private readonly decimal _advancePercentage;

    public CatalogueService(IApplicationDbContext context, ICacheService cache, IConfiguration configuration)
    {
        _context = context;
        _cache = cache;
        _advancePercentage = BookingAdvance.Percentage(configuration);
    }

    // ---------------- Packages ----------------

    public async Task<IReadOnlyList<ServicePackageDto>> GetPackagesAsync(bool activeOnly = true, CancellationToken ct = default)
    {
        var query = _context.ServicePackages.AsNoTracking();
        if (activeOnly) query = query.Where(p => p.IsActive);
        var packages = await query.OrderBy(p => p.DisplayOrder).ThenBy(p => p.Name).ToListAsync(ct);
        return packages.Select(ToDto).ToList();
    }

    public async Task<PackageOffersResponse> GetPackageOffersAsync(Guid modelId, string fuelType, CancellationToken ct = default)
    {
        var fuel = ParseFuel(fuelType);
        var model = await _context.VehicleModels.AsNoTracking()
            .Include(m => m.Manufacturer)
            .FirstOrDefaultAsync(m => m.Id == modelId && m.IsActive, ct)
            ?? throw new KeyNotFoundException("Car model not found.");

        var packages = await _context.ServicePackages.AsNoTracking()
            .Where(p => p.IsActive)
            .OrderBy(p => p.DisplayOrder)
            .ToListAsync(ct);

        var prices = await _context.ServicePackagePrices.AsNoTracking()
            .Where(p => p.VehicleModelId == modelId && p.FuelType == fuel)
            .ToDictionaryAsync(p => p.ServicePackageId, p => p.Price, ct);

        var offers = packages.Select(p =>
        {
            decimal? price = prices.TryGetValue(p.Id, out var value) ? value : null;
            var advance = price.HasValue ? BookingAdvance.Amount(price.Value, _advancePercentage) : (decimal?)null;
            return new PackageOfferDto(ToDto(p), price, advance, price.HasValue ? price.Value - advance!.Value : null);
        }).ToList();

        return new PackageOffersResponse(model.Id, model.Manufacturer?.Name ?? string.Empty, model.Name, fuel.ToString(), _advancePercentage, offers);
    }

    public async Task<ServicePackageDto> UpdatePackageAsync(Guid packageId, UpdateServicePackageRequest request, CancellationToken ct = default)
    {
        var package = await _context.ServicePackages.FirstOrDefaultAsync(p => p.Id == packageId, ct)
            ?? throw new KeyNotFoundException("Package not found.");
        package.Update(request.Name, request.Tagline ?? string.Empty, request.IntervalKm, request.IntervalMonths, request.DurationHours,
            request.WarrantyKm, request.WarrantyDays, request.Includes, request.DisplayOrder, request.IsActive, request.IsRecommended);
        await _context.SaveChangesAsync(ct);
        return ToDto(package);
    }

    // ---------------- Prices ----------------

    public async Task<ModelPriceSheetDto> GetModelPriceSheetAsync(Guid modelId, CancellationToken ct = default)
    {
        var model = await _context.VehicleModels.AsNoTracking()
            .Include(m => m.Manufacturer)
            .FirstOrDefaultAsync(m => m.Id == modelId, ct)
            ?? throw new KeyNotFoundException("Car model not found.");

        var packages = await _context.ServicePackages.AsNoTracking().OrderBy(p => p.DisplayOrder).ToListAsync(ct);
        var prices = await _context.ServicePackagePrices.AsNoTracking()
            .Where(p => p.VehicleModelId == modelId)
            .ToListAsync(ct);

        var fuels = model.Fuels.Count > 0 ? model.Fuels : new List<string> { FuelType.Petrol.ToString() };
        var extraFuels = prices.Select(p => p.FuelType.ToString()).Where(f => !fuels.Contains(f)).Distinct();
        var allFuels = fuels.Concat(extraFuels).ToList();

        var cells = (from fuel in allFuels
                     from package in packages
                     let price = prices.FirstOrDefault(p => p.ServicePackageId == package.Id && p.FuelType.ToString() == fuel)
                     select new PackagePriceCellDto(package.Code, fuel, price?.Price)).ToList();

        return new ModelPriceSheetDto(model.Id, model.Manufacturer?.Name ?? string.Empty, model.Name, model.Segment, model.Fuels, cells);
    }

    public async Task<ModelPriceSheetDto> SetModelPricesAsync(Guid modelId, SetModelPricesRequest request, Guid userId, CancellationToken ct = default)
    {
        var modelExists = await _context.VehicleModels.AnyAsync(m => m.Id == modelId, ct);
        if (!modelExists) throw new KeyNotFoundException("Car model not found.");

        var packages = await _context.ServicePackages.ToDictionaryAsync(p => p.Code, StringComparer.OrdinalIgnoreCase, ct);
        var existing = await _context.ServicePackagePrices.Where(p => p.VehicleModelId == modelId).ToListAsync(ct);

        foreach (var cell in request.Prices)
        {
            if (!packages.TryGetValue(cell.PackageCode ?? string.Empty, out var package))
                throw new ArgumentException($"Unknown package '{cell.PackageCode}'.");
            var fuel = ParseFuel(cell.FuelType);
            var current = existing.FirstOrDefault(p => p.ServicePackageId == package.Id && p.FuelType == fuel);

            if (cell.Price is null or <= 0)
            {
                if (current != null) _context.ServicePackagePrices.Remove(current);
                continue;
            }

            if (cell.Price > 1_000_000) throw new ArgumentException("Price looks too high.");
            if (current == null)
            {
                var created = new ServicePackagePrice(package.Id, modelId, fuel, cell.Price.Value, userId);
                _context.ServicePackagePrices.Add(created);
                existing.Add(created);
            }
            else
            {
                current.SetPrice(cell.Price.Value, userId);
            }
        }

        await _context.SaveChangesAsync(ct);
        return await GetModelPriceSheetAsync(modelId, ct);
    }

    public async Task<ApplySegmentPriceResult> ApplySegmentPriceAsync(ApplySegmentPriceRequest request, Guid userId, CancellationToken ct = default)
    {
        var segment = VehicleModel.Segments.FirstOrDefault(s => string.Equals(s, request.Segment, StringComparison.OrdinalIgnoreCase))
            ?? throw new ArgumentException($"Segment must be one of: {string.Join(", ", VehicleModel.Segments)}.");
        var fuel = ParseFuel(request.FuelType);
        var package = await _context.ServicePackages.FirstOrDefaultAsync(p => p.Code == request.PackageCode.Trim().ToUpper(), ct)
            ?? throw new ArgumentException($"Unknown package '{request.PackageCode}'.");

        var fuelName = fuel.ToString();
        var models = await _context.VehicleModels
            .Where(m => m.IsActive && m.Segment == segment && m.Fuels.Contains(fuelName))
            .Select(m => m.Id)
            .ToListAsync(ct);

        var existing = await _context.ServicePackagePrices
            .Where(p => p.ServicePackageId == package.Id && p.FuelType == fuel && models.Contains(p.VehicleModelId))
            .ToDictionaryAsync(p => p.VehicleModelId, ct);

        int created = 0, updated = 0, skipped = 0;
        foreach (var modelId in models)
        {
            if (existing.TryGetValue(modelId, out var price))
            {
                if (request.OverwriteExisting) { price.SetPrice(request.Price, userId); updated++; }
                else skipped++;
            }
            else
            {
                _context.ServicePackagePrices.Add(new ServicePackagePrice(package.Id, modelId, fuel, request.Price, userId));
                created++;
            }
        }

        await _context.SaveChangesAsync(ct);
        return new ApplySegmentPriceResult(created, updated, skipped);
    }

    // ---------------- Manufacturers ----------------

    public async Task<VehicleManufacturerDto> CreateManufacturerAsync(UpsertManufacturerRequest request, CancellationToken ct = default)
    {
        var normalized = request.Name.Trim().ToUpperInvariant();
        if (await _context.VehicleManufacturers.AnyAsync(m => m.NormalizedName == normalized, ct))
            throw new InvalidOperationException($"A brand called '{request.Name.Trim()}' already exists.");

        var manufacturer = new VehicleManufacturer(request.Name, request.Country ?? string.Empty, string.Empty, request.DisplayOrder);
        manufacturer.SetPopular(request.IsPopular);
        if (!request.IsActive) manufacturer.Deactivate();
        _context.VehicleManufacturers.Add(manufacturer);
        await _context.SaveChangesAsync(ct);
        await VehicleMasterService.InvalidateCatalogCacheAsync(_cache, manufacturer.Id, cancellationToken: ct);
        return await ManufacturerDtoAsync(manufacturer.Id, ct);
    }

    public async Task<VehicleManufacturerDto> UpdateManufacturerAsync(Guid id, UpsertManufacturerRequest request, CancellationToken ct = default)
    {
        var manufacturer = await _context.VehicleManufacturers.FirstOrDefaultAsync(m => m.Id == id, ct)
            ?? throw new KeyNotFoundException("Brand not found.");
        var normalized = request.Name.Trim().ToUpperInvariant();
        if (await _context.VehicleManufacturers.AnyAsync(m => m.Id != id && m.NormalizedName == normalized, ct))
            throw new InvalidOperationException($"A brand called '{request.Name.Trim()}' already exists.");

        manufacturer.Update(request.Name, request.Country ?? string.Empty, manufacturer.LogoUrl, request.IsActive, request.DisplayOrder);
        manufacturer.SetPopular(request.IsPopular);
        await _context.SaveChangesAsync(ct);
        await VehicleMasterService.InvalidateCatalogCacheAsync(_cache, id, cancellationToken: ct);
        return await ManufacturerDtoAsync(id, ct);
    }

    public async Task<VehicleManufacturerDto> SetManufacturerLogoAsync(Guid id, byte[] content, string contentType, CancellationToken ct = default)
    {
        if (content.Length == 0) throw new ArgumentException("The logo file is empty.");
        if (content.Length > MaxLogoBytes) throw new ArgumentException("The logo must be 512 KB or smaller.");
        var type = (contentType ?? string.Empty).Split(';')[0].Trim().ToLowerInvariant();
        if (!AllowedLogoTypes.Contains(type)) throw new ArgumentException("Upload a PNG, JPG, WEBP or SVG image.");
        if (type == "image/svg+xml" && UnsafeSvg.IsMatch(Encoding.UTF8.GetString(content)))
            throw new ArgumentException("This SVG contains scripts or links and can't be used as a logo.");

        var manufacturer = await _context.VehicleManufacturers.FirstOrDefaultAsync(m => m.Id == id, ct)
            ?? throw new KeyNotFoundException("Brand not found.");

        var logo = await _context.VehicleManufacturerLogos.FirstOrDefaultAsync(l => l.ManufacturerId == id, ct);
        if (logo == null) _context.VehicleManufacturerLogos.Add(new VehicleManufacturerLogo(id, content, type));
        else logo.Replace(content, type);

        manufacturer.SetLogoUrl($"/api/v1/vehicle-manufacturers/{id}/logo?v={DateTime.UtcNow.Ticks}");
        await _context.SaveChangesAsync(ct);
        await VehicleMasterService.InvalidateCatalogCacheAsync(_cache, id, cancellationToken: ct);
        return await ManufacturerDtoAsync(id, ct);
    }

    public async Task<VehicleManufacturerDto> RemoveManufacturerLogoAsync(Guid id, CancellationToken ct = default)
    {
        var manufacturer = await _context.VehicleManufacturers.FirstOrDefaultAsync(m => m.Id == id, ct)
            ?? throw new KeyNotFoundException("Brand not found.");
        var logo = await _context.VehicleManufacturerLogos.FirstOrDefaultAsync(l => l.ManufacturerId == id, ct);
        if (logo != null) _context.VehicleManufacturerLogos.Remove(logo);
        manufacturer.SetLogoUrl(string.Empty);
        await _context.SaveChangesAsync(ct);
        await VehicleMasterService.InvalidateCatalogCacheAsync(_cache, id, cancellationToken: ct);
        return await ManufacturerDtoAsync(id, ct);
    }

    public async Task<ManufacturerLogoFile?> GetManufacturerLogoAsync(Guid id, CancellationToken ct = default)
    {
        var logo = await _context.VehicleManufacturerLogos.AsNoTracking().FirstOrDefaultAsync(l => l.ManufacturerId == id, ct);
        return logo == null ? null : new ManufacturerLogoFile(logo.Content, logo.ContentType, logo.UpdatedAtUtc);
    }

    // ---------------- Models ----------------

    public async Task<VehicleModelDto> CreateModelAsync(Guid manufacturerId, UpsertVehicleModelRequest request, CancellationToken ct = default)
    {
        if (!await _context.VehicleManufacturers.AnyAsync(m => m.Id == manufacturerId, ct))
            throw new KeyNotFoundException("Brand not found.");
        var normalized = request.Name.Trim().ToUpperInvariant();
        if (await _context.VehicleModels.AnyAsync(m => m.ManufacturerId == manufacturerId && m.NormalizedName == normalized, ct))
            throw new InvalidOperationException($"'{request.Name.Trim()}' already exists for this brand.");
        ValidateYears(request);

        var model = new VehicleModel(manufacturerId, request.Name, request.BodyType, request.YearFrom, request.YearTo);
        model.SetCatalogueDetails(request.Segment, request.Fuels);
        if (!request.IsActive) model.Deactivate();
        _context.VehicleModels.Add(model);
        await _context.SaveChangesAsync(ct);
        await VehicleMasterService.InvalidateCatalogCacheAsync(_cache, manufacturerId, model.Id, ct);
        return await ModelDtoAsync(model.Id, ct);
    }

    public async Task<VehicleModelDto> UpdateModelAsync(Guid modelId, UpsertVehicleModelRequest request, CancellationToken ct = default)
    {
        var model = await _context.VehicleModels.FirstOrDefaultAsync(m => m.Id == modelId, ct)
            ?? throw new KeyNotFoundException("Car model not found.");
        var normalized = request.Name.Trim().ToUpperInvariant();
        if (await _context.VehicleModels.AnyAsync(m => m.Id != modelId && m.ManufacturerId == model.ManufacturerId && m.NormalizedName == normalized, ct))
            throw new InvalidOperationException($"'{request.Name.Trim()}' already exists for this brand.");
        ValidateYears(request);

        model.Update(request.Name, request.BodyType, request.YearFrom, request.YearTo, request.IsActive);
        model.SetCatalogueDetails(request.Segment, request.Fuels);
        await _context.SaveChangesAsync(ct);
        await VehicleMasterService.InvalidateCatalogCacheAsync(_cache, model.ManufacturerId, model.Id, ct);
        return await ModelDtoAsync(model.Id, ct);
    }

    // ---------------- Helpers ----------------

    private static void ValidateYears(UpsertVehicleModelRequest request)
    {
        if (request.YearTo.HasValue && request.YearTo < request.YearFrom)
            throw new ArgumentException("'Sold until' year can't be before 'Sold from' year.");
    }

    public static FuelType ParseFuel(string? fuelType)
    {
        if (!string.IsNullOrWhiteSpace(fuelType) &&
            Enum.TryParse<FuelType>(fuelType.Replace(" ", string.Empty).Replace("-", string.Empty), true, out var fuel) &&
            Enum.IsDefined(fuel))
        {
            return fuel;
        }
        throw new ArgumentException($"Unknown fuel type '{fuelType}'.");
    }

    private async Task<VehicleManufacturerDto> ManufacturerDtoAsync(Guid id, CancellationToken ct) =>
        await _context.VehicleManufacturers.AsNoTracking()
            .Where(m => m.Id == id)
            .Select(m => new VehicleManufacturerDto(m.Id, m.Name, m.Country, m.LogoUrl, m.IsActive, m.DisplayOrder, m.Models.Count(x => x.IsActive), m.IsPopular))
            .FirstAsync(ct);

    private async Task<VehicleModelDto> ModelDtoAsync(Guid id, CancellationToken ct) =>
        await _context.VehicleModels.AsNoTracking()
            .Where(m => m.Id == id)
            .Select(m => new VehicleModelDto(m.Id, m.ManufacturerId, m.Manufacturer != null ? m.Manufacturer.Name : string.Empty,
                m.Name, m.BodyType, m.YearFrom, m.YearTo, m.IsActive, m.Variants.Count(v => v.IsActive), m.Segment, m.Fuels))
            .FirstAsync(ct);

    private static ServicePackageDto ToDto(ServicePackage p) => new(
        p.Id, p.Code, p.Name, p.Tagline, p.IntervalKm, p.IntervalMonths, p.DurationHours,
        p.WarrantyKm, p.WarrantyDays, p.Includes, p.DisplayOrder, p.IsActive, p.IsRecommended);
}

/// <summary>The share of the price the customer pays online to BroCo when booking.</summary>
public static class BookingAdvance
{
    public static decimal Percentage(IConfiguration configuration)
    {
        var configured = configuration.GetValue<decimal?>("Booking:AdvancePercentage") ?? 10m;
        return configured is > 0 and <= 100 ? configured : 10m;
    }

    /// <summary>Advance rounded to whole rupees (at least ₹1, never more than the price).</summary>
    public static decimal Amount(decimal price, decimal percentage) =>
        Math.Min(price, Math.Max(1m, decimal.Round(price * percentage / 100m, 0, MidpointRounding.AwayFromZero)));
}
