using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using BroCoMod.Application.DTOs;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BroCoMod.IntegrationTests;

/// <summary>
/// Contracts the web app depends on: enum names in request bodies, the advisor's
/// "quotations for a request" lookup and real garage names in assignments.
/// </summary>
public class ApiContractIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public ApiContractIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    private async Task<HttpClient> SignedInAsync(string email)
    {
        var client = _factory.CreateClient();
        var res = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, "Password123!"));
        res.EnsureSuccessStatusCode();
        var body = await res.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body!.Data!.AccessToken);
        return client;
    }

    [Fact]
    public async Task EnumNamesInRequestBodies_AreAccepted()
    {
        var customer = await SignedInAsync("customer@brocomod.com");
        var makes = await customer.GetFromJsonAsync<ApiResponse<List<VehicleManufacturerDto>>>("/api/v1/vehicle-manufacturers", JsonOptions);
        var make = makes!.Data!.First();
        var models = await customer.GetFromJsonAsync<ApiResponse<List<VehicleModelDto>>>($"/api/v1/vehicle-manufacturers/{make.Id}/models", JsonOptions);
        var model = models!.Data!.First();

        // fuelType sent as a name, the way the web app sends it
        var json = $$"""
        {
          "manufacturerId": "{{make.Id}}",
          "modelId": "{{model.Id}}",
          "variantId": null,
          "year": 2021,
          "fuelType": "Diesel",
          "transmission": "Manual",
          "licensePlate": "KA-05-{{Random.Shared.Next(1000, 9999)}}",
          "vin": "",
          "mileage": 12000,
          "color": "White"
        }
        """;
        var res = await customer.PostAsync("/api/v1/customer/vehicles", new StringContent(json, Encoding.UTF8, "application/json"));
        var raw = await res.Content.ReadAsStringAsync();
        res.IsSuccessStatusCode.Should().BeTrue(raw);

        using var doc = JsonDocument.Parse(raw);
        doc.RootElement.GetProperty("data").GetProperty("fuelType").GetString().Should().Be("Diesel");
    }

    [Fact]
    public async Task InvalidEnumName_IsRejectedWith400()
    {
        var customer = await SignedInAsync("customer@brocomod.com");
        var json = """{ "manufacturerId": "00000000-0000-0000-0000-000000000001", "modelId": "00000000-0000-0000-0000-000000000001", "year": 2021, "fuelType": "Steam", "licensePlate": "XX" }""";
        var res = await customer.PostAsync("/api/v1/customer/vehicles", new StringContent(json, Encoding.UTF8, "application/json"));
        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Advisor_CanListCustomerQuotationsForARequest()
    {
        var advisor = await SignedInAsync("advisor@brocomod.com");
        var res = await advisor.GetAsync($"/api/v1/advisor/customer-quotations?serviceRequestId={Guid.NewGuid()}");
        res.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await res.Content.ReadFromJsonAsync<ApiResponse<List<CustomerQuotationDto>>>(JsonOptions);
        body!.Success.Should().BeTrue();
        body.Data.Should().BeEmpty();
    }

    [Fact]
    public async Task NewServiceRequest_IsOwnedByAnAdvisor_AndAppearsOnTheirDashboard()
    {
        var customer = await SignedInAsync("customer@brocomod.com");
        var vehicles = await customer.GetFromJsonAsync<ApiResponse<List<CustomerVehicleDetailDto>>>("/api/v1/customer/vehicles", JsonOptions);
        var vehicleId = vehicles!.Data!.First().Id;

        var booking = await customer.PostAsJsonAsync("/api/v1/customer/requests", new CreateServiceBookingRequest(
            VehicleId: vehicleId,
            AddressLine1: "12 Residency Road",
            AddressLine2: null,
            City: "Bengaluru",
            State: "Karnataka",
            Pincode: "560025",
            Country: "India",
            Latitude: 12.9716,
            Longitude: 77.5946,
            ProblemDescription: "Engine warning light is on",
            ServiceCategory: "Electrical & Diagnostics",
            PreferredServiceDate: null));
        booking.EnsureSuccessStatusCode();
        var created = await booking.Content.ReadFromJsonAsync<ApiResponse<ServiceRequestDetailDto>>(JsonOptions);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BroCoMod.Infrastructure.Persistence.ApplicationDbContext>();
        var stored = await db.ServiceRequests.FindAsync(created!.Data!.Id);
        stored!.AssignedAdvisorId.Should().NotBeNull("an unowned request never reaches any advisor's dashboard");
    }

    [Fact]
    public async Task Advisor_Assignments_ShowRealGarageNames()
    {
        var advisor = await SignedInAsync("advisor@brocomod.com");
        var raw = await advisor.GetStringAsync("/api/v1/advisor/assignments");
        raw.Should().NotContain("Assigned Partner");
    }
}
