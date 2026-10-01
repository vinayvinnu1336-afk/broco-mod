using BroCoMod.Domain.Enums;

namespace BroCoMod.Application.DTOs;

public record ServiceRequestDto(
    Guid Id,
    Guid CustomerId,
    string VehicleMake,
    string VehicleModel,
    int VehicleYear,
    string Description,
    double Longitude,
    double Latitude,
    double RadiusKm,
    ServiceRequestStatus Status,
    DateTime CreatedAtUtc,
    CustomerQuoteViewDto? CustomerQuotation
);

public record CreateServiceRequestDto(
    Guid CustomerId,
    string VehicleMake,
    string VehicleModel,
    int VehicleYear,
    string Description,
    double Longitude,
    double Latitude,
    double? RadiusKm
);

public record GarageDto(
    Guid Id,
    string Name,
    string Email,
    string PhoneNumber,
    string Address,
    double Longitude,
    double Latitude,
    double DistanceKm,
    bool IsActive
);

public record CreateGarageDto(
    string Name,
    string Email,
    string PhoneNumber,
    string Address,
    double Longitude,
    double Latitude
);
