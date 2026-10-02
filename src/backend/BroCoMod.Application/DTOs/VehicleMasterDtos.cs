using System.ComponentModel.DataAnnotations;
using BroCoMod.Domain.Enums;

namespace BroCoMod.Application.DTOs;

public record VehicleManufacturerDto(
    Guid Id,
    string Name,
    string Country,
    string LogoUrl,
    bool IsActive,
    int DisplayOrder,
    int ModelsCount
);

public record VehicleModelDto(
    Guid Id,
    Guid ManufacturerId,
    string ManufacturerName,
    string Name,
    string BodyType,
    int YearFrom,
    int? YearTo,
    bool IsActive,
    int VariantsCount
);

public record VehicleVariantDto(
    Guid Id,
    Guid ModelId,
    string ModelName,
    string Name,
    string Transmission,
    string FuelType,
    int? EngineDisplacementCc,
    int? Horsepower,
    int YearFrom,
    int? YearTo,
    bool IsActive
);

public record VehicleFuelTypeDto(
    int Value,
    string Name,
    string DisplayName
);

public record CustomerVehicleDetailDto(
    Guid Id,
    Guid CustomerId,
    Guid ManufacturerId,
    string Make,
    Guid ModelId,
    string Model,
    Guid? VariantId,
    string? VariantName,
    int Year,
    string FuelType,
    string Transmission,
    string LicensePlate,
    string Vin,
    int Mileage,
    string Color,
    bool IsPrimary,
    bool IsActive,
    DateTime CreatedAtUtc
);

public record CreateCustomerVehicleRequest(
    [Required] Guid ManufacturerId,
    [Required] Guid ModelId,
    Guid? VariantId,
    [Range(1950, 2050)] int Year,
    [Required] FuelType FuelType,
    string? Transmission,
    [Required, StringLength(30, MinimumLength = 2)] string LicensePlate,
    string? Vin,
    [Range(0, 2000000)] int Mileage,
    string? Color,
    bool IsPrimary = false
);

public record UpdateCustomerVehicleRequest(
    [Required] Guid ManufacturerId,
    [Required] Guid ModelId,
    Guid? VariantId,
    [Range(1950, 2050)] int Year,
    [Required] FuelType FuelType,
    string? Transmission,
    [Required, StringLength(30, MinimumLength = 2)] string LicensePlate,
    string? Vin,
    [Range(0, 2000000)] int Mileage,
    string? Color,
    bool IsPrimary = false
);
