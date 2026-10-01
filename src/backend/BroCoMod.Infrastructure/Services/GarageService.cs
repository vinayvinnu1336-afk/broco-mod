using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

namespace BroCoMod.Infrastructure.Services;

public class GarageService : IGarageService
{
    private readonly IApplicationDbContext _context;

    public GarageService(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<GarageDto>> FindEligibleGaragesAsync(
        double longitude,
        double latitude,
        double radiusKm = 10.0,
        CancellationToken cancellationToken = default)
    {
        var radiusMeters = radiusKm * 1000.0;
        var customerPoint = new Point(longitude, latitude) { SRID = 4326 };

        // PostGIS geography spatial query: calculates distance in meters on the WGS84 spheroid
        var query = await _context.Garages
            .AsNoTracking()
            .Where(g => g.IsActive && g.Location.Distance(customerPoint) <= radiusMeters)
            .Select(g => new
            {
                Garage = g,
                DistanceMeters = g.Location.Distance(customerPoint)
            })
            .OrderBy(x => x.DistanceMeters)
            .ToListAsync(cancellationToken);

        return query.Select(x => new GarageDto(
            x.Garage.Id,
            x.Garage.Name,
            x.Garage.Email,
            x.Garage.PhoneNumber,
            x.Garage.Address,
            x.Garage.Location.X,
            x.Garage.Location.Y,
            Math.Round(x.DistanceMeters / 1000.0, 2),
            x.Garage.IsActive
        ));
    }

    public async Task<GarageDto> RegisterGarageAsync(
        CreateGarageDto dto,
        CancellationToken cancellationToken = default)
    {
        var garage = new Garage(
            dto.Name,
            dto.Email,
            dto.PhoneNumber,
            dto.Address,
            dto.Longitude,
            dto.Latitude
        );

        _context.Garages.Add(garage);
        await _context.SaveChangesAsync(cancellationToken);

        return new GarageDto(
            garage.Id,
            garage.Name,
            garage.Email,
            garage.PhoneNumber,
            garage.Address,
            garage.Location.X,
            garage.Location.Y,
            0.0,
            garage.IsActive
        );
    }
}
