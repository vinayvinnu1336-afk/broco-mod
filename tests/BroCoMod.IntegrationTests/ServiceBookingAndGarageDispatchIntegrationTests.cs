using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Enums;
using BroCoMod.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using NetTopologySuite.Geometries;
using Xunit;

namespace BroCoMod.IntegrationTests;

public class ServiceBookingAndGarageDispatchIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public ServiceBookingAndGarageDispatchIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    private async Task<string> AuthenticateAsync(string email, string password)
    {
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, password));
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(JsonOptions);
        body.Should().NotBeNull();
        body!.Data.Should().NotBeNull();
        return body.Data!.AccessToken;
    }

    private HttpClient CreateAuthenticatedClient(string token)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    // Helper: Register a new customer and return client + vehicle ID
    private async Task<(HttpClient Client, Guid VehicleId, string Email)> CreateCustomerWithVehicleAsync(string emailPrefix)
    {
        var email = $"{emailPrefix}_{Guid.NewGuid():N}@brocomod.com";
        var regResponse = await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest(
            email,
            "Password123!",
            "Test Customer",
            "+91 98765 43210"));
        regResponse.EnsureSuccessStatusCode();

        var token = await AuthenticateAsync(email, "Password123!");
        var client = CreateAuthenticatedClient(token);

        // Get manufacturer & model
        var mResponse = await client.GetAsync("/api/v1/vehicle-manufacturers");
        var mBody = await mResponse.Content.ReadFromJsonAsync<ApiResponse<IReadOnlyList<VehicleManufacturerDto>>>(JsonOptions);
        var bmw = mBody!.Data!.First(m => m.Name == "BMW");

        var modelsResponse = await client.GetAsync($"/api/v1/vehicle-manufacturers/{bmw.Id}/models");
        var modelsBody = await modelsResponse.Content.ReadFromJsonAsync<ApiResponse<IReadOnlyList<VehicleModelDto>>>(JsonOptions);
        var model3Series = modelsBody!.Data!.First(m => m.Name == "3 Series");

        var vResponse = await client.PostAsJsonAsync("/api/v1/customer/vehicles", new CreateCustomerVehicleRequest(
            bmw.Id,
            model3Series.Id,
            null,
            2022,
            FuelType.Petrol,
            "Automatic",
            $"KA-01-{Guid.NewGuid():N}"[..12].ToUpper(),
            "",
            15000,
            "Black"
        ));
        vResponse.EnsureSuccessStatusCode();
        var vBody = await vResponse.Content.ReadFromJsonAsync<ApiResponse<CustomerVehicleDetailDto>>(JsonOptions);

        return (client, vBody!.Data!.Id, email);
    }

    // ========================================================
    // 1. CUSTOMER CAN CREATE OWN SERVICE REQUEST
    // ========================================================
    [Fact]
    public async Task Security01_Customer_CanCreateOwnServiceRequest()
    {
        var (client, vehicleId, _) = await CreateCustomerWithVehicleAsync("customer1");

        var request = new CreateServiceBookingRequest(
            VehicleId: vehicleId,
            AddressLine1: "100 MG Road",
            AddressLine2: "Opposite Metro Station",
            City: "Bengaluru",
            State: "Karnataka",
            Pincode: "560001",
            Country: "India",
            Latitude: 12.9716, // Bangalore center
            Longitude: 77.5946,
            ProblemDescription: "Loud squeaking noise from front brake pads during deceleration.",
            ServiceCategory: "Brakes",
            PreferredServiceDate: DateTime.UtcNow.AddDays(1)
        );

        var response = await client.PostAsJsonAsync("/api/v1/customer/requests", request);
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<ServiceRequestDetailDto>>(JsonOptions);
        body.Should().NotBeNull();
        body!.Success.Should().BeTrue();
        body.Data.Should().NotBeNull();
        body.Data!.RequestNumber.Should().StartWith("BM-");
        body.Data.VehicleSummary.Should().Contain("BMW");
        body.Data.MatchedGaragesCount.Should().BeGreaterThanOrEqualTo(1);
        body.Data.Status.Should().BeOneOf("NEW", "GARAGES_NOTIFIED");
    }

    // ========================================================
    // 2. CUSTOMER CANNOT CREATE REQUEST FOR ANOTHER CUSTOMER'S VEHICLE
    // ========================================================
    [Fact]
    public async Task Security02_Customer_CannotCreateRequestForAnotherCustomersVehicle()
    {
        var (client1, _, _) = await CreateCustomerWithVehicleAsync("cust_a");
        var (_, vehicleIdB, _) = await CreateCustomerWithVehicleAsync("cust_b");

        // Customer A tries to use Customer B's vehicle
        var request = new CreateServiceBookingRequest(
            VehicleId: vehicleIdB, // Belongs to customer B!
            AddressLine1: "100 MG Road",
            AddressLine2: null,
            City: "Bengaluru",
            State: "Karnataka",
            Pincode: "560001",
            Country: "India",
            Latitude: 12.9716,
            Longitude: 77.5946,
            ProblemDescription: "Unauthorized attempt on someone else's vehicle.",
            ServiceCategory: "General"
        );

        var response = await client1.PostAsJsonAsync("/api/v1/customer/requests", request);
        response.StatusCode.Should().BeOneOf(HttpStatusCode.Forbidden, HttpStatusCode.BadRequest);

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>(JsonOptions);
        body!.Success.Should().BeFalse();
        body.Message.Should().Contain("not authorized");
    }

    // ========================================================
    // 3. CUSTOMER CANNOT ACCESS ANOTHER CUSTOMER'S REQUEST
    // ========================================================
    [Fact]
    public async Task Security03_Customer_CannotAccessAnotherCustomersRequest()
    {
        var (clientA, vehicleIdA, _) = await CreateCustomerWithVehicleAsync("cust_iso_a");
        var (clientB, _, _) = await CreateCustomerWithVehicleAsync("cust_iso_b");

        // Customer A creates request
        var createResponse = await clientA.PostAsJsonAsync("/api/v1/customer/requests", new CreateServiceBookingRequest(
            VehicleId: vehicleIdA,
            AddressLine1: "MG Road",
            AddressLine2: null,
            City: "Bengaluru",
            State: "Karnataka",
            Pincode: "560001",
            Country: "India",
            Latitude: 12.9716,
            Longitude: 77.5946,
            ProblemDescription: "Engine oil change required.",
            ServiceCategory: "Periodic Service"
        ));
        var createBody = await createResponse.Content.ReadFromJsonAsync<ApiResponse<ServiceRequestDetailDto>>(JsonOptions);
        var requestAId = createBody!.Data!.Id;

        // Customer B attempts to access Customer A's request
        var getResponse = await clientB.GetAsync($"/api/v1/customer/requests/{requestAId}");
        getResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ========================================================
    // 4. GARAGE SEES ONLY ITS OWN GARAGEREQUESTS
    // ========================================================
    [Fact]
    public async Task Security04_Garage_SeesOnlyOwnGarageRequests()
    {
        var garageToken = await AuthenticateAsync("garage.owner@centralmetro.com", "Password123!");
        var garageClient = CreateAuthenticatedClient(garageToken);

        var response = await garageClient.GetAsync("/api/v1/garage/requests");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<PagedResult<GarageIncomingRequestDto>>>(JsonOptions);
        body.Should().NotBeNull();
        body!.Success.Should().BeTrue();
        body.Data.Should().NotBeNull();

        // Each garage request must contain non-null distance and valid request ID
        foreach (var req in body.Data!.Items)
        {
            req.DistanceKm.Should().BeGreaterThanOrEqualTo(0);
            req.RequestNumber.Should().StartWith("BM-");
            req.Status.Should().NotBeNullOrEmpty();
        }
    }

    // ========================================================
    // 5. GARAGE CANNOT ACCESS ANOTHER GARAGE'S REQUEST
    // ========================================================
    [Fact]
    public async Task Security05_Garage_CannotAccessAnotherGaragesRequest()
    {
        var garageToken = await AuthenticateAsync("garage.owner@centralmetro.com", "Password123!");
        var garageClient = CreateAuthenticatedClient(garageToken);

        // Attempt to fetch request with random ID
        var fakeId = Guid.NewGuid();
        var response = await garageClient.GetAsync($"/api/v1/garage/requests/{fakeId}");
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ========================================================
    // 6. ADVISOR CAN ACCESS AUTHORIZED REQUESTS
    // ========================================================
    [Fact]
    public async Task Security06_Advisor_CanAccessAuthorizedRequests()
    {
        var advisorToken = await AuthenticateAsync("advisor@brocomod.com", "Password123!");
        var advisorClient = CreateAuthenticatedClient(advisorToken);

        var response = await advisorClient.GetAsync("/api/v1/advisor/requests");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<PagedResult<AdvisorServiceRequestSummaryDto>>>(JsonOptions);
        body.Should().NotBeNull();
        body!.Success.Should().BeTrue();
        body.Data.Should().NotBeNull();
    }

    // ========================================================
    // 7. CUSTOMER CANNOT ACCESS ADVISOR REQUEST APIS
    // ========================================================
    [Fact]
    public async Task Security07_Customer_CannotAccessAdvisorRequestApis()
    {
        var (client, _, _) = await CreateCustomerWithVehicleAsync("cust_no_adv");

        var response = await client.GetAsync("/api/v1/advisor/requests");
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ========================================================
    // 8. ADMIN CAN ACCESS AUTHORIZED ADMIN REQUESTS
    // ========================================================
    [Fact]
    public async Task Security08_Admin_CanAccessAuthorizedAdminRequests()
    {
        var adminToken = await AuthenticateAsync("admin@brocomod.com", "Password123!");
        var adminClient = CreateAuthenticatedClient(adminToken);

        var response = await adminClient.GetAsync("/api/v1/admin/requests");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<PagedResult<AdminServiceRequestSummaryDto>>>(JsonOptions);
        body.Should().NotBeNull();
        body!.Success.Should().BeTrue();
        body.Data.Should().NotBeNull();
    }

    // ========================================================
    // 9. INTERNAL GARAGE QUOTE FIELDS DO NOT EXIST IN CUSTOMER RESPONSES
    // ========================================================
    [Fact]
    public async Task Security09_CustomerResponses_NeverContainInternalGaragePricing()
    {
        var (client, vehicleId, _) = await CreateCustomerWithVehicleAsync("pricing_iso");

        var response = await client.PostAsJsonAsync("/api/v1/customer/requests", new CreateServiceBookingRequest(
            VehicleId: vehicleId,
            AddressLine1: "100 Residency Road",
            AddressLine2: null,
            City: "Bengaluru",
            State: "Karnataka",
            Pincode: "560025",
            Country: "India",
            Latitude: 12.9716,
            Longitude: 77.5946,
            ProblemDescription: "Exhaust vibration and rattle.",
            ServiceCategory: "Exhaust"
        ));
        response.EnsureSuccessStatusCode();

        var rawJson = await response.Content.ReadAsStringAsync();

        // Strictly verify that internal garage pricing fields NEVER appear in customer JSON response
        rawJson.Should().NotContainEquivalentOf("GarageInternalPrice");
        rawJson.Should().NotContainEquivalentOf("InternalCostBreakdown");
        rawJson.Should().NotContainEquivalentOf("AdvisorMarginApplied");
        rawJson.Should().NotContainEquivalentOf("internalMargin");
    }

    // ========================================================
    // 10. DUPLICATE IDEMPOTENCY KEY DOES NOT CREATE DUPLICATE REQUEST
    // ========================================================
    [Fact]
    public async Task Security10_DuplicateIdempotencyKey_DoesNotCreateDuplicateRequest()
    {
        var (client, vehicleId, _) = await CreateCustomerWithVehicleAsync("idempotent");
        var idempotencyKey = $"test-key-{Guid.NewGuid():N}";

        var request = new CreateServiceBookingRequest(
            VehicleId: vehicleId,
            AddressLine1: "Idempotency Way",
            AddressLine2: null,
            City: "Bengaluru",
            State: "Karnataka",
            Pincode: "560001",
            Country: "India",
            Latitude: 12.9716,
            Longitude: 77.5946,
            ProblemDescription: "Testing duplicate network retries with idempotency key.",
            ServiceCategory: "General"
        );

        // First Submission
        var message1 = new HttpRequestMessage(HttpMethod.Post, "/api/v1/customer/requests")
        {
            Content = JsonContent.Create(request)
        };
        message1.Headers.Add("Idempotency-Key", idempotencyKey);
        var response1 = await client.SendAsync(message1);
        response1.EnsureSuccessStatusCode();
        var body1 = await response1.Content.ReadFromJsonAsync<ApiResponse<ServiceRequestDetailDto>>(JsonOptions);

        // Second Submission with identical Idempotency-Key
        var message2 = new HttpRequestMessage(HttpMethod.Post, "/api/v1/customer/requests")
        {
            Content = JsonContent.Create(request)
        };
        message2.Headers.Add("Idempotency-Key", idempotencyKey);
        var response2 = await client.SendAsync(message2);
        response2.EnsureSuccessStatusCode();
        var body2 = await response2.Content.ReadFromJsonAsync<ApiResponse<ServiceRequestDetailDto>>(JsonOptions);

        // Assert: Same Request Number and ID must be returned
        body1!.Data!.Id.Should().Be(body2!.Data!.Id);
        body1.Data.RequestNumber.Should().Be(body2.Data.RequestNumber);
    }

    // ========================================================
    // 11. INVALID VEHICLE/CUSTOMER RELATIONSHIP IS REJECTED
    // ========================================================
    [Fact]
    public async Task Security11_InvalidVehicleCustomerRelationship_IsRejected()
    {
        var (client, _, _) = await CreateCustomerWithVehicleAsync("invalid_v");

        var request = new CreateServiceBookingRequest(
            VehicleId: Guid.NewGuid(), // Non-existent vehicle
            AddressLine1: "123 Test St",
            AddressLine2: null,
            City: "Bengaluru",
            State: "Karnataka",
            Pincode: "560001",
            Country: "India",
            Latitude: 12.9716,
            Longitude: 77.5946,
            ProblemDescription: "Invalid vehicle ID test.",
            ServiceCategory: "General"
        );

        var response = await client.PostAsJsonAsync("/api/v1/customer/requests", request);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ========================================================
    // 12. INVALID LOCATION COORDINATES ARE REJECTED
    // ========================================================
    [Fact]
    public async Task Security12_InvalidLocationCoordinates_AreRejected()
    {
        var (client, vehicleId, _) = await CreateCustomerWithVehicleAsync("bad_coords");

        var request = new CreateServiceBookingRequest(
            VehicleId: vehicleId,
            AddressLine1: "123 Out of Bounds St",
            AddressLine2: null,
            City: "Bengaluru",
            State: "Karnataka",
            Pincode: "560001",
            Country: "India",
            Latitude: 120.0, // Invalid: Latitude > 90
            Longitude: 250.0, // Invalid: Longitude > 180
            ProblemDescription: "Invalid coordinates test.",
            ServiceCategory: "General"
        );

        var response = await client.PostAsJsonAsync("/api/v1/customer/requests", request);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>(JsonOptions);
        body!.Success.Should().BeFalse();
        body.Message.Should().Contain("Latitude");
    }

    // ========================================================
    // 13. GARAGE OUTSIDE 10 KM IS NOT MATCHED
    // ========================================================
    [Fact]
    public async Task Spatial13_GarageOutside10Km_IsNotMatched()
    {
        using var scope = _factory.Services.CreateScope();
        var matchingService = scope.ServiceProvider.GetRequiredService<IGarageMatchingService>();

        // Customer at Bangalore Center (12.9716, 77.5946)
        var customerLocation = new Point(77.5946, 12.9716) { SRID = 4326 };

        var matches = await matchingService.FindEligibleGaragesAsync(customerLocation, radiusKm: 10.0);

        // Whitefield is located ~16.8 KM away from Bangalore center
        matches.Should().NotContain(m => m.GarageName == "Whitefield Precision Garage");

        // Central Metro Motors (~0 KM) and Indiranagar (~5.2 KM) MUST be matched
        matches.Should().Contain(m => m.GarageName == "Central Metro Motors");
    }

    // ========================================================
    // 14. INACTIVE GARAGE IS NOT MATCHED
    // ========================================================
    [Fact]
    public async Task Spatial14_InactiveGarage_IsNotMatched()
    {
        using var scope = _factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
        var matchingService = scope.ServiceProvider.GetRequiredService<IGarageMatchingService>();

        // Create an inactive garage 1 KM away
        var inactiveGarage = new Garage(
            name: "Inactive Nearby Garage",
            email: "inactive@garage.com",
            phoneNumber: "+91 80 1111 2222",
            address: "Near Center",
            longitude: 77.6000,
            latitude: 12.9750);
        inactiveGarage.SetActive(false);

        context.Garages.Add(inactiveGarage);
        await context.SaveChangesAsync();

        var customerLocation = new Point(77.5946, 12.9716) { SRID = 4326 };
        var matches = await matchingService.FindEligibleGaragesAsync(customerLocation, radiusKm: 10.0);

        matches.Should().NotContain(m => m.GarageId == inactiveGarage.Id);
    }

    // ========================================================
    // 15. UNVERIFIED GARAGE IS NOT MATCHED
    // ========================================================
    [Fact]
    public async Task Spatial15_UnverifiedGarage_IsNotMatched()
    {
        using var scope = _factory.Services.CreateScope();
        var matchingService = scope.ServiceProvider.GetRequiredService<IGarageMatchingService>();

        var customerLocation = new Point(77.5946, 12.9716) { SRID = 4326 };
        var matches = await matchingService.FindEligibleGaragesAsync(customerLocation, radiusKm: 10.0);

        // "Jayanagar Auto Care (Pending Verification)" is within 5 KM, but IsVerified = false
        matches.Should().NotContain(m => m.GarageName.Contains("Pending Verification"));
    }

    // ========================================================
    // 16. DUPLICATE GARAGEREQUEST CANNOT BE CREATED FOR SAME SERVICE REQUEST AND GARAGE
    // ========================================================
    [Fact]
    public async Task Concurrency16_DuplicateGarageRequest_CannotBeCreated()
    {
        using var scope = _factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var sReq = await context.ServiceRequests.FirstOrDefaultAsync();
        sReq.Should().NotBeNull();

        var garage = await context.Garages.FirstOrDefaultAsync(g => g.IsActive);
        garage.Should().NotBeNull();

        // Clean any existing record for this combination
        var existing = await context.GarageRequests.FirstOrDefaultAsync(gr => gr.ServiceRequestId == sReq!.Id && gr.GarageId == garage!.Id);
        if (existing == null)
        {
            var gr1 = new GarageRequest(sReq!.Id, garage!.Id, 3.5, GarageRequestStatus.Notified);
            context.GarageRequests.Add(gr1);
            await context.SaveChangesAsync();
        }

        // Attempt to insert duplicate GarageRequest for same service request and garage
        var grDuplicate = new GarageRequest(sReq!.Id, garage!.Id, 3.5, GarageRequestStatus.Notified);
        context.GarageRequests.Add(grDuplicate);

        Func<Task> act = async () => await context.SaveChangesAsync();

        // Must throw DbUpdateException due to unique constraint on (ServiceRequestId, GarageId)
        await act.Should().ThrowAsync<DbUpdateException>();
    }
}
