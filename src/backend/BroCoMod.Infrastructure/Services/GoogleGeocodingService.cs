using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace BroCoMod.Infrastructure.Services;

/// <summary>
/// Reverse geocoding through the Google Geocoding API. Needs <c>GoogleMaps:ServerApiKey</c>
/// (a key restricted to the Geocoding API and the server's IP, separate from the browser key).
/// Serves both the booking pincode/pin cross-check and the address autofill. Without a key every
/// lookup returns null and callers fall back (offline checks, OpenStreetMap).
/// </summary>
public class GoogleGeocodingService : IGeocodingService, IReverseGeocodingProvider
{
    public const string ProviderName = "Google";

    private readonly HttpClient _http;
    private readonly ILogger<GoogleGeocodingService> _logger;
    private readonly string? _apiKey;

    public GoogleGeocodingService(HttpClient http, IConfiguration configuration, ILogger<GoogleGeocodingService> logger)
    {
        _http = http;
        _logger = logger;
        _apiKey = GeocodingSettings.ServerKey(configuration);
    }

    public string Name => ProviderName;
    public bool IsConfigured => !string.IsNullOrWhiteSpace(_apiKey);
    public bool IsAvailable => IsConfigured;

    public async Task<ReverseGeocodeResult?> ReverseGeocodeAsync(double latitude, double longitude, CancellationToken ct = default)
    {
        var address = await ReverseAsync(latitude, longitude, ct);
        return address == null ? null : new ReverseGeocodeResult(address.Pincode, address.City, address.State, address.FormattedAddress);
    }

    public async Task<AddressLookupDto?> ReverseAsync(double latitude, double longitude, CancellationToken ct = default)
    {
        if (!IsConfigured) return null;

        var url = string.Create(CultureInfo.InvariantCulture,
            $"https://maps.googleapis.com/maps/api/geocode/json?latlng={latitude},{longitude}&key={Uri.EscapeDataString(_apiKey!)}&region=in&language=en");
        try
        {
            using var response = await _http.GetAsync(url, ct);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Google reverse geocoding answered HTTP {Status}", (int)response.StatusCode);
                return null;
            }
            var body = JsonSerializer.Deserialize<GeocodeResponse>(await response.Content.ReadAsStringAsync(ct));
            if (body is { Status: not "OK" and not "ZERO_RESULTS" })
            {
                // REQUEST_DENIED / OVER_QUERY_LIMIT usually mean the key, its restrictions or billing need fixing.
                _logger.LogWarning("Google reverse geocoding returned {Status}: {Message}", body.Status, body.ErrorMessage);
            }
            return Parse(body);
        }
        catch (Exception ex) when (ex is HttpRequestException or JsonException || (ex is TaskCanceledException && !ct.IsCancellationRequested))
        {
            _logger.LogWarning(ex, "Google reverse geocoding failed");
            return null;
        }
    }

    /// <summary>Turns a Geocoding API JSON answer into booking-form fields (null when nothing usable).</summary>
    public static AddressLookupDto? Parse(string json) => Parse(JsonSerializer.Deserialize<GeocodeResponse>(json));

    private static AddressLookupDto? Parse(GeocodeResponse? response)
    {
        if (response == null || response.Status != "OK" || response.Results.Count == 0) return null;

        // Plus-code results carry little more than the city; prefer the most specific real address.
        var results = response.Results.Where(r => !r.Types.Contains("plus_code")).ToList();
        if (results.Count == 0) return null;
        var best =
            results.FirstOrDefault(r => r.Types.Any(t => t is "street_address" or "premise" or "subpremise")) ??
            results.FirstOrDefault(r => r.Types.Contains("route")) ??
            results.FirstOrDefault(r => r.AddressComponents.Any(c => c.Types.Contains("postal_code"))) ??
            results[0];
        // Broader parts (area, city, pincode) may only be on a less specific result for the same point.
        var ordered = new[] { best }.Concat(results.Where(r => r != best)).ToList();

        string? InBest(params string[] types) => FindIn(best, types);
        string? Anywhere(params string[] types) => ordered.Select(r => FindIn(r, types)).FirstOrDefault(v => v != null);

        var house = AddressText.Join(InBest("subpremise"), InBest("premise"), InBest("street_number"));
        var area = AddressText.Clean(Anywhere("sublocality_level_1") ?? Anywhere("sublocality") ?? Anywhere("neighborhood"));
        var route = InBest("route");
        if (route != null && route.StartsWith("Unnamed", StringComparison.OrdinalIgnoreCase)) route = null;
        var street = AddressText.Join(new[] { route, InBest("sublocality_level_3"), InBest("sublocality_level_2", "neighborhood") }
            .Where(p => p == null || !p.Equals(area, StringComparison.OrdinalIgnoreCase))
            .ToArray());
        var city = AddressText.Clean(Anywhere("locality") ?? Anywhere("administrative_area_level_3") ?? Anywhere("administrative_area_level_2"));
        var state = AddressText.Clean(Anywhere("administrative_area_level_1"));
        var pincode = AddressText.Pincode(Anywhere("postal_code"));
        if (street == null && area == null && city == null && pincode == null) return null;

        var formatted = AddressText.Clean(best.FormattedAddress) ?? AddressText.Formatted(house, street, area, city, state, pincode);
        return new AddressLookupDto(house, street, area, city, state, pincode, formatted, ProviderName);
    }

    private static string? FindIn(GeocodeResult result, params string[] types)
    {
        foreach (var type in types)
        {
            var match = result.AddressComponents.FirstOrDefault(c => c.Types.Contains(type));
            if (!string.IsNullOrWhiteSpace(match?.LongName)) return match.LongName;
        }
        return null;
    }

    private sealed class GeocodeResponse
    {
        [JsonPropertyName("status")] public string Status { get; set; } = string.Empty;
        [JsonPropertyName("error_message")] public string? ErrorMessage { get; set; }
        [JsonPropertyName("results")] public List<GeocodeResult> Results { get; set; } = new();
    }

    private sealed class GeocodeResult
    {
        [JsonPropertyName("formatted_address")] public string? FormattedAddress { get; set; }
        [JsonPropertyName("types")] public List<string> Types { get; set; } = new();
        [JsonPropertyName("address_components")] public List<AddressComponent> AddressComponents { get; set; } = new();
    }

    private sealed class AddressComponent
    {
        [JsonPropertyName("long_name")] public string LongName { get; set; } = string.Empty;
        [JsonPropertyName("types")] public List<string> Types { get; set; } = new();
    }
}
