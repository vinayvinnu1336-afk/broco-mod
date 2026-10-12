using System.Text.Json;
using BroCoMod.Application.DTOs;
using BroCoMod.Domain.Entities.VehicleMaster;
using BroCoMod.Domain.Enums;
using BroCoMod.Infrastructure.Persistence;
using BroCoMod.Infrastructure.Services;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Xunit;

namespace BroCoMod.UnitTests.VehicleMaster;

public class VehicleMasterCacheUnitTests
{
    private static ApplicationDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: $"BroCoMod_VehicleCacheTests_{Guid.NewGuid()}")
            .Options;

        return new ApplicationDbContext(options);
    }

    private static RedisCacheService CreateCache() => new(new MemoryCache(new MemoryCacheOptions()));

    [Fact]
    public void CatalogDtos_RoundTripThroughSystemTextJson()
    {
        // The Redis-backed cache stores values as JSON, so the cached DTO lists must deserialize losslessly.
        var manufacturers = new List<VehicleManufacturerDto> { new(Guid.NewGuid(), "BMW", "Germany", "/logos/bmw.svg", true, 1, 4) };
        var models = new List<VehicleModelDto> { new(Guid.NewGuid(), Guid.NewGuid(), "BMW", "3 Series", "Sedan", 2019, null, true, 3) };
        var variants = new List<VehicleVariantDto> { new(Guid.NewGuid(), Guid.NewGuid(), "3 Series", "M340i", "Automatic", "Petrol", 2998, 382, 2020, null, true) };

        JsonSerializer.Deserialize<List<VehicleManufacturerDto>>(JsonSerializer.Serialize(manufacturers)).Should().Equal(manufacturers);
        JsonSerializer.Deserialize<List<VehicleModelDto>>(JsonSerializer.Serialize(models)).Should().Equal(models);
        JsonSerializer.Deserialize<List<VehicleVariantDto>>(JsonSerializer.Serialize(variants)).Should().Equal(variants);
    }

    [Fact]
    public async Task GetManufacturers_DefaultListing_IsCachedUntilInvalidated()
    {
        using var context = CreateInMemoryDbContext();
        var cache = CreateCache();
        context.VehicleManufacturers.Add(new VehicleManufacturer("BMW", "Germany", "/logos/bmw.svg", 1));
        await context.SaveChangesAsync();

        var service = new VehicleMasterService(context, cache);
        (await service.GetManufacturersAsync()).Should().HaveCount(1);

        context.VehicleManufacturers.Add(new VehicleManufacturer("Audi", "Germany", "/logos/audi.svg", 2));
        await context.SaveChangesAsync();

        // Default listing is served from cache; filtered listing always hits the database.
        (await service.GetManufacturersAsync()).Should().HaveCount(1);
        (await service.GetManufacturersAsync(search: "AUDI")).Should().ContainSingle(m => m.Name == "Audi");

        await VehicleMasterService.InvalidateCatalogCacheAsync(cache);
        (await service.GetManufacturersAsync()).Should().HaveCount(2);
    }

    [Fact]
    public async Task GetModelsAndVariants_AreCachedPerParentAndInvalidatedById()
    {
        using var context = CreateInMemoryDbContext();
        var cache = CreateCache();
        var bmw = new VehicleManufacturer("BMW", "Germany", "/logos/bmw.svg", 1);
        context.VehicleManufacturers.Add(bmw);
        await context.SaveChangesAsync();
        var series3 = new VehicleModel(bmw.Id, "3 Series", "Sedan", 2019);
        context.VehicleModels.Add(series3);
        await context.SaveChangesAsync();
        context.VehicleVariants.Add(new VehicleVariant(series3.Id, "330i", "Automatic", FuelType.Petrol, 1998, 255, 2019));
        await context.SaveChangesAsync();

        var service = new VehicleMasterService(context, cache);
        (await service.GetModelsByManufacturerAsync(bmw.Id)).Should().HaveCount(1);
        (await service.GetVariantsByModelAsync(series3.Id)).Should().HaveCount(1);

        context.VehicleModels.Add(new VehicleModel(bmw.Id, "X5", "SUV", 2019));
        context.VehicleVariants.Add(new VehicleVariant(series3.Id, "M340i", "Automatic", FuelType.Petrol, 2998, 382, 2020));
        await context.SaveChangesAsync();

        (await service.GetModelsByManufacturerAsync(bmw.Id)).Should().HaveCount(1);
        (await service.GetVariantsByModelAsync(series3.Id)).Should().HaveCount(1);

        await VehicleMasterService.InvalidateCatalogCacheAsync(cache, manufacturerId: bmw.Id, modelId: series3.Id);

        (await service.GetModelsByManufacturerAsync(bmw.Id)).Should().HaveCount(2);
        (await service.GetVariantsByModelAsync(series3.Id)).Should().HaveCount(2);
    }
}
