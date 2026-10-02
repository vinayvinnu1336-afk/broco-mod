using BroCoMod.Application.DTOs;
using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Entities.Identity;
using BroCoMod.Domain.Entities.VehicleMaster;
using BroCoMod.Domain.Enums;
using BroCoMod.Infrastructure.Persistence;
using BroCoMod.Infrastructure.Services;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace BroCoMod.UnitTests.VehicleMaster;

public class VehicleMasterAndCustomerVehicleUnitTests
{
    private static ApplicationDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: $"BroCoMod_VehicleTests_{Guid.NewGuid()}")
            .Options;

        return new ApplicationDbContext(options);
    }

    [Fact]
    public async Task AddVehicle_ValidHierarchy_SuccessfullyCreatesVehicleWithPrimaryStatus()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var customerId = Guid.NewGuid();
        var customerUser = new User("cust1@test.com", "Cust One", "+1234567890", "hash", "salt");
        context.Users.Add(customerUser);
        var customerProfile = new CustomerProfile(customerUser.Id, "123 Street", "Email");
        context.CustomerProfiles.Add(customerProfile);

        var manufacturer = new VehicleManufacturer("BMW", "Germany", "/logos/bmw.svg", 1);
        context.VehicleManufacturers.Add(manufacturer);
        await context.SaveChangesAsync();

        var model = new VehicleModel(manufacturer.Id, "3 Series", "Sedan", 2019, 2026);
        context.VehicleModels.Add(model);
        await context.SaveChangesAsync();

        var variant = new VehicleVariant(model.Id, "M340i xDrive", "Automatic", FuelType.Petrol, 2998, 382, 2020);
        context.VehicleVariants.Add(variant);
        await context.SaveChangesAsync();

        var service = new CustomerVehicleService(context);

        var request = new CreateCustomerVehicleRequest(
            ManufacturerId: manufacturer.Id,
            ModelId: model.Id,
            VariantId: variant.Id,
            Year: 2022,
            FuelType: FuelType.Petrol,
            Transmission: "Automatic",
            LicensePlate: "MOD-340",
            Vin: "WBA5U7C06NF999999",
            Mileage: 15000,
            Color: "Tanzanite Blue",
            IsPrimary: true
        );

        // Act
        var result = await service.AddVehicleAsync(customerProfile.Id, request);

        // Assert
        result.Should().NotBeNull();
        result.CustomerId.Should().Be(customerProfile.Id);
        result.Make.Should().Be("BMW");
        result.Model.Should().Be("3 Series");
        result.VariantName.Should().Be("M340i xDrive");
        result.Year.Should().Be(2022);
        result.IsPrimary.Should().BeTrue();
        result.LicensePlate.Should().Be("MOD-340");
    }

    [Fact]
    public async Task AddVehicle_ModelMismatchWithManufacturer_ThrowsInvalidOperationException()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var customerProfile = new CustomerProfile(Guid.NewGuid(), "123 Street", "Email");
        context.CustomerProfiles.Add(customerProfile);

        var bmw = new VehicleManufacturer("BMW", "Germany", "/logos/bmw.svg", 1);
        var audi = new VehicleManufacturer("Audi", "Germany", "/logos/audi.svg", 2);
        context.VehicleManufacturers.AddRange(bmw, audi);
        await context.SaveChangesAsync();

        // Model belongs to Audi, but request will claim it belongs to BMW
        var audiModel = new VehicleModel(audi.Id, "A4", "Sedan", 2016);
        context.VehicleModels.Add(audiModel);
        await context.SaveChangesAsync();

        var service = new CustomerVehicleService(context);

        var request = new CreateCustomerVehicleRequest(
            ManufacturerId: bmw.Id, // Mismatched manufacturer!
            ModelId: audiModel.Id,
            VariantId: null,
            Year: 2020,
            FuelType: FuelType.Petrol,
            Transmission: "Automatic",
            LicensePlate: "FAKEMODEL",
            Vin: "",
            Mileage: 5000,
            Color: "Black",
            IsPrimary: false
        );

        // Act
        Func<Task> act = async () => await service.AddVehicleAsync(customerProfile.Id, request);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*does not belong to manufacturer*");
    }

    [Fact]
    public async Task AddVehicle_VariantMismatchWithModel_ThrowsInvalidOperationException()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var customerProfile = new CustomerProfile(Guid.NewGuid(), "123 Street", "Email");
        context.CustomerProfiles.Add(customerProfile);

        var bmw = new VehicleManufacturer("BMW", "Germany", "/logos/bmw.svg", 1);
        context.VehicleManufacturers.Add(bmw);
        await context.SaveChangesAsync();

        var model3Series = new VehicleModel(bmw.Id, "3 Series", "Sedan", 2019);
        var modelM3 = new VehicleModel(bmw.Id, "M3", "Sedan", 2021);
        context.VehicleModels.AddRange(model3Series, modelM3);
        await context.SaveChangesAsync();

        // Variant belongs to M3
        var m3Variant = new VehicleVariant(modelM3.Id, "Competition xDrive", "Automatic", FuelType.Petrol, 2993, 503, 2021);
        context.VehicleVariants.Add(m3Variant);
        await context.SaveChangesAsync();

        var service = new CustomerVehicleService(context);

        // Request assigns M3 variant to 3 Series model
        var request = new CreateCustomerVehicleRequest(
            ManufacturerId: bmw.Id,
            ModelId: model3Series.Id, // Model is 3 Series
            VariantId: m3Variant.Id,   // Variant belongs to M3!
            Year: 2022,
            FuelType: FuelType.Petrol,
            Transmission: "Automatic",
            LicensePlate: "MISMATCH",
            Vin: "",
            Mileage: 1000,
            Color: "Red",
            IsPrimary: false
        );

        // Act
        Func<Task> act = async () => await service.AddVehicleAsync(customerProfile.Id, request);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*does not belong to model*");
    }

    [Fact]
    public async Task AddVehicle_YearOutOfRange_ThrowsArgumentOutOfRangeException()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var customerProfile = new CustomerProfile(Guid.NewGuid(), "123 Street", "Email");
        context.CustomerProfiles.Add(customerProfile);

        var porsche = new VehicleManufacturer("Porsche", "Germany", "/logos/porsche.svg", 1);
        context.VehicleManufacturers.Add(porsche);
        await context.SaveChangesAsync();

        var model992 = new VehicleModel(porsche.Id, "911", "Coupe", 2019, 2025);
        context.VehicleModels.Add(model992);
        await context.SaveChangesAsync();

        var service = new CustomerVehicleService(context);

        // 2010 is outside 2019-2025
        var request = new CreateCustomerVehicleRequest(
            ManufacturerId: porsche.Id,
            ModelId: model992.Id,
            VariantId: null,
            Year: 2010,
            FuelType: FuelType.Petrol,
            Transmission: "Dual-Clutch",
            LicensePlate: "TOO-OLD",
            Vin: "",
            Mileage: 50000,
            Color: "Silver",
            IsPrimary: false
        );

        // Act
        Func<Task> act = async () => await service.AddVehicleAsync(customerProfile.Id, request);

        // Assert
        await act.Should().ThrowAsync<ArgumentOutOfRangeException>()
            .WithMessage("*Model year 2010 is invalid*");
    }

    [Fact]
    public async Task CustomerDataIsolation_CustomerCannotAccessAnotherCustomersVehicle()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var customerA = Guid.NewGuid();
        var customerB = Guid.NewGuid();

        var vehicleA = new CustomerVehicle(customerA, "BMW", "3 Series", 2022, "CUST-A");
        var vehicleB = new CustomerVehicle(customerB, "Audi", "A4", 2021, "CUST-B");
        context.CustomerVehicles.AddRange(vehicleA, vehicleB);
        await context.SaveChangesAsync();

        var service = new CustomerVehicleService(context);

        // Act: Customer A queries vehicle B
        var vehicleQueryResult = await service.GetCustomerVehicleByIdAsync(customerA, vehicleB.Id);

        // Assert: Returns null (strictly isolated)
        vehicleQueryResult.Should().BeNull();
    }

    [Fact]
    public async Task CustomerDataIsolation_CustomerCannotDeleteAnotherCustomersVehicle()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var customerA = Guid.NewGuid();
        var customerB = Guid.NewGuid();

        var vehicleB = new CustomerVehicle(customerB, "Audi", "A4", 2021, "CUST-B");
        context.CustomerVehicles.Add(vehicleB);
        await context.SaveChangesAsync();

        var service = new CustomerVehicleService(context);

        // Act: Customer A attempts to delete customer B's vehicle
        Func<Task> act = async () => await service.DeleteVehicleAsync(customerA, vehicleB.Id);

        // Assert
        await act.Should().ThrowAsync<KeyNotFoundException>();
        vehicleB.IsActive.Should().BeTrue();
    }

    [Fact]
    public async Task SetPrimaryVehicle_PromotesTargetAndDemotesPreviousPrimary()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var customerId = Guid.NewGuid();

        var vehicle1 = new CustomerVehicle(customerId, "BMW", "M3", 2022, "PLATE-1");
        vehicle1.SetPrimary(true);
        var vehicle2 = new CustomerVehicle(customerId, "Porsche", "911", 2023, "PLATE-2");
        vehicle2.SetPrimary(false);

        context.CustomerVehicles.AddRange(vehicle1, vehicle2);
        await context.SaveChangesAsync();

        var service = new CustomerVehicleService(context);

        // Act: Set vehicle2 as primary
        var result = await service.SetPrimaryVehicleAsync(customerId, vehicle2.Id);

        // Assert
        result.Should().BeTrue();
        var updated1 = await context.CustomerVehicles.FindAsync(vehicle1.Id);
        var updated2 = await context.CustomerVehicles.FindAsync(vehicle2.Id);

        updated1!.IsPrimary.Should().BeFalse();
        updated2!.IsPrimary.Should().BeTrue();
    }
}
