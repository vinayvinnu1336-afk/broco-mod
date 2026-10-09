using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using BroCoMod.Application.DTOs;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
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
    public async Task Advisor_Assignments_ShowRealGarageNames()
    {
        var advisor = await SignedInAsync("advisor@brocomod.com");
        var raw = await advisor.GetStringAsync("/api/v1/advisor/assignments");
        raw.Should().NotContain("Assigned Partner");
    }
}
