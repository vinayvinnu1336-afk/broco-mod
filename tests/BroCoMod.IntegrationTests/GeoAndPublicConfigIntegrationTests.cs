using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Xunit;

namespace BroCoMod.IntegrationTests;

/// <summary>
/// API host whose geocoders are fakes, so these tests never call Google or OpenStreetMap.
/// The fake pincode check says every pin is in 500033 (only bookings made by these tests use it).
/// </summary>
public class GeoTestFactory : WebApplicationFactory<Program>
{
    public FakeAddressProvider Addresses { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("GoogleMaps:BrowserApiKey", "test-browser-key");
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IReverseGeocodingProvider>();
            services.AddSingleton<IReverseGeocodingProvider>(Addresses);
            services.RemoveAll<IGeocodingService>();
            services.AddSingleton<IGeocodingService>(new FakePincodeCheck("500033"));
        });
    }
}

public sealed class FakeAddressProvider : IReverseGeocodingProvider
{
    private int _calls;
    public int Calls => _calls;
    public string Name => "TestGeocoder";
    public bool IsAvailable => true;

    /// <summary>Knows one Banjara Hills street; everywhere else is "no address found".</summary>
    public Task<AddressLookupDto?> ReverseAsync(double latitude, double longitude, CancellationToken ct = default)
    {
        Interlocked.Increment(ref _calls);
        var nearBanjaraHills = Math.Abs(latitude - 17.4126) < 0.01 && Math.Abs(longitude - 78.4482) < 0.01;
        return Task.FromResult(nearBanjaraHills
            ? new AddressLookupDto(null, "Sri Ram Nagar Colony", "Banjara Hills", "Hyderabad", "Telangana", "500034",
                "Sri Ram Nagar Colony, Banjara Hills, Hyderabad, Telangana 500034", Name)
            : null);
    }
}

public sealed class FakePincodeCheck : IGeocodingService
{
    private readonly string _pincode;
    public FakePincodeCheck(string pincode) => _pincode = pincode;
    public bool IsConfigured => true;

    public Task<ReverseGeocodeResult?> ReverseGeocodeAsync(double latitude, double longitude, CancellationToken ct = default) =>
        Task.FromResult<ReverseGeocodeResult?>(new ReverseGeocodeResult(_pincode, "Hyderabad", "Telangana", $"Hyderabad, Telangana {_pincode}"));
}

/// <summary>Address autofill (GET /geo/reverse), runtime Maps settings (GET /config/public) and the pincode/pin cross-check.</summary>
public class GeoAndPublicConfigIntegrationTests : IClassFixture<GeoTestFactory>
{
    private readonly GeoTestFactory _factory;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public GeoAndPublicConfigIntegrationTests(GeoTestFactory factory)
    {
        _factory = factory;
    }

