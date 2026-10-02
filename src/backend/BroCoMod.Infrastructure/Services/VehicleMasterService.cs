using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace BroCoMod.Infrastructure.Services;

public class VehicleMasterService : IVehicleMasterService
{
    private readonly IApplicationDbContext _context;

    public VehicleMasterService(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<VehicleManufacturerDto>> GetManufacturersAsync(
        string? search = null,
        bool activeOnly = true,
        CancellationToken cancellationToken = default)
    {
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

        return await query
            .OrderBy(m => m.DisplayOrder)
            .ThenBy(m => m.Name)
            .Select(m => new VehicleManufacturerDto(
                m.Id,
                m.Name,
                m.Country,
                m.LogoUrl,
                m.IsActive,
                m.DisplayOrder,
                m.Models.Count(mod => !activeOnly || mod.IsActive)
            ))
            .ToListAsync(cancellationToken);
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
                m.Models.Count(mod => mod.IsActive)
            ))
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<VehicleModelDto>> GetModelsByManufacturerAsync(
        Guid manufacturerId,
        string? bodyType = null,
        bool activeOnly = true,
        CancellationToken cancellationToken = default)
    {
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

        return await query
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
                m.Variants.Count(v => !activeOnly || v.IsActive)
            ))
            .ToListAsync(cancellationToken);
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
                m.Variants.Count(v => v.IsActive)
            ))
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<VehicleVariantDto>> GetVariantsByModelAsync(
        Guid modelId,
        bool activeOnly = true,
        CancellationToken cancellationToken = default)
    {
        var query = _context.VehicleVariants
            .AsNoTracking()
            .Where(v => v.ModelId == modelId);

        if (activeOnly)
        {
            query = query.Where(v => v.IsActive);
        }

        return await query
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
