using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace BroCoMod.IntegrationTests;

public class HealthEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public HealthEndpointTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetSystemInfo_ReturnsSuccess_WithPlatformArchitectureMetadata()
    {
        // Act
        var response = await _client.GetAsync("/api/system/info");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("BroCo Mod Platform");
        content.Should().Contain("Modular Monolith");
        content.Should().Contain("PostgreSQL + PostGIS");
        content.Should().Contain("Customer Portal");
        content.Should().Contain("Garage Portal");
        content.Should().Contain("Advisor Portal");
        content.Should().Contain("Super Admin Portal");
    }

    [Fact]
    public async Task GetQuoteIsolationDemo_ReturnsPayload_SegregatingCustomerFromInternalPricing()
    {
        // Act
        var response = await _client.GetAsync("/api/system/quote-isolation-demo");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        using var jsonDoc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = jsonDoc.RootElement;

        // Customer visible payload must have customerFacingPrice but not internal cost
        var customerPayload = root.GetProperty("customerVisiblePayload");
        customerPayload.TryGetProperty("customerFacingPrice", out _).Should().BeTrue();
        customerPayload.TryGetProperty("garageInternalPrice", out _).Should().BeFalse();
        customerPayload.TryGetProperty("internalCostBreakdown", out _).Should().BeFalse();

        // Garage internal payload contains internal cost
        var garagePayload = root.GetProperty("garageInternalPayload");
        garagePayload.TryGetProperty("garageInternalPrice", out _).Should().BeTrue();
        garagePayload.TryGetProperty("internalCostBreakdown", out _).Should().BeTrue();
    }
}
