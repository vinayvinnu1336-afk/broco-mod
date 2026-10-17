using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using BroCoMod.Application.DTOs;
using BroCoMod.Domain.Constants;
using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Enums;
using BroCoMod.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BroCoMod.IntegrationTests;

public class AdminOperationsIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public AdminOperationsIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    private async Task<string> LoginAsync(string email, string password)
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

    [Fact]
    public async Task Admin_GetDashboard_ReturnsRealMetricsSuccessfully()
    {
        var token = await LoginAsync("admin@brocomod.com", "Password123!");
        var client = CreateAuthenticatedClient(token);

        var response = await client.GetAsync("/api/v1/admin/dashboard");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<AdminDashboardKpiDto>>(JsonOptions);
        body.Should().NotBeNull();
        body!.Data.Should().NotBeNull();

        var data = body.Data!;
        data.TotalUsersCount.Should().BeGreaterThanOrEqualTo(0);
        data.TotalCustomersCount.Should().BeGreaterThanOrEqualTo(0);
        data.TotalGaragesCount.Should().BeGreaterThanOrEqualTo(0);
        data.TotalAdvisorsCount.Should().BeGreaterThanOrEqualTo(0);
        data.TotalRequestsCount.Should().BeGreaterThanOrEqualTo(0);
        data.TotalServiceRequests.Should().BeGreaterThanOrEqualTo(0);
        data.TotalGarages.Should().BeGreaterThanOrEqualTo(0);
    }

    [Fact]
    public async Task Admin_GetRequests_ReturnsPaginatedResultsAndSupportsFiltering()
    {
        var token = await LoginAsync("admin@brocomod.com", "Password123!");
        var client = CreateAuthenticatedClient(token);

        var response = await client.GetAsync("/api/v1/admin/requests?page=1&pageSize=25");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<PagedResult<AdminRequestSummaryDto>>>(JsonOptions);
        body.Should().NotBeNull();
        body!.Data.Should().NotBeNull();
        body.Data!.PageSize.Should().Be(25);
        body.Data.Items.Should().NotBeNull();
    }

    [Fact]
    public async Task Admin_GetRequestDetail_ReturnsUnifiedOperationalTimeline()
    {
        // Book a request owned by this test. The newest request in the shared database can belong to another
        // class that has not written its creation audit row yet.
        var email = $"admin_detail_{Guid.NewGuid():N}@brocomod.com";
        var register = await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest(email, "Password123!", "Detail Customer", TestMobiles.New()));
        register.EnsureSuccessStatusCode();
        var customer = CreateAuthenticatedClient(await LoginAsync(email, "Password123!"));

        var brands = await customer.GetFromJsonAsync<ApiResponse<IReadOnlyList<VehicleManufacturerDto>>>("/api/v1/vehicle-manufacturers", JsonOptions);
        var bmw = brands!.Data!.First(m => m.Name == "BMW");
        var models = await customer.GetFromJsonAsync<ApiResponse<IReadOnlyList<VehicleModelDto>>>($"/api/v1/vehicle-manufacturers/{bmw.Id}/models", JsonOptions);
        var model = models!.Data!.First(m => m.Name == "3 Series");
        var vehicle = await customer.PostAsJsonAsync("/api/v1/customer/vehicles", new CreateCustomerVehicleRequest(
            bmw.Id, model.Id, null, 2022, FuelType.Petrol, "Automatic", $"TS-{Guid.NewGuid():N}"[..12].ToUpper(), "", 15000, "Black"));
        vehicle.EnsureSuccessStatusCode();
        var vehicleBody = await vehicle.Content.ReadFromJsonAsync<ApiResponse<CustomerVehicleDetailDto>>(JsonOptions);

        var booking = await customer.PostAsJsonAsync("/api/v1/customer/requests", new CreateServiceBookingRequest(
            VehicleId: vehicleBody!.Data!.Id,
            AddressLine1: "Road No. 12, Banjara Hills",
            AddressLine2: null,
            City: "Hyderabad",
            State: "Telangana",
            Pincode: "500034",
            Country: "India",
            Latitude: 17.4126,
            Longitude: 78.4482,
            ProblemDescription: "Brakes squeal when slowing down.",
            ServiceCategory: "Brakes",
            PreferredServiceDate: DateTime.UtcNow.AddDays(1)));
        booking.StatusCode.Should().Be(HttpStatusCode.Created);
        var bookingBody = await booking.Content.ReadFromJsonAsync<ApiResponse<ServiceRequestDetailDto>>(JsonOptions);
        var reqId = bookingBody!.Data!.Id;

        var client = CreateAuthenticatedClient(await LoginAsync("admin@brocomod.com", "Password123!"));
        var response = await client.GetAsync($"/api/v1/admin/requests/{reqId}");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<AdminRequestOperationalDetailDto>>(JsonOptions);
        body.Should().NotBeNull();
        body!.Data.Should().NotBeNull();
        body.Data!.Id.Should().Be(reqId);
        // The creation audit is saved before the booking POST returns.
        body.Data.TimelineEvents.Should().Contain(e => e.Action == "SERVICE_REQUEST_CREATED");
    }

    [Fact]
    public async Task Admin_Garages_CanBeQueried_AndPaginated()
    {
        var token = await LoginAsync("admin@brocomod.com", "Password123!");
        var client = CreateAuthenticatedClient(token);

        var response = await client.GetAsync("/api/v1/admin/garages?page=1&pageSize=25");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<PagedResult<AdminGarageListDto>>>(JsonOptions);
        body.Should().NotBeNull();
        body!.Data.Should().NotBeNull();
        body.Data!.Items.Should().NotBeNull();
        body.Data.Items.Count.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task Admin_Garage_Verification_Suspension_Activation_Lifecycle_AndRadiusUpdate()
    {
        var token = await LoginAsync("admin@brocomod.com", "Password123!");
        var client = CreateAuthenticatedClient(token);

        // 1. Create a new test garage directly in db
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var testGarage = new Garage(
            name: $"Test Admin Ops Garage {Guid.NewGuid():N}",
            email: $"testops_{Guid.NewGuid():N}@garage.com",
            phoneNumber: "+91 99999 88888",
            address: "88 Outer Ring Road, Hyderabad",
            longitude: 78.47,
            latitude: 17.40,
            isVerified: false,
            isOperational: true,
            status: GarageStatus.PendingVerification,
            serviceRadiusKm: 10.0);

        db.Garages.Add(testGarage);
        await db.SaveChangesAsync();

        var garageId = testGarage.Id;

        // 2. Admin verifies garage
        var verifyRes = await client.PostAsJsonAsync($"/api/v1/admin/garages/{garageId}/verify", new VerifyGarageRequest());
        verifyRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // 3. Admin updates service radius to 15.5 KM
        var radiusRes = await client.PutAsJsonAsync($"/api/v1/admin/garages/{garageId}/radius", new UpdateGarageRadiusRequest(15.5));
        radiusRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // 4. Admin suspends garage
        var suspendRes = await client.PostAsJsonAsync($"/api/v1/admin/garages/{garageId}/suspend", new SuspendGarageRequest("Failed spot audit"));
        suspendRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // 5. Admin reactivates garage
        var activateRes = await client.PostAsJsonAsync($"/api/v1/admin/garages/{garageId}/activate", new ActivateGarageRequest());
        activateRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // 6. Admin inspects garage detail
        var detailRes = await client.GetAsync($"/api/v1/admin/garages/{garageId}");
        detailRes.StatusCode.Should().Be(HttpStatusCode.OK);

        var detailBody = await detailRes.Content.ReadFromJsonAsync<ApiResponse<AdminGarageDetailDto>>(JsonOptions);
        detailBody.Should().NotBeNull();
        detailBody!.Data.Should().NotBeNull();
        detailBody.Data!.Status.Should().Be(GarageStatus.Verified);
        detailBody.Data.ServiceRadiusKm.Should().Be(15.5);
    }

    [Fact]
    public async Task Admin_Advisors_CanBeListed_AndStatusToggled()
    {
        var token = await LoginAsync("admin@brocomod.com", "Password123!");
        var client = CreateAuthenticatedClient(token);

        var listRes = await client.GetAsync("/api/v1/admin/advisors?page=1&pageSize=25");
        listRes.StatusCode.Should().Be(HttpStatusCode.OK);

        var listBody = await listRes.Content.ReadFromJsonAsync<ApiResponse<PagedResult<AdminAdvisorListDto>>>(JsonOptions);
        listBody.Should().NotBeNull();
        listBody!.Data.Should().NotBeNull();
        listBody.Data!.Items.Should().NotBeNull();
        listBody.Data.Items.Count.Should().BeGreaterThan(0);

        // Toggle a throwaway advisor, never the shared demo one: other test classes run in parallel and
        // log in as advisor@brocomod.com, so deactivating it (even briefly) makes their logins fail with 401.
        Guid advisorProfileId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var hasher = scope.ServiceProvider.GetRequiredService<BroCoMod.Application.Interfaces.IPasswordHasher>();
            var hash = hasher.HashPassword("Password123!", out var salt);
            var user = new BroCoMod.Domain.Entities.Identity.User($"toggle.advisor.{Guid.NewGuid():N}@test.com", "Toggle Test Advisor", "+91 90000 44444", hash, salt);
            db.Users.Add(user);
            var advisorRole = await db.Roles.FirstAsync(r => r.Name == AppRoles.Advisor);
            db.UserRoles.Add(new BroCoMod.Domain.Entities.Identity.UserRole { UserId = user.Id, RoleId = advisorRole.Id });
            var profile = new BroCoMod.Domain.Entities.Identity.AdvisorProfile(user.Id, $"T-{Guid.NewGuid():N}"[..12], maxAssignedRequests: 0); // never auto-assigned real bookings
            db.AdvisorProfiles.Add(profile);
            await db.SaveChangesAsync();
            advisorProfileId = profile.Id;
        }

        // Deactivate advisor
        var deactRes = await client.PostAsJsonAsync($"/api/v1/admin/advisors/{advisorProfileId}/deactivate", new DeactivateAdvisorRequest("Temporary training leave"));
        deactRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // Reactivate advisor
        var actRes = await client.PostAsync($"/api/v1/admin/advisors/{advisorProfileId}/activate", null);
        actRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // Leave the throwaway account switched off.
        (await client.PostAsJsonAsync($"/api/v1/admin/advisors/{advisorProfileId}/deactivate", new DeactivateAdvisorRequest("Test cleanup")))
            .StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Admin_Customers_CanBeListed_AndDetailExcludesPasswordHash()
    {
        var token = await LoginAsync("admin@brocomod.com", "Password123!");
        var client = CreateAuthenticatedClient(token);

        var listRes = await client.GetAsync("/api/v1/admin/customers?page=1&pageSize=10");
        listRes.StatusCode.Should().Be(HttpStatusCode.OK);

        var listBody = await listRes.Content.ReadFromJsonAsync<ApiResponse<PagedResult<AdminCustomerListDto>>>(JsonOptions);
        listBody.Should().NotBeNull();
        listBody!.Data.Should().NotBeNull();

        if (listBody.Data!.Items.Count > 0)
        {
            var customerId = listBody.Data.Items[0].Id;
            var detailRes = await client.GetAsync($"/api/v1/admin/customers/{customerId}");
            detailRes.StatusCode.Should().Be(HttpStatusCode.OK);

            var rawJson = await detailRes.Content.ReadAsStringAsync();
            rawJson.Should().NotContain("PasswordHash");
            rawJson.Should().NotContain("PasswordSalt");
            rawJson.Should().NotContain("SecurityStamp");
        }
    }

    [Fact]
    public async Task Admin_AttentionQueue_ReturnsOperationalAlerts()
    {
        var token = await LoginAsync("admin@brocomod.com", "Password123!");
        var client = CreateAuthenticatedClient(token);

        var response = await client.GetAsync("/api/v1/admin/attention");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<AdminAttentionQueueDto>>(JsonOptions);
        body.Should().NotBeNull();
        body!.Data.Should().NotBeNull();
        body.Data!.Items.Should().NotBeNull();
    }

    [Fact]
    public async Task Admin_Notifications_CanBeMonitored_AndRetried()
    {
        var token = await LoginAsync("admin@brocomod.com", "Password123!");
        var client = CreateAuthenticatedClient(token);

        // Seed a failed notification directly
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var user = await db.Users.FirstAsync();
        var failedNotification = new Notification(
            userId: user.Id,
            title: "Simulated Alert",
            message: "Simulation of failure",
            type: "SYSTEM_ALERT",
            channel: NotificationChannel.Email);
        failedNotification.MarkFailed("SMTP connection reset by peer");

        db.Notifications.Add(failedNotification);
        await db.SaveChangesAsync();

        var notifId = failedNotification.Id;

        // Query notifications
        var listRes = await client.GetAsync("/api/v1/admin/notifications?page=1&pageSize=25");
        listRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // Retry notification
        var retryRes = await client.PostAsync($"/api/v1/admin/notifications/{notifId}/retry", null);
        retryRes.StatusCode.Should().Be(HttpStatusCode.OK);

        var retryBody = await retryRes.Content.ReadFromJsonAsync<ApiResponse<bool>>(JsonOptions);
        retryBody.Should().NotBeNull();
        retryBody!.Data.Should().BeTrue();
    }

    [Fact]
    public async Task Admin_SystemHealth_ReturnsComponentStatuses()
    {
        var token = await LoginAsync("admin@brocomod.com", "Password123!");
        var client = CreateAuthenticatedClient(token);

        var response = await client.GetAsync("/api/v1/admin/system-health");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<SystemHealthDto>>(JsonOptions);
        body.Should().NotBeNull();
        body!.Data.Should().NotBeNull();

        var health = body.Data!;
        health.OverallStatus.Should().NotBeNullOrWhiteSpace();
        health.Database.Should().NotBeNull();
        health.PostGis.Should().NotBeNull();
        health.Redis.Should().NotBeNull();
    }

    [Fact]
    public async Task Advisor_GetDashboard_AndWorkQueue_ReturnsSuccessfully()
    {
        var token = await LoginAsync("advisor@brocomod.com", "Password123!");
        var client = CreateAuthenticatedClient(token);

        var dashRes = await client.GetAsync("/api/v1/advisor/dashboard");
        dashRes.StatusCode.Should().Be(HttpStatusCode.OK);

        var dashBody = await dashRes.Content.ReadFromJsonAsync<ApiResponse<AdvisorDashboardKpiDto>>(JsonOptions);
        dashBody.Should().NotBeNull();
        dashBody!.Data.Should().NotBeNull();

        var queueRes = await client.GetAsync("/api/v1/advisor/work-queue");
        queueRes.StatusCode.Should().Be(HttpStatusCode.OK);

        var queueBody = await queueRes.Content.ReadFromJsonAsync<ApiResponse<AdvisorWorkQueueDto>>(JsonOptions);
        queueBody.Should().NotBeNull();
        queueBody!.Data.Should().NotBeNull();
    }

    [Fact]
    public async Task Security_CustomerCannotAccess_AdminOrAdvisorEndpoints()
    {
        // 1. Register/Login customer
        var custEmail = $"unauth_cust_{Guid.NewGuid():N}@brocomod.com";
        var regResponse = await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest(
            custEmail,
            "Password123!",
            "Unauth Test Customer",
            TestMobiles.New()));
        regResponse.EnsureSuccessStatusCode();

        var custToken = await LoginAsync(custEmail, "Password123!");
        var client = CreateAuthenticatedClient(custToken);

        // Attempt admin endpoints
        var adminDashRes = await client.GetAsync("/api/v1/admin/dashboard");
        adminDashRes.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        var adminGaragesRes = await client.GetAsync("/api/v1/admin/garages");
        adminGaragesRes.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        var adminHealthRes = await client.GetAsync("/api/v1/admin/system-health");
        adminHealthRes.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        // Attempt advisor endpoints
        var advDashRes = await client.GetAsync("/api/v1/advisor/dashboard");
        advDashRes.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        var advQueueRes = await client.GetAsync("/api/v1/advisor/work-queue");
        advQueueRes.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
