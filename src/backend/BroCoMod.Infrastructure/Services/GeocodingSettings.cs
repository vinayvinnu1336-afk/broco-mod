using Microsoft.Extensions.Configuration;

namespace BroCoMod.Infrastructure.Services;

/// <summary>
/// Google Maps keys and the address-lookup fallback. Keys come from <c>GoogleMaps:*</c>
/// (docker compose maps the .env values there) or straight from the <c>GOOGLE_MAPS_*</c>
/// environment variables when the API runs without compose.
/// </summary>
public static class GeocodingSettings
{
    public const string OpenStreetMap = "OpenStreetMap";
    public const string None = "None";
    public const string DefaultNominatimUrl = "https://nominatim.openstreetmap.org/";

    /// <summary>Server key: Geocoding API only (pin to address, pincode check).</summary>
    public static string? ServerKey(IConfiguration configuration) =>
        FirstNonEmpty(configuration["GoogleMaps:ServerApiKey"], configuration["GOOGLE_MAPS_SERVER_KEY"]);

    /// <summary>Browser key: Maps JavaScript API + Places API, handed to the website at runtime.</summary>
    public static string? BrowserKey(IConfiguration configuration) =>
        FirstNonEmpty(configuration["GoogleMaps:BrowserApiKey"], configuration["GOOGLE_MAPS_BROWSER_KEY"]);

    /// <summary><c>Geocoding:FallbackProvider</c>: "OpenStreetMap" (default, also when empty) or anything else to switch it off.</summary>
    public static string FallbackProvider(IConfiguration configuration)
    {
        var value = configuration["Geocoding:FallbackProvider"]?.Trim();
        return string.IsNullOrEmpty(value) || value.Equals(OpenStreetMap, StringComparison.OrdinalIgnoreCase) ? OpenStreetMap : None;
    }

    public static string NominatimUrl(IConfiguration configuration)
    {
        var url = FirstNonEmpty(configuration["Geocoding:NominatimUrl"]) ?? DefaultNominatimUrl;
        return url.EndsWith('/') ? url : url + "/";
    }

    private static string? FirstNonEmpty(params string?[] values) =>
        values.Select(v => v?.Trim()).FirstOrDefault(v => !string.IsNullOrEmpty(v));
}
