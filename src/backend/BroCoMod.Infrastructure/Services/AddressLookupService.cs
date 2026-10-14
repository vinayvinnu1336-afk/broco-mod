using System.Globalization;
using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace BroCoMod.Infrastructure.Services;

/// <summary>
/// Pin to address for the booking form: asks each available provider in turn (Google when a server
/// key is set, then OpenStreetMap unless switched off) and remembers answers per ~10 m square.
/// </summary>
public class AddressLookupService : IAddressLookupService
{
    private readonly IReadOnlyList<IReverseGeocodingProvider> _providers;
    private readonly ReverseGeocodeCache _cache;
    private readonly ILogger<AddressLookupService> _logger;

    public AddressLookupService(IEnumerable<IReverseGeocodingProvider> providers, ReverseGeocodeCache cache, ILogger<AddressLookupService> logger)
    {
        _providers = providers.ToList();
        _cache = cache;
        _logger = logger;
    }

    public string? ActiveProvider => _providers.FirstOrDefault(p => p.IsAvailable)?.Name;

    public async Task<AddressLookupDto?> ReverseAsync(double latitude, double longitude, CancellationToken ct = default)
    {
        if (_cache.TryGet(latitude, longitude, out var cached)) return cached;

        foreach (var provider in _providers.Where(p => p.IsAvailable))
        {
            var address = await provider.ReverseAsync(latitude, longitude, ct);
            if (address != null)
            {
                _cache.Set(latitude, longitude, address);
                return address;
            }
            _logger.LogInformation("{Provider} found no address for the pin; trying the next provider", provider.Name);
        }
        return null;
    }
}

/// <summary>Small process-wide cache of found addresses, keyed by coordinates rounded to 4 decimals (~11 m).</summary>
public sealed class ReverseGeocodeCache : IDisposable
{
    private static readonly TimeSpan Lifetime = TimeSpan.FromHours(12);
    private readonly MemoryCache _cache = new(new MemoryCacheOptions { SizeLimit = 5000 });

    public static string Key(double latitude, double longitude) =>
        string.Create(CultureInfo.InvariantCulture, $"{Math.Round(latitude, 4):F4},{Math.Round(longitude, 4):F4}");

    public bool TryGet(double latitude, double longitude, out AddressLookupDto? address) =>
        _cache.TryGetValue(Key(latitude, longitude), out address);

    public void Set(double latitude, double longitude, AddressLookupDto address) =>
        _cache.Set(Key(latitude, longitude), address, new MemoryCacheEntryOptions { Size = 1, AbsoluteExpirationRelativeToNow = Lifetime });

    public void Dispose() => _cache.Dispose();
}
