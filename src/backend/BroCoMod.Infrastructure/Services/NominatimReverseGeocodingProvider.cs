using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace BroCoMod.Infrastructure.Services;

/// <summary>
/// Free fallback while no Google server key is configured: OpenStreetMap's public Nominatim server.
/// Its usage policy asks for an identifying User-Agent, at most one request per second and caching
/// (see <see cref="NominatimRateGate"/> and <see cref="ReverseGeocodeCache"/>), and the website must
/// show "© OpenStreetMap contributors" next to the data. Switch off with Geocoding:FallbackProvider=None.
/// </summary>
public partial class NominatimReverseGeocodingProvider : IReverseGeocodingProvider
{
    public const string ProviderName = "OpenStreetMap";
    public const string UserAgent = "BroCo/1.0 (+https://github.com/vinayvinnu1336-afk/broco-mod)";
    private static readonly TimeSpan MaxQueueWait = TimeSpan.FromSeconds(3);

    private readonly HttpClient _http;
    private readonly NominatimRateGate _gate;
    private readonly ILogger<NominatimReverseGeocodingProvider> _logger;
    private readonly bool _enabled;
    private readonly string _baseUrl;

    public NominatimReverseGeocodingProvider(HttpClient http, NominatimRateGate gate, IConfiguration configuration, ILogger<NominatimReverseGeocodingProvider> logger)
    {
        _http = http;
        _gate = gate;
        _logger = logger;
        _enabled = GeocodingSettings.FallbackProvider(configuration) == GeocodingSettings.OpenStreetMap;
        _baseUrl = GeocodingSettings.NominatimUrl(configuration);
    }

    public string Name => ProviderName;
    public bool IsAvailable => _enabled;

    public async Task<AddressLookupDto?> ReverseAsync(double latitude, double longitude, CancellationToken ct = default)
    {
        if (!_enabled) return null;
        if (!await _gate.WaitTurnAsync(MaxQueueWait, ct))
        {
            _logger.LogWarning("OpenStreetMap address lookup skipped: too many lookups waiting");
            return null;
        }

        var url = string.Create(CultureInfo.InvariantCulture,
            $"{_baseUrl}reverse?format=jsonv2&lat={latitude:0.######}&lon={longitude:0.######}&addressdetails=1&zoom=18&accept-language=en");
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.TryAddWithoutValidation("User-Agent", UserAgent);
            using var response = await _http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("OpenStreetMap address lookup answered HTTP {Status}", (int)response.StatusCode);
                return null;
            }
            return Parse(await response.Content.ReadAsStringAsync(ct));
        }
        catch (Exception ex) when (ex is HttpRequestException or JsonException || (ex is TaskCanceledException && !ct.IsCancellationRequested))
        {
            _logger.LogWarning(ex, "OpenStreetMap address lookup failed");
            return null;
        }
    }

    /// <summary>Turns a Nominatim <c>/reverse?format=jsonv2&amp;addressdetails=1</c> answer into booking-form fields.</summary>
    public static AddressLookupDto? Parse(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        if (root.ValueKind != JsonValueKind.Object || root.TryGetProperty("error", out _)) return null;
        if (!root.TryGetProperty("address", out var address) || address.ValueKind != JsonValueKind.Object) return null;

        string? Get(params string[] keys)
        {
            foreach (var key in keys)
            {
                if (address.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(v.GetString()))
                    return v.GetString();
            }
            return null;
        }

        // Hyderabad suburbs are often tagged with their GHMC ward ("Ward 93 Banjara Hills").
        var area = Locality(Get("suburb")) ?? Locality(Get("quarter")) ?? Locality(Get("neighbourhood"))
                   ?? Locality(Get("village")) ?? Locality(Get("town")) ?? Locality(Get("city_district"));
        var neighbourhood = Locality(Get("neighbourhood"));
        var street = AddressText.Join(
            Get("road", "pedestrian", "footway"),
            neighbourhood != null && !neighbourhood.Equals(area, StringComparison.OrdinalIgnoreCase) ? neighbourhood : null);
        var house = AddressText.Clean(Get("house_number", "house_name"));
        var city = AddressText.Clean(Locality(Get("city")) ?? Locality(Get("town")) ?? Locality(Get("municipality")) ?? Locality(Get("state_district")));
        var state = AddressText.Clean(Get("state"));
        var pincode = AddressText.Pincode(Get("postcode"));
        if (street == null && area == null && city == null && pincode == null) return null;

        // display_name lists every admin level (ward, zone, mandal...), so build a readable one instead.
        var formatted = AddressText.Formatted(house, street, area, city, state, pincode);
        return new AddressLookupDto(house, street, area, city, state, pincode, formatted, ProviderName);
    }

    /// <summary>Drops ward prefixes and administrative names that mean nothing in a street address.</summary>
    private static string? Locality(string? value)
    {
        var text = AddressText.Clean(value);
        if (text == null) return null;
        text = WardPrefix().Replace(text, string.Empty).Trim();
        if (text.Length == 0 || AdminName().IsMatch(text)) return null;
        return text;
    }

    [GeneratedRegex(@"^ward\s*(no\.?\s*)?\d+\s*[-:,]?\s*", RegexOptions.IgnoreCase)]
    private static partial Regex WardPrefix();

    [GeneratedRegex(@"municipal corporation|\bzone\b|\bmandal\b|\bcircle\b", RegexOptions.IgnoreCase)]
    private static partial Regex AdminName();
}
