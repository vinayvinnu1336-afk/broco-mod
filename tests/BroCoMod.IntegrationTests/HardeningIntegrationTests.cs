using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BroCoMod.IntegrationTests;

/// <summary>
/// Regression tests for the security and operability hardening pass:
/// password-reset codes, per-client rate limiting, production-only lockdowns and health probes.
/// </summary>
public class HardeningIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public HardeningIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    private async Task<string> RegisterFreshCustomerAsync(HttpClient client)
    {
        var email = $"hardening_{Guid.NewGuid():N}@brocomod.com";
        var response = await client.PostAsJsonAsync("/api/v1/auth/register",
            new RegisterRequest(email, "Password123!", "Hardening Customer", TestMobiles.New()));
        response.EnsureSuccessStatusCode();
        return email;
    }

    [Fact]
    public async Task ForgotPassword_NeverReturnsTheResetCode()
    {
        var client = _factory.CreateClient();
        var email = await RegisterFreshCustomerAsync(client);

        var response = await client.PostAsJsonAsync("/api/v1/auth/forgot-password", new ForgotPasswordRequest(email));
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var raw = await response.Content.ReadAsStringAsync();
        var body = JsonSerializer.Deserialize<ApiResponse<JsonElement?>>(raw, JsonOptions);
        body!.Success.Should().BeTrue();
        body.Data.Should().BeNull("the reset code must only be delivered out-of-band");
        raw.Should().NotMatchRegex("\\b\\d{6}\\b");
    }

    [Fact]
    public async Task ForgotPassword_UnknownEmail_LooksIdenticalToKnownEmail()
    {
        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/v1/auth/forgot-password",
            new ForgotPasswordRequest($"nobody_{Guid.NewGuid():N}@brocomod.com"));

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<JsonElement?>>(JsonOptions);
        body!.Data.Should().BeNull();
    }

    [Fact]
    public async Task ResetPassword_WithValidCode_Succeeds_AndCodeIsSingleUse()
    {
        var client = _factory.CreateClient();
        var email = await RegisterFreshCustomerAsync(client);

        string code;
        using (var scope = _factory.Services.CreateScope())
        {
            code = await scope.ServiceProvider.GetRequiredService<IOtpProvider>().GenerateOtpAsync(email, "PasswordReset");
        }

        var reset = await client.PostAsJsonAsync("/api/v1/auth/reset-password", new ResetPasswordRequest(email, code, "NewPassword456!"));
        reset.StatusCode.Should().Be(HttpStatusCode.OK);

        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, "NewPassword456!"));
        login.StatusCode.Should().Be(HttpStatusCode.OK);

        var replay = await client.PostAsJsonAsync("/api/v1/auth/reset-password", new ResetPasswordRequest(email, code, "Another789!x"));
        replay.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task ResetPassword_LocksCodeAfterFiveWrongGuesses()
    {
        var client = _factory.CreateClient();
        var email = await RegisterFreshCustomerAsync(client);

        string code;
        using (var scope = _factory.Services.CreateScope())
        {
            code = await scope.ServiceProvider.GetRequiredService<IOtpProvider>().GenerateOtpAsync(email, "PasswordReset");
        }

        var wrong = code == "000000" ? "111111" : "000000";
        for (var i = 0; i < 5; i++)
        {
            var attempt = await client.PostAsJsonAsync("/api/v1/auth/reset-password", new ResetPasswordRequest(email, wrong, "NewPassword456!"));
            attempt.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        }

        var correctButLocked = await client.PostAsJsonAsync("/api/v1/auth/reset-password", new ResetPasswordRequest(email, code, "NewPassword456!"));
        correctButLocked.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task AuthEndpoints_AreRateLimitedPerClient_With429AndRetryAfter()
    {
        using var limitedFactory = _factory.WithWebHostBuilder(b => b.UseSetting("RateLimiting:AuthPermitPerMinute", "3"));
        var client = limitedFactory.CreateClient();

        HttpResponseMessage? last = null;
        for (var i = 0; i < 4; i++)
        {
            last = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest("nobody@brocomod.com", "wrong-password"));
        }

        last!.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
        last.Headers.Contains("Retry-After").Should().BeTrue();
        var body = await last.Content.ReadFromJsonAsync<ApiResponse<object>>(JsonOptions);
        body!.Success.Should().BeFalse();
    }

    [Theory]
    [InlineData("SUPER_ADMIN")]
    [InlineData("ADVISOR")]
    [InlineData("GARAGE_STAFF")]
    [InlineData("SOME_NEW_ROLE")]
    public async Task Register_CannotSelfAssignPrivilegedRoles(string role)
    {
        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest(
            $"escalate_{Guid.NewGuid():N}@brocomod.com", "Password123!", "Escalation Attempt", TestMobiles.New(), Role: role));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Register_GarageOwner_CreatesOwnPendingGarage_AndCannotJoinExistingGarage()
    {
        var client = _factory.CreateClient();
        Guid existingGarageId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<BroCoMod.Infrastructure.Persistence.ApplicationDbContext>();
            existingGarageId = db.Garages.Select(g => g.Id).First();
        }

        var email = $"newgarage_{Guid.NewGuid():N}@brocomod.com";
        var response = await client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest(
            email, "Password123!", "New Garage Owner", TestMobiles.New(),
            Role: "GARAGE_OWNER", GarageName: "Brand New Motors", Address: "1 Test Road, Hyderabad",
            GarageId: existingGarageId, Latitude: 17.40, Longitude: 78.45));

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        using var verifyScope = _factory.Services.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<BroCoMod.Infrastructure.Persistence.ApplicationDbContext>();
        var link = verifyDb.GarageUsers.Single(gu => gu.User.Email == email);
        link.GarageId.Should().NotBe(existingGarageId);
        var garage = verifyDb.Garages.Single(g => g.Id == link.GarageId);
        garage.Name.Should().Be("Brand New Motors");
        garage.IsVerified.Should().BeFalse();
        garage.Status.Should().Be(BroCoMod.Domain.Enums.GarageStatus.PendingVerification);
    }

    [Fact]
    public async Task HealthProbes_LiveAndReady_AreAvailable()
    {
        var client = _factory.CreateClient();
        (await client.GetAsync("/healthz/live")).StatusCode.Should().Be(HttpStatusCode.OK);
        (await client.GetAsync("/healthz/ready")).StatusCode.Should().BeOneOf(HttpStatusCode.OK, HttpStatusCode.ServiceUnavailable);
    }

    [Fact]
    public async Task Production_HidesSwaggerAndDiagnosticEndpoints()
    {
        using var prodFactory = _factory.WithWebHostBuilder(b =>
        {
            b.UseEnvironment("Production");
            b.UseSetting("Jwt:Secret", "integration-test-production-secret-0123456789abcdef");
        });
        var client = prodFactory.CreateClient();

        (await client.GetAsync("/swagger/index.html")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await client.GetAsync("/api/system/garages/eligible?longitude=78.44&latitude=17.41")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await client.GetAsync("/api/system/quote-isolation-demo")).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public void Production_WithoutJwtSecret_RefusesToStart()
    {
        using var prodFactory = _factory.WithWebHostBuilder(b =>
        {
            b.UseEnvironment("Production");
            b.UseSetting("Jwt:Secret", "");
        });

        var act = () => prodFactory.CreateClient();
        act.Should().Throw<InvalidOperationException>().WithMessage("*Jwt:Secret*");
    }
}