    private static async Task<HttpClient> SignInAsync(WebApplicationFactory<Program> factory, string email, string password = "Password123!")
    {
        var client = factory.CreateClient();
        var res = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, password));
        res.EnsureSuccessStatusCode();
        var body = await res.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body!.Data!.AccessToken);
        return client;
    }

    [Fact]
    public async Task Reverse_RequiresSignIn()
    {
        var anon = _factory.CreateClient();

        var res = await anon.GetAsync("/api/v1/geo/reverse?lat=17.4126&lng=78.4482");

        res.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Theory]
    [InlineData("lat=95&lng=78.4482")]
    [InlineData("lat=-90.5&lng=78.4482")]
    [InlineData("lat=17.4126&lng=180.5")]
    [InlineData("lat=NaN&lng=78.4482")]
    [InlineData("lng=78.4482")]
    [InlineData("lat=abc&lng=78.4482")]
    public async Task Reverse_RejectsMissingOrOutOfRangeCoordinates(string query)
    {
        var customer = await SignInAsync(_factory, "customer@brocomod.com");
        var before = _factory.Addresses.Calls;

        var res = await customer.GetAsync($"/api/v1/geo/reverse?{query}");

        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        _factory.Addresses.Calls.Should().Be(before, "bad coordinates never reach a geocoder");
    }

    [Fact]
    public async Task Reverse_ReturnsTheAddressFieldsAndWhoseDataItIs()
    {
        var customer = await SignInAsync(_factory, "customer@brocomod.com");

        var res = await customer.GetAsync("/api/v1/geo/reverse?lat=17.4126&lng=78.4482");

        res.StatusCode.Should().Be(HttpStatusCode.OK);
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        var data = doc.RootElement.GetProperty("data");
        data.GetProperty("street").GetString().Should().Be("Sri Ram Nagar Colony");
        data.GetProperty("area").GetString().Should().Be("Banjara Hills");
        data.GetProperty("city").GetString().Should().Be("Hyderabad");
        data.GetProperty("state").GetString().Should().Be("Telangana");
        data.GetProperty("pincode").GetString().Should().Be("500034");
        data.GetProperty("formattedAddress").GetString().Should().Contain("Banjara Hills");
        data.GetProperty("provider").GetString().Should().Be("TestGeocoder");
        data.TryGetProperty("houseNumber", out _).Should().BeTrue("the response always has the same shape");
    }

    [Fact]
    public async Task Reverse_WhereNothingIsFound_ReturnsNoData()
    {
        var garageOwner = await SignInAsync(_factory, "garage.owner@centralmetro.com");

        var res = await garageOwner.GetAsync("/api/v1/geo/reverse?lat=-33.8688&lng=151.2093");

        res.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await res.Content.ReadFromJsonAsync<ApiResponse<AddressLookupDto>>(JsonOptions);
        body!.Success.Should().BeTrue();
        body.Data.Should().BeNull();
    }

    [Fact]
    public async Task PublicConfig_IsAnonymous_AndHandsOutTheBrowserKeyAndLookupProvider()
    {
        var anon = _factory.CreateClient();

        var body = await anon.GetFromJsonAsync<ApiResponse<PublicConfigDto>>("/api/v1/config/public", JsonOptions);

        body!.Data!.GoogleMapsBrowserKey.Should().Be("test-browser-key");
        body.Data.AddressLookupProvider.Should().Be("TestGeocoder");
    }

    [Fact]
    public async Task WithLookupSwitchedOffAndNoGoogleKey_ConfigSaysNone_AndReverseFindsNothing()
    {
        // The real providers, but Google has no key and OpenStreetMap is off: nothing leaves the machine.
        using var plain = new WebApplicationFactory<Program>();
        using var offline = plain.WithWebHostBuilder(b =>
        {
            b.UseSetting("Geocoding:FallbackProvider", "None");
            b.UseSetting("GoogleMaps:ServerApiKey", "");
            b.UseSetting("GOOGLE_MAPS_SERVER_KEY", "");
            b.UseSetting("GoogleMaps:BrowserApiKey", "");
            b.UseSetting("GOOGLE_MAPS_BROWSER_KEY", "");
        });

        var config = await offline.CreateClient().GetFromJsonAsync<ApiResponse<PublicConfigDto>>("/api/v1/config/public", JsonOptions);
        config!.Data!.AddressLookupProvider.Should().Be("None");
        config.Data.GoogleMapsBrowserKey.Should().BeEmpty();

        var customer = await SignInAsync(offline, "customer@brocomod.com");
        var res = await customer.GetAsync("/api/v1/geo/reverse?lat=17.4126&lng=78.4482");
        res.StatusCode.Should().Be(HttpStatusCode.OK);
        (await res.Content.ReadFromJsonAsync<ApiResponse<AddressLookupDto>>(JsonOptions))!.Data.Should().BeNull();
    }

    [Fact]
    public async Task Booking_WhosePincodeDoesNotMatchThePin_IsRejected_WhenGoogleChecksIt()
    {
        var anon = _factory.CreateClient();
        var email = $"geo_{Guid.NewGuid():N}@brocomod.com";
        (await anon.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest(email, "Password123!", "Geo Customer", "+91 90000 66666")))
            .EnsureSuccessStatusCode();
        var customer = await SignInAsync(_factory, email);

        var makes = await customer.GetFromJsonAsync<ApiResponse<List<VehicleManufacturerDto>>>("/api/v1/vehicle-manufacturers", JsonOptions);
        var maruti = makes!.Data!.Single(m => m.Name == "Maruti Suzuki");
        var models = await customer.GetFromJsonAsync<ApiResponse<List<VehicleModelDto>>>($"/api/v1/vehicle-manufacturers/{maruti.Id}/models", JsonOptions);
        var swift = models!.Data!.Single(m => m.Name == "Swift");
        var vehicleJson = $$"""
        { "manufacturerId": "{{maruti.Id}}", "modelId": "{{swift.Id}}", "year": 2021, "fuelType": "Petrol",
          "transmission": "Manual", "licensePlate": "TS-09-GE-{{Random.Shared.Next(1000, 9999)}}", "mileage": 12000, "color": "White" }
        """;
        var added = await customer.PostAsync("/api/v1/customer/vehicles", new StringContent(vehicleJson, Encoding.UTF8, "application/json"));
        added.EnsureSuccessStatusCode();
        using var vehicle = JsonDocument.Parse(await added.Content.ReadAsStringAsync());
        var vehicleId = vehicle.RootElement.GetProperty("data").GetProperty("id").GetGuid();

        var booking = new CreateServiceBookingRequest(vehicleId, "Plot 7, Road No. 3", "Banjara Hills", "Hyderabad", "Telangana", "500034", "India",
            17.4126, 78.4482, ProblemDescription: "", ServiceCategory: null, PackageCode: "BASIC");
        var res = await customer.PostAsJsonAsync("/api/v1/customer/requests", booking);

        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await res.Content.ReadAsStringAsync()).Should().Contain("500033").And.Contain("500034");
    }
}
