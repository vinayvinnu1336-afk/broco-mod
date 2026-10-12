using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace BroCoMod.Infrastructure.Services;

public class VehicleMasterService : IVehicleMasterService
{
    /// <summary>
    /// The vehicle catalog is read-mostly reference data. Only the default (unfiltered, active-only)
    /// listings are cached; filtered queries always go to the database.
    /// </summary>
    public static readonly TimeSpan CatalogCacheExpiry = TimeSpan.FromMinutes(30);

    public const string ManufacturersCacheKey = "vehicle-master:manufacturers";

    public static string ModelsCacheKey(Guid manufacturerId) => $"vehicle-master:models:{manufacturerId}";

    public static string VariantsCacheKey(Guid modelId) => $"vehicle-master:variants:{modelId}";

    private readonly IApplicationDbContext _context;
    private readonly ICacheService _cache;

    public VehicleMasterService(IApplicationDbContext context, ICacheService cache)
    {
        _context = context;
        _cache = cache;
    }

    /// <summary>
    /// Clears every cached catalog entry that can be affected by a change to the given manufacturer,
    /// model or variant. Call after any create/update/deactivate of catalog entities
    /// (manufacturer changes alter ModelsCount; model changes alter VariantsCount and names on variants).
    /// </summary>
    public static async Task InvalidateCatalogCacheAsync(
        ICacheService cache,
        Guid? manufacturerId = null,
        Guid? modelId = null,
        CancellationToken cancellationToken = default)
    {
        await cache.RemoveAsync(ManufacturersCacheKey, cancellationToken);

        if (manufacturerId.HasValue)
        {
            await cache.RemoveAsync(ModelsCacheKey(manufacturerId.Value), cancellationToken);
        }

        if (modelId.HasValue)
        {
            await cache.RemoveAsync(VariantsCacheKey(modelId.Value), cancellationToken);
        }
    }

    public async Task<IReadOnlyList<VehicleManufacturerDto>> GetManufacturersAsync(
        string? search = null,
        bool activeOnly = true,
        CancellationToken cancellationToken = default)
    {
        var cacheable = activeOnly && string.IsNullOrWhiteSpace(search);
        if (cacheable)
        {
            var cached = await _cache.GetAsync<List<VehicleManufacturerDto>>(ManufacturersCacheKey, cancellationToken);
            if (cached != null)
            {
                return cached;
            }
        }

        var query = _context.VehicleManufacturers.AsNoTracking();

        if (activeOnly)
        {
            query = query.Where(m => m.IsActive);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToUpperInvariant();
            query = query.Where(m => m.NormalizedName.Contains(term) || m.Country.ToUpper().Contains(term));
        }

        var manufacturers = await query
            .OrderBy(m => m.DisplayOrder)
            .ThenBy(m => m.Name)
            .Select(m => new VehicleManufacturerDto(
                m.Id,
                m.Name,
                m.Country,
                m.LogoUrl,
                m.IsActive,
                m.DisplayOrder,
                m.Models.Count(mod => !activeOnly || mod.IsActive),
                m.IsPopular
            ))
            .ToListAsync(cancellationToken);

        if (cacheable)
        {
            await _cache.SetAsync(ManufacturersCacheKey, manufacturers, CatalogCacheExpiry, cancellationToken);
        }

        return manufacturers;
    }

