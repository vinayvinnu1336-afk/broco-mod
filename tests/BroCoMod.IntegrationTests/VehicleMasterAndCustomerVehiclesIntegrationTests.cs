using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using BroCoMod.Application.DTOs;
using BroCoMod.Domain.Constants;
using BroCoMod.Domain.Enums;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace BroCoMod.IntegrationTests;

public class VehicleMasterAndCustomerVehiclesIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public VehicleMasterAndCustomerVehiclesIntegrationTests(WebApplicationFactory<Program> factory)
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

    // ========================================================
    // VEHICLE MASTER CATALOG ENDPOINTS
    // ========================================================

    [Fact]
    public async Task Master01_GetManufacturers_ReturnsSeededManufacturers()
    {
        var response = await _client.GetAsync("/api/v1/vehicle-manufacturers");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<IReadOnlyList<VehicleManufacturerDto>>>(JsonOptions);
        body.Should().NotBeNull();
        body!.Success.Should().BeTrue();
        body.Data.Should().NotBeEmpty();

        var bmw = body.Data!.FirstOrDefault(m => m.Name == "BMW");
        bmw.Should().NotBeNull();
        bmw!.Country.Should().Be("Germany");
        bmw.ModelsCount.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task Master02_GetModelsByManufacturer_ReturnsCascadingModels()
    {
        // 1. Fetch BMW
        var mResponse = await _client.GetAsync("/api/v1/vehicle-manufacturers?search=BMW");
        mResponse.EnsureSuccessStatusCode();
        var mBody = await mResponse.Content.ReadFromJsonAsync<ApiResponse<IReadOnlyList<VehicleManufacturerDto>>>(JsonOptions);
        var bmw = mBody!.Data!.First(m => m.Name == "BMW");

        // 2. Fetch BMW models
        var modelsResponse = await _client.GetAsync($"/api/v1/vehicle-manufacturers/{bmw.Id}/models");
        modelsResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var modelsBody = await modelsResponse.Content.ReadFromJsonAsync<ApiResponse<IReadOnlyList<VehicleModelDto>>>(JsonOptions);
        modelsBody.Should().NotBeNull();
        modelsBody!.Data.Should().Contain(m => m.Name == "3 Series");
        modelsBody.Data.Should().Contain(m => m.Name == "M3");
    }

    [Fact]
    public async Task Master03_GetVariantsByModel_ReturnsCascadingVariants()
    {
        // 1. Fetch BMW
        var mResponse = await _client.GetAsync("/api/v1/vehicle-manufacturers?search=BMW");
        var mBody = await mResponse.Content.ReadFromJsonAsync<ApiResponse<IReadOnlyList<VehicleManufacturerDto>>>(JsonOptions);
        var bmw = mBody!.Data!.First(m => m.Name == "BMW");

        // 2. Fetch 3 Series model
        var modelsResponse = await _client.GetAsync($"/api/v1/vehicle-manufacturers/{bmw.Id}/models");
        var modelsBody = await modelsResponse.Content.ReadFromJsonAsync<ApiResponse<IReadOnlyList<VehicleModelDto>>>(JsonOptions);
        var model3Series = modelsBody!.Data!.First(m => m.Name == "3 Series");

        // 3. Fetch variants
        var vResponse = await _client.GetAsync($"/api/v1/vehicle-models/{model3Series.Id}/variants");
        vResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var vBody = await vResponse.Content.ReadFromJsonAsync<ApiResponse<IReadOnlyList<VehicleVariantDto>>>(JsonOptions);
        vBody.Should().NotBeNull();
        vBody!.Data.Should().Contain(v => v.Name == "M340i xDrive");
    }

    [Fact]
    public async Task Master04_GetFuelTypes_ReturnsAllSupportedTypes()
    {
        var response = await _client.GetAsync("/api/v1/vehicle-master/fuel-types");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<IReadOnlyList<VehicleFuelTypeDto>>>(JsonOptions);
        body.Should().NotBeNull();
        body!.Data.Should().Contain(f => f.Name == "Petrol");
        body.Data.Should().Contain(f => f.Name == "Diesel");
        body.Data.Should().Contain(f => f.Name == "Electric");
        body.Data.Should().Contain(f => f.Name == "Hybrid");
        body.Data.Should().Contain(f => f.Name == "PlugInHybrid");
    }

    // ========================================================
    // CUSTOMER VEHICLE CRUD & PRIMARY STATUS
    // ========================================================

    [Fact]
    public async Task CustomerVehicle01_Customer_CanAddGetUpdateSetPrimaryAndDeleteVehicle()
    {
        var token = await AuthenticateAsync("customer@brocomod.com", "Password123!");
        var client = CreateAuthenticatedClient(token);

        // 1. Get BMW -> 3 Series -> 330i
        var mResponse = await client.GetAsync("/api/v1/vehicle-manufacturers?search=BMW");
        var mBody = await mResponse.Content.ReadFromJsonAsync<ApiResponse<IReadOnlyList<VehicleManufacturerDto>>>(JsonOptions);
        var bmw = mBody!.Data!.First(m => m.Name == "BMW");

        var modelsResponse = await client.GetAsync($"/api/v1/vehicle-manufacturers/{bmw.Id}/models");
        var modelsBody = await modelsResponse.Content.ReadFromJsonAsync<ApiResponse<IReadOnlyList<VehicleModelDto>>>(JsonOptions);
        var model3Series = modelsBody!.Data!.First(m => m.Name == "3 Series");

        var vResponse = await client.GetAsync($"/api/v1/vehicle-models/{model3Series.Id}/variants");
        var vBody = await vResponse.Content.ReadFromJsonAsync<ApiResponse<IReadOnlyList<VehicleVariantDto>>>(JsonOptions);
        var variant330i = vBody!.Data!.First(v => v.Name == "330i");

        // 2. Add vehicle
        var uniquePlate = $"TEST-{Guid.NewGuid().ToString()[..6].ToUpper()}";
        var addRequest = new CreateCustomerVehicleRequest(
            ManufacturerId: bmw.Id,
            ModelId: model3Series.Id,
            VariantId: variant330i.Id,
            Year: 2021,
            FuelType: FuelType.Petrol,
            Transmission: "Automatic",
            LicensePlate: uniquePlate,
            Vin: "WBA330I9999999999",
            Mileage: 12000,
            Color: "Mineral Grey",
            IsPrimary: true
        );

        var addResponse = await client.PostAsJsonAsync("/api/v1/customer/vehicles", addRequest);
        addResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        var addBody = await addResponse.Content.ReadFromJsonAsync<ApiResponse<CustomerVehicleDetailDto>>(JsonOptions);
        addBody.Should().NotBeNull();
        var vehicleId = addBody!.Data!.Id;
        addBody.Data.Make.Should().Be("BMW");
        addBody.Data.Model.Should().Be("3 Series");
        addBody.Data.VariantName.Should().Be("330i");
        addBody.Data.LicensePlate.Should().Be(uniquePlate);
        addBody.Data.IsPrimary.Should().BeTrue();

        // 3. Get Vehicle by ID
        var getResponse = await client.GetAsync($"/api/v1/customer/vehicles/{vehicleId}");
        getResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var getBody = await getResponse.Content.ReadFromJsonAsync<ApiResponse<CustomerVehicleDetailDto>>(JsonOptions);
        getBody!.Data!.Id.Should().Be(vehicleId);

        // 4. Update Vehicle
        var updateRequest = new UpdateCustomerVehicleRequest(
            ManufacturerId: bmw.Id,
            ModelId: model3Series.Id,
            VariantId: variant330i.Id,
            Year: 2021,
            FuelType: FuelType.Petrol,
            Transmission: "Automatic",
            LicensePlate: uniquePlate,
            Vin: "WBA330I9999999999",
            Mileage: 14500, // Updated mileage
            Color: "Dravit Grey", // Updated color
            IsPrimary: true
        );

        var updateResponse = await client.PutAsJsonAsync($"/api/v1/customer/vehicles/{vehicleId}", updateRequest);
        updateResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var updateBody = await updateResponse.Content.ReadFromJsonAsync<ApiResponse<CustomerVehicleDetailDto>>(JsonOptions);
        updateBody!.Data!.Mileage.Should().Be(14500);
        updateBody.Data.Color.Should().Be("Dravit Grey");

        // 5. Set Primary Vehicle
        var primaryResponse = await client.PostAsync($"/api/v1/customer/vehicles/{vehicleId}/set-primary", null);
        primaryResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // 6. Delete Vehicle
        var deleteResponse = await client.DeleteAsync($"/api/v1/customer/vehicles/{vehicleId}");
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify it is no longer retrieved
        var getAfterDelete = await client.GetAsync($"/api/v1/customer/vehicles/{vehicleId}");
        getAfterDelete.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ========================================================
    // RELATIONAL HIERARCHY VALIDATION
    // ========================================================

    [Fact]
    public async Task Validation01_ModelDoesNotBelongToManufacturer_ReturnsBadRequest()
    {
        var token = await AuthenticateAsync("customer@brocomod.com", "Password123!");
        var client = CreateAuthenticatedClient(token);

        // Fetch BMW and Audi
        var mResponse = await client.GetAsync("/api/v1/vehicle-manufacturers");
        var mBody = await mResponse.Content.ReadFromJsonAsync<ApiResponse<IReadOnlyList<VehicleManufacturerDto>>>(JsonOptions);
        var bmw = mBody!.Data!.First(m => m.Name == "BMW");
        var audi = mBody.Data!.First(m => m.Name == "Audi");

        // Get Audi A4 model
        var audiModelsResponse = await client.GetAsync($"/api/v1/vehicle-manufacturers/{audi.Id}/models");
        var audiModelsBody = await audiModelsResponse.Content.ReadFromJsonAsync<ApiResponse<IReadOnlyList<VehicleModelDto>>>(JsonOptions);
        var audiA4 = audiModelsBody!.Data!.First(m => m.Name == "A4");

        // Try to add vehicle claiming manufacturer is BMW, but model is Audi A4
        var request = new CreateCustomerVehicleRequest(
            ManufacturerId: bmw.Id, // Mismatched!
            ModelId: audiA4.Id,
            VariantId: null,
            Year: 2020,
            FuelType: FuelType.Petrol,
            Transmission: "Automatic",
            LicensePlate: "MISMATCH-1",
            Vin: "",
            Mileage: 10000,
            Color: "Silver"
        );

        var response = await client.PostAsJsonAsync("/api/v1/customer/vehicles", request);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>(JsonOptions);
        body!.Success.Should().BeFalse();
        body.Message.Should().Contain("does not belong to manufacturer");
    }

    [Fact]
    public async Task Validation02_VariantDoesNotBelongToModel_ReturnsBadRequest()
    {
        var token = await AuthenticateAsync("customer@brocomod.com", "Password123!");
        var client = CreateAuthenticatedClient(token);

        var mResponse = await client.GetAsync("/api/v1/vehicle-manufacturers?search=BMW");
        var mBody = await mResponse.Content.ReadFromJsonAsync<ApiResponse<IReadOnlyList<VehicleManufacturerDto>>>(JsonOptions);
        var bmw = mBody!.Data!.First(m => m.Name == "BMW");

        var modelsResponse = await client.GetAsync($"/api/v1/vehicle-manufacturers/{bmw.Id}/models");
        var modelsBody = await modelsResponse.Content.ReadFromJsonAsync<ApiResponse<IReadOnlyList<VehicleModelDto>>>(JsonOptions);
        var model3Series = modelsBody!.Data!.First(m => m.Name == "3 Series");
        var modelM3 = modelsBody.Data!.First(m => m.Name == "M3");

        // Get variant of M3
        var m3VariantsResponse = await client.GetAsync($"/api/v1/vehicle-models/{modelM3.Id}/variants");
        var m3VariantsBody = await m3VariantsResponse.Content.ReadFromJsonAsync<ApiResponse<IReadOnlyList<VehicleVariantDto>>>(JsonOptions);
        var m3Variant = m3VariantsBody!.Data!.First();

        // Try to add vehicle claiming model is 3 Series, but variant belongs to M3
        var request = new CreateCustomerVehicleRequest(
            ManufacturerId: bmw.Id,
            ModelId: model3Series.Id, // 3 Series
            VariantId: m3Variant.Id,   // Belongs to M3!
            Year: 2022,
            FuelType: FuelType.Petrol,
            Transmission: "Automatic",
            LicensePlate: "MISMATCH-2",
            Vin: "",
            Mileage: 5000,
            Color: "Red"
        );

        var response = await client.PostAsJsonAsync("/api/v1/customer/vehicles", request);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>(JsonOptions);
        body!.Success.Should().BeFalse();
        body.Message.Should().Contain("does not belong to model");
    }

    [Fact]
    public async Task Validation03_ModelYearOutsideAllowedRange_ReturnsBadRequest()
    {
        var token = await AuthenticateAsync("customer@brocomod.com", "Password123!");
        var client = CreateAuthenticatedClient(token);

        var mResponse = await client.GetAsync("/api/v1/vehicle-manufacturers?search=Porsche");
        var mBody = await mResponse.Content.ReadFromJsonAsync<ApiResponse<IReadOnlyList<VehicleManufacturerDto>>>(JsonOptions);
        var porsche = mBody!.Data!.First(m => m.Name == "Porsche");

        var modelsResponse = await client.GetAsync($"/api/v1/vehicle-manufacturers/{porsche.Id}/models");
        var modelsBody = await modelsResponse.Content.ReadFromJsonAsync<ApiResponse<IReadOnlyList<VehicleModelDto>>>(JsonOptions);
        var model911 = modelsBody!.Data!.First(m => m.Name == "911");

        // Year 1990 is outside 2019+
        var request = new CreateCustomerVehicleRequest(
            ManufacturerId: porsche.Id,
            ModelId: model911.Id,
            VariantId: null,
            Year: 1990,
            FuelType: FuelType.Petrol,
            Transmission: "Dual-Clutch",
            LicensePlate: "ANCIENT-911",
            Vin: "",
            Mileage: 100000,
            Color: "Yellow"
        );

        var response = await client.PostAsJsonAsync("/api/v1/customer/vehicles", request);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>(JsonOptions);
        body!.Success.Should().BeFalse();
        body.Message.Should().Contain("Model year 1990 is invalid");
    }

    // ========================================================
    // STRICT DATA ISOLATION & AUTHORIZATION
    // ========================================================

    [Fact]
    public async Task Isolation01_CustomerCannotAccessAnotherCustomersVehicle()
    {
        // 1. Customer 1 logs in and creates a vehicle
        var token1 = await AuthenticateAsync("customer@brocomod.com", "Password123!");
        var client1 = CreateAuthenticatedClient(token1);

        var mResponse = await client1.GetAsync("/api/v1/vehicle-manufacturers?search=BMW");
        var mBody = await mResponse.Content.ReadFromJsonAsync<ApiResponse<IReadOnlyList<VehicleManufacturerDto>>>(JsonOptions);
        var bmw = mBody!.Data!.First(m => m.Name == "BMW");

        var modelsResponse = await client1.GetAsync($"/api/v1/vehicle-manufacturers/{bmw.Id}/models");
        var modelsBody = await modelsResponse.Content.ReadFromJsonAsync<ApiResponse<IReadOnlyList<VehicleModelDto>>>(JsonOptions);
        var model3Series = modelsBody!.Data!.First(m => m.Name == "3 Series");

        var addRequest = new CreateCustomerVehicleRequest(
            ManufacturerId: bmw.Id,
            ModelId: model3Series.Id,
            VariantId: null,
            Year: 2022,
            FuelType: FuelType.Petrol,
            Transmission: "Automatic",
            LicensePlate: $"ISOL-{Guid.NewGuid().ToString()[..6]}",
            Vin: "",
            Mileage: 5000,
            Color: "White"
        );

        var addResponse = await client1.PostAsJsonAsync("/api/v1/customer/vehicles", addRequest);
        addResponse.EnsureSuccessStatusCode();
        var addBody = await addResponse.Content.ReadFromJsonAsync<ApiResponse<CustomerVehicleDetailDto>>(JsonOptions);
        var customer1VehicleId = addBody!.Data!.Id;

        // 2. Register a second customer
        var secondCustomerEmail = $"second.customer.{Guid.NewGuid().ToString()[..8]}@brocomod.com";
        var regResponse = await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest(
            secondCustomerEmail,
            "Password123!",
            "Second Customer",
            "+15559998888",
            AppRoles.Customer
        ));
        regResponse.EnsureSuccessStatusCode();

        var token2 = await AuthenticateAsync(secondCustomerEmail, "Password123!");
        var client2 = CreateAuthenticatedClient(token2);

        // 3. Customer 2 tries to GET Customer 1's vehicle
        var getByCustomer2 = await client2.GetAsync($"/api/v1/customer/vehicles/{customer1VehicleId}");
        getByCustomer2.StatusCode.Should().Be(HttpStatusCode.NotFound);

        // 4. Customer 2 tries to DELETE Customer 1's vehicle
        var deleteByCustomer2 = await client2.DeleteAsync($"/api/v1/customer/vehicles/{customer1VehicleId}");
        deleteByCustomer2.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Auth01_UnauthenticatedAccessToVehicles_ReturnsUnauthorized()
    {
        var response = await _client.GetAsync("/api/v1/customer/vehicles");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Auth02_GarageStaffRole_CannotAccessCustomerVehiclesEndpoint()
    {
        // Login as Garage Owner
        var garageToken = await AuthenticateAsync("garage.owner@centralmetro.com", "Password123!");
        var client = CreateAuthenticatedClient(garageToken);

        var response = await client.GetAsync("/api/v1/customer/vehicles");
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
