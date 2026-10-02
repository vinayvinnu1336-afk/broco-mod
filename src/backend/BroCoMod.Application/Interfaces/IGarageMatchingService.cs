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
    Task<IReadOnlyList<EligibleGarageMatch>> FindEligibleGaragesAsync(
        Point customerLocation,
        double? radiusKm = null,
        CancellationToken cancellationToken = default);
}
