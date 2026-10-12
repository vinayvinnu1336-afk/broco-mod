using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using Microsoft.Extensions.Configuration;

namespace BroCoMod.Infrastructure.Services;

/// <summary>
/// Cities come from the <c>ServiceAreas</c> configuration section. Only areas with <c>IsLive = true</c>
/// accept bookings; the rest are shown as "coming soon".
/// </summary>
public class ServiceAreaService : IServiceAreaService
{
    private sealed class AreaOptions
    {
        public string City { get; set; } = string.Empty;
        public string State { get; set; } = string.Empty;
        public double Latitude { get; set; }
        public double Longitude { get; set; }
        public double RadiusKm { get; set; } = 40;
        public bool IsLive { get; set; }
        public List<string> PincodePrefixes { get; set; } = new();
    }

    private static readonly AreaOptions[] Defaults =
    {
        new() { City = "Hyderabad", State = "Telangana", Latitude = 17.385, Longitude = 78.4867, RadiusKm = 40, IsLive = true, PincodePrefixes = new() { "500", "501", "502" } },
    };

    private readonly List<AreaOptions> _areas;

    public ServiceAreaService(IConfiguration configuration)
    {
        var configured = configuration.GetSection("ServiceAreas").Get<List<AreaOptions>>();
        _areas = configured is { Count: > 0 } ? configured : Defaults.ToList();
    }

    public IReadOnlyList<ServiceAreaDto> GetAreas() =>
        _areas.Select(ToDto).ToList();

    public ServiceAreaDto? FindLiveAreaFor(double latitude, double longitude)
    {
        var match = _areas
            .Where(a => a.IsLive)
            .Select(a => (Area: a, Distance: DistanceKm(latitude, longitude, a.Latitude, a.Longitude)))
            .Where(x => x.Distance <= x.Area.RadiusKm)
            .OrderBy(x => x.Distance)
            .Select(x => x.Area)
            .FirstOrDefault();
        return match == null ? null : ToDto(match);
    }

    public bool IsPincodeServed(ServiceAreaDto area, string pincode)
    {
        var options = _areas.FirstOrDefault(a => string.Equals(a.City, area.City, StringComparison.OrdinalIgnoreCase));
        if (options == null || options.PincodePrefixes.Count == 0) return true;
        var digits = new string((pincode ?? string.Empty).Where(char.IsDigit).ToArray());
        return digits.Length == 6 && options.PincodePrefixes.Any(p => digits.StartsWith(p, StringComparison.Ordinal));
    }

    private static ServiceAreaDto ToDto(AreaOptions a) =>
        new(a.City, a.State, a.Latitude, a.Longitude, a.RadiusKm, a.IsLive);

    /// <summary>Great-circle distance in kilometres.</summary>
    public static double DistanceKm(double lat1, double lon1, double lat2, double lon2)
    {
        const double earthRadiusKm = 6371.0;
        var dLat = (lat2 - lat1) * Math.PI / 180.0;
        var dLon = (lon2 - lon1) * Math.PI / 180.0;
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(lat1 * Math.PI / 180.0) * Math.Cos(lat2 * Math.PI / 180.0) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return earthRadiusKm * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }
}
