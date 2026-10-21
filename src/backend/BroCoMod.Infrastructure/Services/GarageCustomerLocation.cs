using BroCoMod.Application.DTOs;
using BroCoMod.Domain.Constants;
using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Enums;

namespace BroCoMod.Infrastructure.Services;

/// <summary>
/// What the garage doing a job may know about where the car is and what the job covers. Only call these for
/// the garage that holds the (non-cancelled) ServiceJob; garages that only quoted see the area and distance.
/// </summary>
internal static class GarageCustomerLocation
{
    public static bool IsVisibleFor(ServiceJobStatus status) => status != ServiceJobStatus.Cancelled;

    /// <summary>The customer's address and pin plus the workshop's pin. Null when the request has no location at all.</summary>
    public static GarageCustomerLocationDto? For(ServiceRequest? request, Garage? garage)
    {
        if (request == null) return null;
        var location = request.ServiceLocation;
        double lat, lng;
        if (location != null)
        {
            lat = location.Latitude;
            lng = location.Longitude;
        }
        else if (request.CustomerLocation != null)
        {
            lat = request.CustomerLocation.Y;
            lng = request.CustomerLocation.X;
        }
        else
        {
            return null;
        }

        double? workshopLat = garage?.Location?.Y;
        double? workshopLng = garage?.Location?.X;
        double? distance = workshopLat.HasValue && workshopLng.HasValue
            ? Math.Round(ServiceAreaService.DistanceKm(workshopLat.Value, workshopLng.Value, lat, lng), 1)
            : null;

        return new GarageCustomerLocationDto(
            AddressLine1: location?.AddressLine1 ?? string.Empty,
            AddressLine2: location?.AddressLine2,
            City: location?.City ?? string.Empty,
            State: location?.State ?? string.Empty,
            Pincode: location?.Pincode ?? string.Empty,
            FormattedAddress: location?.FormattedAddress ?? string.Empty,
            Latitude: lat,
            Longitude: lng,
            WorkshopLatitude: workshopLat,
            WorkshopLongitude: workshopLng,
            WorkshopAddress: garage?.Address,
            DistanceKm: distance);
    }

    /// <summary>
    /// The work the job covers, one line each: the package's catalogue items for package bookings, otherwise the
    /// accepted quotation's line descriptions, otherwise the services the customer picked.
    /// </summary>
    public static IReadOnlyList<string> ServiceItems(ServiceRequest? request, CustomerQuotation? quotation, IReadOnlyList<string>? packageIncludes)
    {
        if (packageIncludes is { Count: > 0 }) return packageIncludes;

        var quoted = quotation?.LineItems
            .OrderBy(li => li.SortOrder)
            .Select(li => li.Description.Trim())
            .Where(d => d.Length > 0)
            .Distinct()
            .ToList();
        if (quoted is { Count: > 0 }) return quoted;

        return ServiceCategories.Split(request?.ServiceCategory);
    }
}
