using NetTopologySuite.Geometries;

namespace BroCoMod.Application.Interfaces;

public record EligibleGarageMatch(
    Guid GarageId,
    string GarageName,
    string Email,
    string PhoneNumber,
    string Address,
    double DistanceKm,
    Point Location
);

public interface IGarageMatchingService
{
    /// <summary>
    /// Verified, active, operational garages within the radius (and their own service radius), nearest first.
    /// With <paramref name="city"/>, only garages of that city: a booking is only handled by its city's garages.
    /// </summary>
    Task<IReadOnlyList<EligibleGarageMatch>> FindEligibleGaragesAsync(
        Point customerLocation,
        double? radiusKm = null,
        CancellationToken cancellationToken = default,
        string? city = null);
}
