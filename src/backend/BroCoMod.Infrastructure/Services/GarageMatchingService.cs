using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using NetTopologySuite.Geometries;

namespace BroCoMod.Infrastructure.Services;

public class GarageMatchingService : IGarageMatchingService
{
    private readonly IApplicationDbContext _context;
    private readonly double _defaultRadiusKm;

    public GarageMatchingService(IApplicationDbContext context, IConfiguration configuration)
    {
        _context = context;
        if (!double.TryParse(configuration["PlatformSettings:DefaultSearchRadiusKm"], out _defaultRadiusKm) || _defaultRadiusKm <= 0)
        {
            _defaultRadiusKm = 10.0;
        }
    }

    public async Task<IReadOnlyList<EligibleGarageMatch>> FindEligibleGaragesAsync(
        Point customerLocation,
        double? radiusKm = null,
        CancellationToken cancellationToken = default)
    {
        if (customerLocation == null)
        {
            throw new ArgumentNullException(nameof(customerLocation));
        }

        var searchRadiusKm = (radiusKm.HasValue && radiusKm.Value > 0) ? radiusKm.Value : _defaultRadiusKm;
        var radiusMeters = searchRadiusKm * 1000.0;

        // Check if running on InMemory database (used in unit tests)
        var isInMemory = _context is DbContext dbCtx && dbCtx.Database.ProviderName == "Microsoft.EntityFrameworkCore.InMemory";

        if (isInMemory)
        {
            // In-Memory test fallback: evaluate eligibility & calculate distance via geodesic Haversine
            var allGarages = await _context.Garages
                .AsNoTracking()
                .Where(g => g.IsActive && g.IsVerified && g.IsOperational && g.Location != null)
                .ToListAsync(cancellationToken);

            var matches = new List<EligibleGarageMatch>();
            foreach (var g in allGarages)
            {
                var distanceMeters = CalculateHaversineDistanceMeters(
                    customerLocation.Y, customerLocation.X,
                    g.Location.Y, g.Location.X);

                if (distanceMeters <= radiusMeters)
                {
                    matches.Add(new EligibleGarageMatch(
                        g.Id,
                        g.Name,
                        g.Email,
                        g.PhoneNumber,
                        g.Address,
                        Math.Round(distanceMeters / 1000.0, 2),
                        g.Location));
                }
            }

            return matches.OrderBy(m => m.DistanceKm).ToList();
        }

        // PostGIS production query: ST_DWithin & ST_Distance on geography(Point, 4326)
        // PostGIS geography distance is calculated on the WGS84 spheroid in meters.
        var eligibleQuery = await _context.Garages
            .AsNoTracking()
            .Where(g => g.IsActive 
                        && g.IsVerified 
                        && g.IsOperational 
                        && g.Location != null 
                        && g.Location.Distance(customerLocation) <= radiusMeters)
            .Select(g => new
            {
                g.Id,
                g.Name,
                g.Email,
                g.PhoneNumber,
                g.Address,
                g.Location,
                DistanceMeters = g.Location.Distance(customerLocation)
            })
            .OrderBy(x => x.DistanceMeters)
            .ToListAsync(cancellationToken);

        return eligibleQuery.Select(x => new EligibleGarageMatch(
            x.Id,
            x.Name,
            x.Email,
            x.PhoneNumber,
            x.Address,
            Math.Round(x.DistanceMeters / 1000.0, 2),
            x.Location
        )).ToList();
    }

    private static double CalculateHaversineDistanceMeters(double lat1, double lon1, double lat2, double lon2)
    {
        const double r = 6371000.0; // Earth radius in meters
        var dLat = (lat2 - lat1) * Math.PI / 180.0;
        var dLon = (lon2 - lon1) * Math.PI / 180.0;

        var a = Math.Sin(dLat / 2.0) * Math.Sin(dLat / 2.0) +
                Math.Cos(lat1 * Math.PI / 180.0) * Math.Cos(lat2 * Math.PI / 180.0) *
                Math.Sin(dLon / 2.0) * Math.Sin(dLon / 2.0);

        var c = 2.0 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1.0 - a));
        return r * c;
    }
}
