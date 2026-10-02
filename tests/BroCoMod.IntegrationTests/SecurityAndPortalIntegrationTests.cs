using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using BroCoMod.Application.DTOs;
using BroCoMod.Domain.Constants;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace BroCoMod.IntegrationTests;

public class SecurityAndPortalIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public SecurityAndPortalIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    private async Task<AuthResponse> LoginAsync(string email, string password)
    {
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, password));
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(JsonOptions);
        body.Should().NotBeNull();
        body!.Data.Should().NotBeNull();
        return body.Data!;
    }

    private HttpClient CreateAuthenticatedClient(string token)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    // Scenario 1: Customer can authenticate
    [Fact]
    public async Task Scenario01_Customer_CanAuthenticate_Successfully()
    {
        var auth = await LoginAsync("customer@brocomod.com", "Password123!");
        auth.AccessToken.Should().NotBeNullOrWhiteSpace();
        auth.User.Roles.Should().Contain(AppRoles.Customer);
    }

    // Scenario 2: Garage can authenticate
    [Fact]
    public async Task Scenario02_Garage_CanAuthenticate_Successfully()
    {
        var auth = await LoginAsync("garage.owner@centralmetro.com", "Password123!");
        auth.AccessToken.Should().NotBeNullOrWhiteSpace();
        auth.User.Roles.Should().Contain(AppRoles.GarageOwner);
    }

    // Scenario 3: Advisor can authenticate
    [Fact]
    public async Task Scenario03_Advisor_CanAuthenticate_Successfully()
    {
        var auth = await LoginAsync("advisor@brocomod.com", "Password123!");
        auth.AccessToken.Should().NotBeNullOrWhiteSpace();
        auth.User.Roles.Should().Contain(AppRoles.Advisor);
    }

    // Scenario 4: Admin can authenticate
    [Fact]
    public async Task Scenario04_Admin_CanAuthenticate_Successfully()
    {
        var auth = await LoginAsync("admin@brocomod.com", "Password123!");
        auth.AccessToken.Should().NotBeNullOrWhiteSpace();
        auth.User.Roles.Should().Contain(AppRoles.SuperAdmin);
    }

    // Scenario 5: Invalid credentials fail
    [Fact]
    public async Task Scenario05_InvalidCredentials_ReturnsUnauthorized()
    {
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest("customer@brocomod.com", "CompletelyWrongPassword99!"));
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // Scenario 6: Disabled user cannot authenticate
    [Fact]
    public async Task Scenario06_DisabledUser_CannotAuthenticate()
    {
        // 1. Register a test user
        var uniqueEmail = $"disabled.test.{Guid.NewGuid():N}@brocomod.com";
        var regResponse = await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest(
            Email: uniqueEmail,
            Password: "Password123!",
            FullName: "Temporary Disabled User",
            PhoneNumber: "+1 555 123 9999",
            Role: AppRoles.Customer
        ));
        regResponse.EnsureSuccessStatusCode();
        var regBody = await regResponse.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(JsonOptions);
        var userId = regBody!.Data!.User.Id;

        // 2. Admin disables the user
        var adminAuth = await LoginAsync("admin@brocomod.com", "Password123!");
        var adminClient = CreateAuthenticatedClient(adminAuth.AccessToken);
        var disableResponse = await adminClient.PostAsJsonAsync($"/api/v1/admin/users/{userId}/status", new { IsActive = false });
        disableResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // 3. User attempts login -> must fail
        var loginResponse = await _client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(uniqueEmail, "Password123!"));
        loginResponse.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // Scenario 7: Customer cannot access garage API (403)
    [Fact]
    public async Task Scenario07_Customer_CannotAccess_GarageApi_ReturnsForbidden()
    {
        var customerAuth = await LoginAsync("customer@brocomod.com", "Password123!");
        var customerClient = CreateAuthenticatedClient(customerAuth.AccessToken);

        var response = await customerClient.GetAsync("/api/v1/garage/dashboard");
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // Scenario 8: Garage cannot access customer portal data (403)
    [Fact]
    public async Task Scenario08_Garage_CannotAccess_CustomerPortal_ReturnsForbidden()
    {
        var garageAuth = await LoginAsync("garage.owner@centralmetro.com", "Password123!");
        var garageClient = CreateAuthenticatedClient(garageAuth.AccessToken);

        var response = await garageClient.GetAsync("/api/v1/customer/dashboard");
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // Scenario 9: Advisor cannot access admin-only API (403)
    [Fact]
    public async Task Scenario09_Advisor_CannotAccess_AdminApi_ReturnsForbidden()
    {
        var advisorAuth = await LoginAsync("advisor@brocomod.com", "Password123!");
        var advisorClient = CreateAuthenticatedClient(advisorAuth.AccessToken);

        var response = await advisorClient.GetAsync("/api/v1/admin/settings");
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // Scenario 10: Customer cannot access internal garage quote endpoint
    [Fact]
    public async Task Scenario10_Customer_CannotAccess_InternalGarageQuotes()
    {
        var customerAuth = await LoginAsync("customer@brocomod.com", "Password123!");
        var customerClient = CreateAuthenticatedClient(customerAuth.AccessToken);

        var response = await customerClient.GetAsync("/api/v1/garage/quotes");
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // Scenario 11: Customer cannot access another customer or admin settings
    [Fact]
    public async Task Scenario11_Customer_CannotAccess_AdminSettings_ReturnsForbidden()
    {
        var customerAuth = await LoginAsync("customer@brocomod.com", "Password123!");
        var customerClient = CreateAuthenticatedClient(customerAuth.AccessToken);

        var response = await customerClient.GetAsync("/api/v1/admin/dashboard");
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // Scenario 12: Admin can access authorized admin resources
    [Fact]
    public async Task Scenario12_Admin_CanAccess_AuthorizedAdminResources()
    {
        var adminAuth = await LoginAsync("admin@brocomod.com", "Password123!");
        var adminClient = CreateAuthenticatedClient(adminAuth.AccessToken);

        var dashboardRes = await adminClient.GetAsync("/api/v1/admin/dashboard");
        dashboardRes.StatusCode.Should().Be(HttpStatusCode.OK);

        var settingsRes = await adminClient.GetAsync("/api/v1/admin/settings");
        settingsRes.StatusCode.Should().Be(HttpStatusCode.OK);

        var auditRes = await adminClient.GetAsync("/api/v1/admin/audit");
        auditRes.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // Scenario 13: Refresh token works
    [Fact]
    public async Task Scenario13_RefreshToken_RotatesSuccessfully()
    {
        var auth = await LoginAsync("customer@brocomod.com", "Password123!");
        var initialRefreshToken = auth.RefreshToken;

        var refreshResponse = await _client.PostAsJsonAsync("/api/v1/auth/refresh-token", new RefreshTokenRequest(initialRefreshToken));
        refreshResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var refreshBody = await refreshResponse.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(JsonOptions);
        refreshBody.Should().NotBeNull();
        refreshBody!.Data.Should().NotBeNull();
        refreshBody.Data!.AccessToken.Should().NotBeNullOrWhiteSpace();
        refreshBody.Data.RefreshToken.Should().NotBe(initialRefreshToken, "Token must be rotated");
    }

    // Scenario 14: Revoked refresh token cannot be reused
    [Fact]
    public async Task Scenario14_RevokedRefreshToken_CannotBeReused()
    {
        var auth = await LoginAsync("customer@brocomod.com", "Password123!");
        var initialRefreshToken = auth.RefreshToken;

        // Rotate once (which revokes initialRefreshToken)
        var firstRefresh = await _client.PostAsJsonAsync("/api/v1/auth/refresh-token", new RefreshTokenRequest(initialRefreshToken));
        firstRefresh.StatusCode.Should().Be(HttpStatusCode.OK);

        // Attempting to reuse revoked initialRefreshToken must fail
        var secondAttempt = await _client.PostAsJsonAsync("/api/v1/auth/refresh-token", new RefreshTokenRequest(initialRefreshToken));
        secondAttempt.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