    public async Task<VehicleManufacturerDto?> GetManufacturerByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        return await _context.VehicleManufacturers
            .AsNoTracking()
            .Where(m => m.Id == id)
            .Select(m => new VehicleManufacturerDto(
                m.Id,
                m.Name,
                m.Country,
                m.LogoUrl,
                m.IsActive,
                m.DisplayOrder,
                m.Models.Count(mod => mod.IsActive),
                m.IsPopular
            ))
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<VehicleModelDto>> GetModelsByManufacturerAsync(
        Guid manufacturerId,
        string? bodyType = null,
        bool activeOnly = true,
        CancellationToken cancellationToken = default)
    {
        var cacheable = activeOnly && string.IsNullOrWhiteSpace(bodyType);
        var cacheKey = ModelsCacheKey(manufacturerId);
        if (cacheable)
        {
            var cached = await _cache.GetAsync<List<VehicleModelDto>>(cacheKey, cancellationToken);
            if (cached != null)
            {
                return cached;
            }
        }

        var query = _context.VehicleModels
            .AsNoTracking()
            .Where(m => m.ManufacturerId == manufacturerId);

        if (activeOnly)
        {
            query = query.Where(m => m.IsActive);
        }

        if (!string.IsNullOrWhiteSpace(bodyType))
        {
            var bt = bodyType.Trim().ToUpperInvariant();
            query = query.Where(m => m.BodyType.ToUpper() == bt);
        }

        var models = await query
            .OrderBy(m => m.Name)
            .Select(m => new VehicleModelDto(
                m.Id,
                m.ManufacturerId,
                m.Manufacturer != null ? m.Manufacturer.Name : string.Empty,
                m.Name,
                m.BodyType,
                m.YearFrom,
                m.YearTo,
                m.IsActive,
                m.Variants.Count(v => !activeOnly || v.IsActive),
                m.Segment,
                m.Fuels
            ))
            .ToListAsync(cancellationToken);

        if (cacheable)
        {
            await _cache.SetAsync(cacheKey, models, CatalogCacheExpiry, cancellationToken);
        }

        return models;
    }

    public async Task<VehicleModelDto?> GetModelByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        return await _context.VehicleModels
            .AsNoTracking()
            .Where(m => m.Id == id)
            .Select(m => new VehicleModelDto(
                m.Id,
                m.ManufacturerId,
                m.Manufacturer != null ? m.Manufacturer.Name : string.Empty,
                m.Name,
                m.BodyType,
                m.YearFrom,
                m.YearTo,
                m.IsActive,
                m.Variants.Count(v => v.IsActive),
                m.Segment,
                m.Fuels
            ))
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<VehicleVariantDto>> GetVariantsByModelAsync(
        Guid modelId,
        bool activeOnly = true,
        CancellationToken cancellationToken = default)
    {
        var cacheable = activeOnly;
        var cacheKey = VariantsCacheKey(modelId);
        if (cacheable)
        {
            var cached = await _cache.GetAsync<List<VehicleVariantDto>>(cacheKey, cancellationToken);
            if (cached != null)
            {
                return cached;
            }
        }

        var query = _context.VehicleVariants
            .AsNoTracking()
            .Where(v => v.ModelId == modelId);

        if (activeOnly)
        {
            query = query.Where(v => v.IsActive);
        }

        var variants = await query
            .OrderBy(v => v.Name)
            .Select(v => new VehicleVariantDto(
                v.Id,
                v.ModelId,
                v.Model != null ? v.Model.Name : string.Empty,
                v.Name,
                v.Transmission,
                v.FuelType.ToString(),
                v.EngineDisplacementCc,
                v.Horsepower,
                v.YearFrom,
                v.YearTo,
                v.IsActive
            ))
            .ToListAsync(cancellationToken);

        if (cacheable)
        {
            await _cache.SetAsync(cacheKey, variants, CatalogCacheExpiry, cancellationToken);
        }

        return variants;
    }

    public async Task<VehicleVariantDto?> GetVariantByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        return await _context.VehicleVariants
            .AsNoTracking()
            .Where(v => v.Id == id)
            .Select(v => new VehicleVariantDto(
                v.Id,
                v.ModelId,
                v.Model != null ? v.Model.Name : string.Empty,
                v.Name,
                v.Transmission,
                v.FuelType.ToString(),
                v.EngineDisplacementCc,
                v.Horsepower,
                v.YearFrom,
                v.YearTo,
                v.IsActive
            ))
            .FirstOrDefaultAsync(cancellationToken);
    }

    public IReadOnlyList<VehicleFuelTypeDto> GetFuelTypes()
    {
        return Enum.GetValues<FuelType>()
            .Select(f => new VehicleFuelTypeDto(
                (int)f,
                f.ToString(),
                f switch
                {
                    FuelType.PlugInHybrid => "Plug-in Hybrid (PHEV)",
                    FuelType.CNG => "Compressed Natural Gas (CNG)",
                    FuelType.LPG => "Liquefied Petroleum Gas (LPG)",
                    _ => f.ToString()
                }
            ))
            .ToList();
    }
}
