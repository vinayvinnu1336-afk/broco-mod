using BroCoMod.Application.DTOs;

namespace BroCoMod.Application.Interfaces;

/// <summary>
/// One reverse-geocoding source (Google, OpenStreetMap, or a fake in tests). Providers are tried in
/// registration order and the first one that is available and finds an address wins.
/// </summary>
public interface IReverseGeocodingProvider
{
    string Name { get; }
    bool IsAvailable { get; }
    Task<AddressLookupDto?> ReverseAsync(double latitude, double longitude, CancellationToken ct = default);
}

/// <summary>Turns a pin into booking-form address fields ("Use my current location", map pins).</summary>
public interface IAddressLookupService
{
    /// <summary>Name of the provider that would answer first, or null when address lookup is switched off.</summary>
    string? ActiveProvider { get; }

    /// <summary>Null when no provider is available or none of them found an address.</summary>
    Task<AddressLookupDto?> ReverseAsync(double latitude, double longitude, CancellationToken ct = default);
}
