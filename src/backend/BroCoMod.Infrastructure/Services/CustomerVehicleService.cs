using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace BroCoMod.Infrastructure.Services;

public class CustomerVehicleService : ICustomerVehicleService
{
    private readonly IApplicationDbContext _context;

    public CustomerVehicleService(IApplicationDbContext context)
    {
        _context = context;
    }

    private async Task<Guid> ResolveCustomerIdAsync(Guid customerId, CancellationToken cancellationToken)
    {
        var profile = await _context.CustomerProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.Id == customerId || cp.UserId == customerId, cancellationToken);

        return profile?.Id ?? customerId;
    }

    public async Task<IReadOnlyList<CustomerVehicleDetailDto>> GetCustomerVehiclesAsync(
        Guid customerId,
        CancellationToken cancellationToken = default)
    {
        var resolvedCustomerId = await ResolveCustomerIdAsync(customerId, cancellationToken);

        return await _context.CustomerVehicles
            .AsNoTracking()
            .Where(v => v.CustomerId == resolvedCustomerId && v.IsActive)
            .OrderByDescending(v => v.IsPrimary)
            .ThenByDescending(v => v.CreatedAtUtc)
            .Select(v => new CustomerVehicleDetailDto(
                v.Id,
                v.CustomerId,
                v.ManufacturerId,
                v.Make,
                v.ModelId,
                v.Model,
                v.VariantId,
                v.VariantName,
                v.Year,
                v.FuelType.ToString(),
                v.Transmission,
                v.LicensePlate,
                v.Vin,
                v.Mileage,
                v.Color,
                v.IsPrimary,
                v.IsActive,
                v.CreatedAtUtc
            ))
            .ToListAsync(cancellationToken);
    }

    public async Task<CustomerVehicleDetailDto?> GetCustomerVehicleByIdAsync(
        Guid customerId,
        Guid vehicleId,
        CancellationToken cancellationToken = default)
    {
        var resolvedCustomerId = await ResolveCustomerIdAsync(customerId, cancellationToken);

        return await _context.CustomerVehicles
            .AsNoTracking()
            .Where(v => v.Id == vehicleId && v.CustomerId == resolvedCustomerId && v.IsActive)
            .Select(v => new CustomerVehicleDetailDto(
                v.Id,
                v.CustomerId,
                v.ManufacturerId,
                v.Make,
                v.ModelId,
                v.Model,
                v.VariantId,
                v.VariantName,
                v.Year,
                v.FuelType.ToString(),
                v.Transmission,
                v.LicensePlate,
                v.Vin,
                v.Mileage,
                v.Color,
                v.IsPrimary,
                v.IsActive,
                v.CreatedAtUtc
            ))
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<CustomerVehicleDetailDto> AddVehicleAsync(
        Guid customerId,
        CreateCustomerVehicleRequest request,
        CancellationToken cancellationToken = default)
    {
        var resolvedCustomerId = await ResolveCustomerIdAsync(customerId, cancellationToken);

        // 1. Validate Manufacturer
        var manufacturer = await _context.VehicleManufacturers
            .FirstOrDefaultAsync(m => m.Id == request.ManufacturerId && m.IsActive, cancellationToken);
        if (manufacturer == null)
        {
            throw new KeyNotFoundException($"Vehicle manufacturer with ID '{request.ManufacturerId}' was not found or is inactive.");
        }

        // 2. Validate Model and its relationship to Manufacturer
        var model = await _context.VehicleModels
            .FirstOrDefaultAsync(m => m.Id == request.ModelId && m.IsActive, cancellationToken);
        if (model == null)
        {
            throw new KeyNotFoundException($"Vehicle model with ID '{request.ModelId}' was not found or is inactive.");
        }

        if (model.ManufacturerId != request.ManufacturerId)
        {
            throw new InvalidOperationException($"Vehicle model '{model.Name}' does not belong to manufacturer '{manufacturer.Name}'. Relational hierarchy mismatch.");
        }

        // 3. Validate Variant and its relationship to Model (if supplied)
        string variantName = string.Empty;
        string transmission = request.Transmission ?? "Automatic";

        if (request.VariantId.HasValue)
        {
            var variant = await _context.VehicleVariants
                .FirstOrDefaultAsync(v => v.Id == request.VariantId.Value && v.IsActive, cancellationToken);
            if (variant == null)
            {
                throw new KeyNotFoundException($"Vehicle variant with ID '{request.VariantId.Value}' was not found or is inactive.");
            }

            if (variant.ModelId != request.ModelId)
            {
                throw new InvalidOperationException($"Vehicle variant '{variant.Name}' does not belong to model '{model.Name}'. Relational hierarchy mismatch.");
            }

            variantName = variant.Name;
            if (string.IsNullOrWhiteSpace(request.Transmission))
            {
                transmission = variant.Transmission;
            }
        }

        // 4. Validate Model Year range
        var maxYear = model.YearTo ?? (DateTime.UtcNow.Year + 1);
        if (request.Year < model.YearFrom || request.Year > maxYear)
        {
            throw new ArgumentOutOfRangeException(nameof(request.Year), $"Model year {request.Year} is invalid for {model.Name}. Allowed range is {model.YearFrom} to {maxYear}.");
        }

        // 5. Check if customer already has active vehicles
        var existingVehicles = await _context.CustomerVehicles
            .Where(v => v.CustomerId == resolvedCustomerId && v.IsActive)
            .ToListAsync(cancellationToken);

        bool isPrimary = request.IsPrimary || existingVehicles.Count == 0;

        if (isPrimary && existingVehicles.Count > 0)
        {
            foreach (var v in existingVehicles.Where(v => v.IsPrimary))
            {
                v.SetPrimary(false);
            }
        }

        var vehicle = new CustomerVehicle(
            resolvedCustomerId,
            request.ManufacturerId,
            manufacturer.Name,
            request.ModelId,
            model.Name,
            request.VariantId,
            variantName,
            request.Year,
            request.FuelType,
            transmission,
            request.LicensePlate,
            request.Vin ?? string.Empty,
            request.Mileage,
            request.Color ?? string.Empty,
            isPrimary
        );

        _context.CustomerVehicles.Add(vehicle);
        await _context.SaveChangesAsync(cancellationToken);

        return new CustomerVehicleDetailDto(
            vehicle.Id,
            vehicle.CustomerId,
            vehicle.ManufacturerId,
            vehicle.Make,
            vehicle.ModelId,
            vehicle.Model,
            vehicle.VariantId,
            vehicle.VariantName,
            vehicle.Year,
            vehicle.FuelType.ToString(),
            vehicle.Transmission,
            vehicle.LicensePlate,
            vehicle.Vin,
            vehicle.Mileage,
            vehicle.Color,
            vehicle.IsPrimary,
            vehicle.IsActive,
            vehicle.CreatedAtUtc
        );
    }

    public async Task<CustomerVehicleDetailDto> UpdateVehicleAsync(
        Guid customerId,
        Guid vehicleId,
        UpdateCustomerVehicleRequest request,
        CancellationToken cancellationToken = default)
    {
        var resolvedCustomerId = await ResolveCustomerIdAsync(customerId, cancellationToken);

        var vehicle = await _context.CustomerVehicles
            .FirstOrDefaultAsync(v => v.Id == vehicleId && v.CustomerId == resolvedCustomerId && v.IsActive, cancellationToken);

        if (vehicle == null)
        {
            throw new KeyNotFoundException($"Vehicle with ID '{vehicleId}' was not found or is not accessible.");
        }

        // 1. Validate Manufacturer
        var manufacturer = await _context.VehicleManufacturers
            .FirstOrDefaultAsync(m => m.Id == request.ManufacturerId && m.IsActive, cancellationToken);
        if (manufacturer == null)
        {
            throw new KeyNotFoundException($"Vehicle manufacturer with ID '{request.ManufacturerId}' was not found or is inactive.");
        }

        // 2. Validate Model
        var model = await _context.VehicleModels
            .FirstOrDefaultAsync(m => m.Id == request.ModelId && m.IsActive, cancellationToken);
        if (model == null)
        {
            throw new KeyNotFoundException($"Vehicle model with ID '{request.ModelId}' was not found or is inactive.");
        }

        if (model.ManufacturerId != request.ManufacturerId)
        {
            throw new InvalidOperationException($"Vehicle model '{model.Name}' does not belong to manufacturer '{manufacturer.Name}'. Relational hierarchy mismatch.");
        }

        // 3. Validate Variant
        string variantName = string.Empty;
        string transmission = request.Transmission ?? "Automatic";

        if (request.VariantId.HasValue)
        {
            var variant = await _context.VehicleVariants
                .FirstOrDefaultAsync(v => v.Id == request.VariantId.Value && v.IsActive, cancellationToken);
            if (variant == null)
            {
                throw new KeyNotFoundException($"Vehicle variant with ID '{request.VariantId.Value}' was not found or is inactive.");
            }

            if (variant.ModelId != request.ModelId)
            {
                throw new InvalidOperationException($"Vehicle variant '{variant.Name}' does not belong to model '{model.Name}'. Relational hierarchy mismatch.");
            }

            variantName = variant.Name;
            if (string.IsNullOrWhiteSpace(request.Transmission))
            {
                transmission = variant.Transmission;
            }
        }

        // 4. Validate Model Year range
        var maxYear = model.YearTo ?? (DateTime.UtcNow.Year + 1);
        if (request.Year < model.YearFrom || request.Year > maxYear)
        {
            throw new ArgumentOutOfRangeException(nameof(request.Year), $"Model year {request.Year} is invalid for {model.Name}. Allowed range is {model.YearFrom} to {maxYear}.");
        }

        // 5. Handle Primary Status
        if (request.IsPrimary && !vehicle.IsPrimary)
        {
            var otherVehicles = await _context.CustomerVehicles
                .Where(v => v.CustomerId == resolvedCustomerId && v.Id != vehicleId && v.IsActive)
                .ToListAsync(cancellationToken);

            foreach (var other in otherVehicles.Where(o => o.IsPrimary))
            {
                other.SetPrimary(false);
            }
        }

        vehicle.UpdateDetails(
            request.ManufacturerId,
            manufacturer.Name,
            request.ModelId,
            model.Name,
            request.VariantId,
            variantName,
            request.Year,
            request.FuelType,
            transmission,
            request.LicensePlate,
            request.Vin ?? string.Empty,
            request.Mileage,
            request.Color ?? string.Empty,
            request.IsPrimary
        );

        await _context.SaveChangesAsync(cancellationToken);

        return new CustomerVehicleDetailDto(
            vehicle.Id,
            vehicle.CustomerId,
            vehicle.ManufacturerId,
            vehicle.Make,
            vehicle.ModelId,
            vehicle.Model,
            vehicle.VariantId,
            vehicle.VariantName,
            vehicle.Year,
            vehicle.FuelType.ToString(),
            vehicle.Transmission,
            vehicle.LicensePlate,
            vehicle.Vin,
            vehicle.Mileage,
            vehicle.Color,
            vehicle.IsPrimary,
            vehicle.IsActive,
            vehicle.CreatedAtUtc
        );
    }

    public async Task<bool> DeleteVehicleAsync(
        Guid customerId,
        Guid vehicleId,
        CancellationToken cancellationToken = default)
    {
        var resolvedCustomerId = await ResolveCustomerIdAsync(customerId, cancellationToken);

        var vehicle = await _context.CustomerVehicles
            .FirstOrDefaultAsync(v => v.Id == vehicleId && v.CustomerId == resolvedCustomerId && v.IsActive, cancellationToken);

        if (vehicle == null)
        {
            throw new KeyNotFoundException($"Vehicle with ID '{vehicleId}' was not found or is not accessible.");
        }

        bool wasPrimary = vehicle.IsPrimary;
        vehicle.Deactivate();

        // If this vehicle was the primary vehicle, promote another active vehicle to primary if available
        if (wasPrimary)
        {
            var nextVehicle = await _context.CustomerVehicles
                .Where(v => v.CustomerId == resolvedCustomerId && v.Id != vehicleId && v.IsActive)
                .OrderByDescending(v => v.CreatedAtUtc)
                .FirstOrDefaultAsync(cancellationToken);

            nextVehicle?.SetPrimary(true);
        }

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> SetPrimaryVehicleAsync(
        Guid customerId,
        Guid vehicleId,
        CancellationToken cancellationToken = default)
    {
        var resolvedCustomerId = await ResolveCustomerIdAsync(customerId, cancellationToken);

        var targetVehicle = await _context.CustomerVehicles
            .FirstOrDefaultAsync(v => v.Id == vehicleId && v.CustomerId == resolvedCustomerId && v.IsActive, cancellationToken);

        if (targetVehicle == null)
        {
            throw new KeyNotFoundException($"Vehicle with ID '{vehicleId}' was not found or is not accessible.");
        }

        var allVehicles = await _context.CustomerVehicles
            .Where(v => v.CustomerId == resolvedCustomerId && v.IsActive)
            .ToListAsync(cancellationToken);

        foreach (var v in allVehicles)
        {
            v.SetPrimary(v.Id == vehicleId);
        }

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}
