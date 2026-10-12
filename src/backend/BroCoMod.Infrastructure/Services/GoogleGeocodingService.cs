using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using BroCoMod.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace BroCoMod.Infrastructure.Services;

/// <summary>
/// Reverse geocoding through the Google Geocoding API. Needs <c>GoogleMaps:ServerApiKey</c>
/// (a key restricted to the server's IP, separate from the browser key). Without a key every
/// lookup returns null and callers fall back to their offline checks.
/// </summary>
public class GoogleGeocodingService : IGeocodingService
{
    private readonly HttpClient _http;
    private readonly ILogger<GoogleGeocodingService> _logger;
    private readonly string? _apiKey;

    public GoogleGeocodingService(HttpClient http, IConfiguration configuration, ILogger<GoogleGeocodingService> logger)
    {
        _http = http;
        _logger = logger;
        _apiKey = configuration["GoogleMaps:ServerApiKey"];
    }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_apiKey);

    public async Task<ReverseGeocodeResult?> ReverseGeocodeAsync(double latitude, double longitude, CancellationToken ct = default)
    {
        if (!IsConfigured) return null;

        var url = string.Create(CultureInfo.InvariantCulture,
            $"https://maps.googleapis.com/maps/api/geocode/json?latlng={latitude},{longitude}&key={Uri.EscapeDataString(_apiKey!)}&region=in");
        try
        {
            var response = await _http.GetFromJsonAsync<GeocodeResponse>(url, ct);
            if (response == null || response.Status != "OK" || response.Results.Count == 0)
            {
                _logger.LogWarning("Reverse geocoding returned {Status}", response?.Status ?? "no response");
                return null;
            }

            string? Find(string type) => response.Results
                .SelectMany(r => r.AddressComponents)
                .FirstOrDefault(c => c.Types.Contains(type))?.LongName;

            return new ReverseGeocodeResult(
                Pincode: Find("postal_code"),
                City: Find("locality") ?? Find("administrative_area_level_3"),
                State: Find("administrative_area_level_1"),
                FormattedAddress: response.Results[0].FormattedAddress ?? string.Empty);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException)
        {
            _logger.LogWarning(ex, "Reverse geocoding failed");
            return null;
        }
    }

    private sealed class GeocodeResponse
    {
        [JsonPropertyName("status")] public string Status { get; set; } = string.Empty;
        [JsonPropertyName("results")] public List<GeocodeResult> Results { get; set; } = new();
    }

    private sealed class GeocodeResult
    {
        [JsonPropertyName("formatted_address")] public string? FormattedAddress { get; set; }
        [JsonPropertyName("address_components")] public List<AddressComponent> AddressComponents { get; set; } = new();
    }

    private sealed class AddressComponent
    {
        [JsonPropertyName("long_name")] public string LongName { get; set; } = string.Empty;
        [JsonPropertyName("types")] public List<string> Types { get; set; } = new();
    }
}
