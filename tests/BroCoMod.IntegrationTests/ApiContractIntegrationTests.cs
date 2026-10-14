using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using BroCoMod.Application.DTOs;
using BroCoMod.Domain.Enums;
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

    // Books with a vehicle this test adds, not whatever the shared demo customer's list puts first
    // (other classes add, re-prioritise and delete vehicles on that account in parallel).
    private static async Task<Guid> AddOwnVehicleAsync(HttpClient customer)
    {
        var makes = await customer.GetFromJsonAsync<ApiResponse<List<VehicleManufacturerDto>>>("/api/v1/vehicle-manufacturers?search=BMW", JsonOptions);
        var bmw = makes!.Data!.First(m => m.Name == "BMW");
        var models = await customer.GetFromJsonAsync<ApiResponse<List<VehicleModelDto>>>($"/api/v1/vehicle-manufacturers/{bmw.Id}/models", JsonOptions);
        var model = models!.Data!.First(m => m.Name == "3 Series");
        var add = await customer.PostAsJsonAsync("/api/v1/customer/vehicles", new CreateCustomerVehicleRequest(
            bmw.Id, model.Id, null, 2022, FuelType.Petrol, "Automatic", $"APIC-{Guid.NewGuid().ToString()[..6].ToUpper()}", "", 10000, "White"));
        add.EnsureSuccessStatusCode();
        var body = await add.Content.ReadFromJsonAsync<ApiResponse<CustomerVehicleDetailDto>>(JsonOptions);
        return body!.Data!.Id;
    }

    [Fact]
    public async Task EnumNamesInRequestBodies_AreAccepted()
    {
        var customer = await SignedInAsync("customer@brocomod.com");
        var makes = await customer.GetFromJsonAsync<ApiResponse<List<VehicleManufacturerDto>>>("/api/v1/vehicle-manufacturers", JsonOptions);
        var make = makes!.Data!.First();
        var models = await customer.GetFromJsonAsync<ApiResponse<List<VehicleModelDto>>>($"/api/v1/vehicle-manufacturers/{make.Id}/models", JsonOptions);
        var model = models!.Data!.First(m => m.YearTo == null);

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
        var vehicleId = await AddOwnVehicleAsync(customer);

        var booking = await customer.PostAsJsonAsync("/api/v1/customer/requests", new CreateServiceBookingRequest(
            VehicleId: vehicleId,
            AddressLine1: "12 Residency Road",
            AddressLine2: null,
            City: "Hyderabad",
            State: "Telangana",
            Pincode: "500034",
            Country: "India",
            Latitude: 17.4126,
            Longitude: 78.4482,
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
    public async Task QuotationSentStraightFromDraft_CanBeAcceptedByCustomer()
    {
        // Customer books
        var customer = await SignedInAsync("customer@brocomod.com");
        var booking = await customer.PostAsJsonAsync("/api/v1/customer/requests", new CreateServiceBookingRequest(
            await AddOwnVehicleAsync(customer), "8 Lavelle Road", null, "Hyderabad", "Telangana", "500034", "India",
            17.4126, 78.4482, "Clutch slipping in third gear", "Transmission & Clutch", null));
        booking.EnsureSuccessStatusCode();
        var requestId = (await booking.Content.ReadFromJsonAsync<ApiResponse<ServiceRequestDetailDto>>(JsonOptions))!.Data!.Id;

        // Garage quotes
        Guid garageId, garageRequestId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<BroCoMod.Infrastructure.Persistence.ApplicationDbContext>();
            var gu = db.GarageUsers.First(g => g.User.Email == "garage.owner@centralmetro.com");
            garageId = gu.GarageId;
            garageRequestId = db.GarageRequests.First(r => r.ServiceRequestId == requestId && r.GarageId == garageId).Id;
        }
        var garage = await SignedInAsync("garage.owner@centralmetro.com");
        var draft = await garage.PostAsJsonAsync("/api/v1/garage/quotes/draft", new CreateGarageQuoteRequest(
            garageRequestId, "INR", 4, 1, DateTime.UtcNow.AddDays(7), "Clutch plate replacement",
            new List<CreateQuoteLineItemRequest> { new(BroCoMod.Domain.Enums.QuoteLineType.Part, "Clutch kit", 1, 6500m, 18m, 0m, 1) }));
        draft.EnsureSuccessStatusCode();
        var quoteId = (await draft.Content.ReadFromJsonAsync<ApiResponse<GarageQuoteDetailDto>>(JsonOptions))!.Data!.Id;
        (await garage.PostAsJsonAsync($"/api/v1/garage/quotes/{quoteId}/submit", new SubmitGarageQuoteCommand())).EnsureSuccessStatusCode();

        // Advisor assigns and sends WITHOUT marking ready first
        var advisor = await SignedInAsync("advisor@brocomod.com");
        (await advisor.PostAsJsonAsync($"/api/v1/advisor/requests/{requestId}/assignment",
            new AssignGarageRequest(garageId, quoteId, "Only quote"))).EnsureSuccessStatusCode();
        var cq = await advisor.PostAsJsonAsync($"/api/v1/advisor/requests/{requestId}/customer-quotation", new CreateCustomerQuotationRequest(
            "Clutch replacement", null, DateTime.UtcNow.AddDays(5), 0m, "INR",
            new List<CustomerQuotationLineItemInputDto> { new(BroCoMod.Domain.Enums.QuoteLineType.Part, "Clutch kit", 1, 6500m, 18m, 0m, 1) }));
        cq.EnsureSuccessStatusCode();
        var cqId = (await cq.Content.ReadFromJsonAsync<ApiResponse<CustomerQuotationDto>>(JsonOptions))!.Data!.Id;
        (await advisor.PostAsJsonAsync($"/api/v1/advisor/customer-quotations/{cqId}/send", new { })).EnsureSuccessStatusCode();

        // Customer accepts
        var accept = await customer.PostAsJsonAsync($"/api/v1/customer/quotes/{cqId}/accept", new AcceptQuotationRequest(CustomerRemarks: null));
        var raw = await accept.Content.ReadAsStringAsync();
        accept.StatusCode.Should().Be(HttpStatusCode.OK, raw);
    }

    [Fact]
    public async Task Advisor_Assignments_ShowRealGarageNames()
    {
        var advisor = await SignedInAsync("advisor@brocomod.com");
        var raw = await advisor.GetStringAsync("/api/v1/advisor/assignments");
        raw.Should().NotContain("Assigned Partner");
    }
}
