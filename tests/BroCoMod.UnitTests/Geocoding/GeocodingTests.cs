using System.Diagnostics;
using System.Net;
using System.Text;
using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Infrastructure.Services;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace BroCoMod.UnitTests.Geocoding;

/// <summary>Pin to address: parsing Google / OpenStreetMap answers, the provider chain, caching and rate limits.</summary>
public class GeocodingTests
{
    private const double BanjaraLat = 17.4126;
    private const double BanjaraLng = 78.4482;

    private static IConfiguration Config(params (string Key, string? Value)[] values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values.Select(v => new KeyValuePair<string, string?>(v.Key, v.Value))).Build();

    private sealed class StubHandler : HttpMessageHandler
    {
        private readonly string _body;
        public List<HttpRequestMessage> Requests { get; } = new();
        public StubHandler(string body) => _body = body;

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Requests.Add(request);
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(_body, Encoding.UTF8, "application/json") });
        }
    }

    private sealed class FakeProvider : IReverseGeocodingProvider
    {
        private readonly AddressLookupDto? _answer;
        public int Calls { get; private set; }
        public FakeProvider(string name, bool available, AddressLookupDto? answer)
        {
            Name = name;
            IsAvailable = available;
            _answer = answer;
        }

        public string Name { get; }
        public bool IsAvailable { get; }

        public Task<AddressLookupDto?> ReverseAsync(double latitude, double longitude, CancellationToken ct = default)
        {
            Calls++;
            return Task.FromResult(_answer);
        }
    }

    // ---------- OpenStreetMap (Nominatim) ----------

    [Fact]
    public void Nominatim_BanjaraHillsSample_FillsAreaCityStatePincode_AndDropsTheWardPrefix()
    {
        var address = NominatimReverseGeocodingProvider.Parse(GeocodingSamples.NominatimBanjaraHills);

        address.Should().NotBeNull();
        address!.HouseNumber.Should().BeNull("OpenStreetMap has no house number for this pin");
        address.Street.Should().Be("Sri Ram Nagar Colony");
        address.Area.Should().Be("Banjara Hills");
        address.City.Should().Be("Hyderabad");
        address.State.Should().Be("Telangana");
        address.Pincode.Should().Be("500034");
        address.FormattedAddress.Should().Be("Sri Ram Nagar Colony, Banjara Hills, Hyderabad, Telangana 500034");
        address.Provider.Should().Be("OpenStreetMap");
    }

    [Fact]
    public void Nominatim_BuildingWithHouseNumber_FillsHouse_AndNormalisesASpacedPincode()
    {
        var address = NominatimReverseGeocodingProvider.Parse(GeocodingSamples.NominatimWithHouseNumber);

        address!.HouseNumber.Should().Be("8-2-120/86");
        address.Street.Should().Be("Road Number 2");
        address.Area.Should().Be("Banjara Hills");
        address.Pincode.Should().Be("500034");
        address.FormattedAddress.Should().Be("8-2-120/86, Road Number 2, Banjara Hills, Hyderabad, Telangana 500034");
    }

    [Fact]
    public void Nominatim_Error_ReturnsNull()
    {
        NominatimReverseGeocodingProvider.Parse(GeocodingSamples.NominatimError).Should().BeNull();
    }

    [Fact]
    public async Task NominatimProvider_SendsAnIdentifyingUserAgent_AndTheDocumentedQuery()
    {
        var handler = new StubHandler(GeocodingSamples.NominatimBanjaraHills);
        var provider = new NominatimReverseGeocodingProvider(new HttpClient(handler), new NominatimRateGate(TimeSpan.Zero, TimeProvider.System),
            Config(), NullLogger<NominatimReverseGeocodingProvider>.Instance);

        provider.IsAvailable.Should().BeTrue("OpenStreetMap is the default fallback");
        var address = await provider.ReverseAsync(BanjaraLat, BanjaraLng);

        address!.Area.Should().Be("Banjara Hills");
        var request = handler.Requests.Should().ContainSingle().Subject;
        request.Headers.UserAgent.ToString().Should().Be("BroCo/1.0 (+https://github.com/vinayvinnu1336-afk/broco-mod)");
        request.RequestUri!.ToString().Should().StartWith("https://nominatim.openstreetmap.org/reverse?")
            .And.Contain("format=jsonv2").And.Contain("lat=17.4126").And.Contain("lon=78.4482")
            .And.Contain("addressdetails=1").And.Contain("accept-language=en");
    }

    [Fact]
    public async Task NominatimProvider_SwitchedOff_NeverCallsOut()
    {
        var handler = new StubHandler(GeocodingSamples.NominatimBanjaraHills);
        var provider = new NominatimReverseGeocodingProvider(new HttpClient(handler), new NominatimRateGate(),
            Config(("Geocoding:FallbackProvider", "None")), NullLogger<NominatimReverseGeocodingProvider>.Instance);

        provider.IsAvailable.Should().BeFalse();
        (await provider.ReverseAsync(BanjaraLat, BanjaraLng)).Should().BeNull();
        handler.Requests.Should().BeEmpty();
    }

    // ---------- Google Geocoding API ----------

    [Fact]
    public void Google_BanjaraHillsSample_UsesThePremiseResult_AndSkipsThePlusCode()
    {
        var address = GoogleGeocodingService.Parse(GeocodingSamples.GoogleBanjaraHills);

        address.Should().NotBeNull();
        address!.HouseNumber.Should().Be("8-2-293/82/A/431");
        address.Street.Should().Be("Road Number 12, Sri Ram Nagar Colony");
        address.Area.Should().Be("Banjara Hills");
        address.City.Should().Be("Hyderabad");
        address.State.Should().Be("Telangana");
        address.Pincode.Should().Be("500034");
        address.FormattedAddress.Should().Be("8-2-293/82/A/431, Road Number 12, Sri Ram Nagar Colony, Banjara Hills, Hyderabad, Telangana 500034, India");
        address.Provider.Should().Be("Google");
    }

    [Fact]
    public void Google_UnnamedRoad_LeavesStreetEmpty_AndTakesThePincodeFromABroaderResult()
    {
        var address = GoogleGeocodingService.Parse(GeocodingSamples.GoogleUnnamedRoadPincodeElsewhere);

        address!.HouseNumber.Should().BeNull();
        address.Street.Should().BeNull();
        address.Area.Should().Be("Kondapur");
        address.City.Should().Be("Hyderabad");
        address.Pincode.Should().Be("500084");
    }

    [Theory]
    [InlineData(GeocodingSamples.GoogleRequestDenied)]
    [InlineData(GeocodingSamples.GoogleZeroResults)]
    public void Google_DeniedOrNothingFound_ReturnsNull(string json)
    {
        GoogleGeocodingService.Parse(json).Should().BeNull();
    }

    [Fact]
    public async Task GoogleProvider_WithoutAServerKey_IsUnavailable_AndNeverCallsOut()
    {
        var handler = new StubHandler(GeocodingSamples.GoogleBanjaraHills);
        var google = new GoogleGeocodingService(new HttpClient(handler), Config(("GoogleMaps:ServerApiKey", "")), NullLogger<GoogleGeocodingService>.Instance);

        google.IsConfigured.Should().BeFalse();
        google.IsAvailable.Should().BeFalse();
        (await google.ReverseAsync(BanjaraLat, BanjaraLng)).Should().BeNull();
        (await google.ReverseGeocodeAsync(BanjaraLat, BanjaraLng)).Should().BeNull();
        handler.Requests.Should().BeEmpty();
    }

    [Fact]
    public async Task GoogleProvider_WithAServerKey_FeedsBothTheAutofillAndThePincodeCrossCheck()
    {
        var handler = new StubHandler(GeocodingSamples.GoogleBanjaraHills);
        var google = new GoogleGeocodingService(new HttpClient(handler), Config(("GOOGLE_MAPS_SERVER_KEY", "test-server-key")), NullLogger<GoogleGeocodingService>.Instance);

        google.IsConfigured.Should().BeTrue("the plain GOOGLE_MAPS_SERVER_KEY variable works without docker compose");
        (await google.ReverseAsync(BanjaraLat, BanjaraLng))!.HouseNumber.Should().Be("8-2-293/82/A/431");

        var check = await google.ReverseGeocodeAsync(BanjaraLat, BanjaraLng);
        check!.Pincode.Should().Be("500034");
        check.City.Should().Be("Hyderabad");

        handler.Requests.Should().HaveCount(2);
        handler.Requests[0].RequestUri!.ToString().Should().StartWith("https://maps.googleapis.com/maps/api/geocode/json?latlng=17.4126,78.4482")
            .And.Contain("key=test-server-key").And.Contain("region=in");
    }

    // ---------- Provider chain, cache, settings, rate limit ----------

    private static AddressLookupDto Banjara(string provider) =>
        new(null, "Sri Ram Nagar Colony", "Banjara Hills", "Hyderabad", "Telangana", "500034", "Banjara Hills, Hyderabad", provider);

    [Fact]
    public async Task AddressLookup_SkipsUnavailableAndEmptyProviders_ThenCachesPerRoundedPin()
    {
        var off = new FakeProvider("Google", available: false, Banjara("Google"));
        var empty = new FakeProvider("Empty", available: true, answer: null);
        var osm = new FakeProvider("OpenStreetMap", available: true, Banjara("OpenStreetMap"));
        var lookup = new AddressLookupService(new IReverseGeocodingProvider[] { off, empty, osm }, new ReverseGeocodeCache(), NullLogger<AddressLookupService>.Instance);

        lookup.ActiveProvider.Should().Be("Empty");
        (await lookup.ReverseAsync(BanjaraLat, BanjaraLng))!.Provider.Should().Be("OpenStreetMap");
        // A few metres away rounds to the same 4-decimal key, so no second call goes out.
        (await lookup.ReverseAsync(17.41262, 78.44818))!.Area.Should().Be("Banjara Hills");

        off.Calls.Should().Be(0);
        empty.Calls.Should().Be(1);
        osm.Calls.Should().Be(1);
    }

    [Fact]
    public async Task AddressLookup_WithNoProviderAvailable_ReturnsNull()
    {
        var lookup = new AddressLookupService(new[] { new FakeProvider("OpenStreetMap", available: false, Banjara("OpenStreetMap")) },
            new ReverseGeocodeCache(), NullLogger<AddressLookupService>.Instance);

        lookup.ActiveProvider.Should().BeNull();
        (await lookup.ReverseAsync(BanjaraLat, BanjaraLng)).Should().BeNull();
    }

    [Theory]
    [InlineData(null, "OpenStreetMap")]
    [InlineData("", "OpenStreetMap")]
    [InlineData("openstreetmap", "OpenStreetMap")]
    [InlineData("None", "None")]
    [InlineData("Off", "None")]
    public void FallbackProvider_DefaultsToOpenStreetMap_AndAnythingElseSwitchesItOff(string? value, string expected)
    {
        GeocodingSettings.FallbackProvider(Config(("Geocoding:FallbackProvider", value))).Should().Be(expected);
    }

    [Fact]
    public void Keys_PreferTheGoogleMapsSection_ThenThePlainEnvironmentVariables()
    {
        GeocodingSettings.BrowserKey(Config(("GoogleMaps:BrowserApiKey", "from-section"), ("GOOGLE_MAPS_BROWSER_KEY", "from-env"))).Should().Be("from-section");
        GeocodingSettings.BrowserKey(Config(("GoogleMaps:BrowserApiKey", " "), ("GOOGLE_MAPS_BROWSER_KEY", "from-env"))).Should().Be("from-env");
        GeocodingSettings.ServerKey(Config(("GoogleMaps:ServerApiKey", ""))).Should().BeNull();
    }

    [Fact]
    public async Task RateGate_SpacesRequestsOutAcrossCallers()
    {
        var gate = new NominatimRateGate(TimeSpan.FromMilliseconds(300), TimeProvider.System);
        var clock = Stopwatch.StartNew();

        (await gate.WaitTurnAsync(TimeSpan.FromSeconds(2))).Should().BeTrue();
        var first = clock.Elapsed;
        (await gate.WaitTurnAsync(TimeSpan.FromSeconds(2))).Should().BeTrue();

        (clock.Elapsed - first).Should().BeGreaterThanOrEqualTo(TimeSpan.FromMilliseconds(250));
    }

    [Fact]
    public async Task RateGate_GivesUpWhenTheWaitWouldBeTooLong()
    {
        var gate = new NominatimRateGate(TimeSpan.FromSeconds(5), TimeProvider.System);

        (await gate.WaitTurnAsync(TimeSpan.FromSeconds(1))).Should().BeTrue();
        (await gate.WaitTurnAsync(TimeSpan.FromMilliseconds(200))).Should().BeFalse();
    }
}
