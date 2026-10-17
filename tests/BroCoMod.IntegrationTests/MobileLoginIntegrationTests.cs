using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using BroCoMod.Application.Common;
using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Constants;
using BroCoMod.Domain.Entities.Identity;
using BroCoMod.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BroCoMod.IntegrationTests;

/// <summary>
/// Signing in with a mobile number, and one mobile number belonging to one active account.
/// Every test uses its own random numbers, so nothing shared is touched.
/// </summary>
public class MobileLoginIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private const string Password = "Password123!";
    private const string InvalidMobileLogin = "Invalid mobile number or password.";
    private readonly WebApplicationFactory<Program> _factory;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public MobileLoginIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    private async Task<(HttpResponseMessage Response, AuthResponse? Auth)> RegisterAsync(
        string phone, string role = AppRoles.Customer, string? email = null)
    {
        var response = await _factory.CreateClient().PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest(
            email ?? $"mobilelogin_{Guid.NewGuid():N}@brocomod.com", Password, "Mobile Login User", phone,
            Role: role,
            GarageName: role == AppRoles.GarageOwner ? "Mobile Login Motors" : null,
            Address: role == AppRoles.GarageOwner ? "12 Test Lane, Hyderabad 500001" : null,
            Latitude: role == AppRoles.GarageOwner ? 17.4126 : null,
            Longitude: role == AppRoles.GarageOwner ? 78.4482 : null));
        var auth = response.IsSuccessStatusCode
            ? (await response.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(JsonOptions))!.Data
            : null;
        return (response, auth);
    }

    private async Task<AuthResponse> RegisterOkAsync(string phone, string role = AppRoles.Customer)
    {
        var (response, auth) = await RegisterAsync(phone, role);
        response.StatusCode.Should().Be(HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        return auth!;
    }

    private Task<HttpResponseMessage> LoginByMobileAsync(string mobile, string password = Password) =>
        _factory.CreateClient().PostAsJsonAsync("/api/v1/auth/login", new { mobileNumber = mobile, password });

    private HttpClient ClientWith(string token)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private static async Task<string> MessageOf(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<ApiResponse<object>>(JsonOptions))!.Message;

    /// <summary>Adds an account straight to the database, as older data may hold, bypassing the sign-up check.</summary>
    private async Task<User> InsertUserAsync(string phone, string password, bool isActive = true)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var hash = scope.ServiceProvider.GetRequiredService<IPasswordHasher>().HashPassword(password, out var salt);
        var user = new User($"legacy_{Guid.NewGuid():N}@brocomod.com", "Legacy Account", phone, hash, salt);
        if (!isActive) user.SetActive(false);
        db.Users.Add(user);
        var role = await db.Roles.FirstAsync(r => r.Name == AppRoles.Customer);
        db.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = role.Id });
        await db.SaveChangesAsync();
        return user;
    }

    [Theory]
    [InlineData("plain")]      // 9876543210
    [InlineData("canonical")]  // +91 98765 43210
    [InlineData("trunk")]      // 09876543210
    [InlineData("compact")]    // +919876543210
    public async Task Login_WithTheMobileInAnyCommonFormat_SignsInToThatAccount(string format)
    {
        var mobile = TestMobiles.NewNational();
        var registered = await RegisterOkAsync(TestMobiles.Canonical(mobile));
        var typed = format switch
        {
            "plain" => mobile,
            "canonical" => TestMobiles.Canonical(mobile),
            "trunk" => "0" + mobile,
            _ => "+91" + mobile,
        };

        var response = await LoginByMobileAsync(typed);

        response.StatusCode.Should().Be(HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        var auth = (await response.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(JsonOptions))!.Data!;
        auth.User.Id.Should().Be(registered.User.Id);
        auth.User.Roles.Should().Contain(AppRoles.Customer);
        (await ClientWith(auth.AccessToken).GetAsync("/api/v1/customer/profile")).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Login_WithEmail_StillWorks()
    {
        var registered = await RegisterOkAsync(TestMobiles.New());

        var response = await _factory.CreateClient().PostAsJsonAsync("/api/v1/auth/login",
            new LoginRequest(registered.User.Email, Password));

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await response.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(JsonOptions))!.Data!.User.Id
            .Should().Be(registered.User.Id);
    }

    [Fact]
    public async Task Login_ByMobile_WithAWrongPasswordOrAnUnknownNumber_GivesTheSameGenericError()
    {
        var mobile = TestMobiles.New();
        await RegisterOkAsync(mobile);

        var wrongPassword = await LoginByMobileAsync(mobile, "NotThePassword1!");
        var unknownNumber = await LoginByMobileAsync(TestMobiles.New());
        var notAMobile = await LoginByMobileAsync("12345");

        foreach (var response in new[] { wrongPassword, unknownNumber, notAMobile })
        {
            response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
            (await MessageOf(response)).Should().Be(InvalidMobileLogin);
        }
    }

    [Fact]
    public async Task Login_ByMobile_CountsFailedAttemptsTowardsTheLockout()
    {
        var mobile = TestMobiles.New();
        var registered = await RegisterOkAsync(mobile);

        for (var i = 0; i < 5; i++)
            (await LoginByMobileAsync(mobile, "NotThePassword1!")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        var locked = await LoginByMobileAsync(mobile);
        locked.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await MessageOf(locked)).Should().Contain("temporarily locked");

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.AsNoTracking().SingleAsync(u => u.Id == registered.User.Id);
        user.LockoutEndUtc.Should().NotBeNull();
        (await db.AuditLogs.AsNoTracking().CountAsync(a => a.UserId == registered.User.Id && a.Action == AuditActions.LoginFailed))
            .Should().BeGreaterThanOrEqualTo(5);
    }

    [Fact]
    public async Task Login_ByAMobileSharedByTwoActiveAccounts_IsRefused_AndPointsToEmail()
    {
        var mobile = TestMobiles.NewNational();
        var registered = await RegisterOkAsync(TestMobiles.Canonical(mobile));
        // An older account stored the same number in a different format, with another password.
        await InsertUserAsync(mobile, "SomeOtherPassword1!");

        var withAPassword = await LoginByMobileAsync(mobile);
        withAPassword.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await MessageOf(withAPassword)).Should().Be(IndianMobile.SharedByAccountsMessage);

        // Without a matching password nothing is revealed about the number.
        var wrongPassword = await LoginByMobileAsync(mobile, "NotThePassword1!");
        (await MessageOf(wrongPassword)).Should().Be(InvalidMobileLogin);

        // Email sign-in is the way out.
        var byEmail = await _factory.CreateClient().PostAsJsonAsync("/api/v1/auth/login",
            new LoginRequest(registered.User.Email, Password));
        byEmail.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task AnInactiveAccountOnTheSameMobile_DoesNotBlockSignUpOrMobileSignIn()
    {
        var mobile = TestMobiles.New();
        await InsertUserAsync(mobile, Password, isActive: false);

        var registered = await RegisterOkAsync(mobile);

        var response = await LoginByMobileAsync(mobile);
        response.StatusCode.Should().Be(HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        (await response.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(JsonOptions))!.Data!.User.Id
            .Should().Be(registered.User.Id);
    }

    [Theory]
    [InlineData(AppRoles.Customer)]
    [InlineData(AppRoles.GarageOwner)]
    public async Task Register_WithAMobileAlreadyInUse_IsRejected(string role)
    {
        var mobile = TestMobiles.NewNational();
        await RegisterOkAsync(TestMobiles.Canonical(mobile));

        var (response, _) = await RegisterAsync("0" + mobile, role);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await MessageOf(response)).Should().Be(IndianMobile.AlreadyRegisteredMessage);
    }

    [Fact]
    public async Task CustomerProfile_ChangingToAnotherAccountsMobile_IsRejected_ButReSavingYourOwnIsFine()
    {
        var takenMobile = TestMobiles.NewNational();
        await RegisterOkAsync(TestMobiles.Canonical(takenMobile));
        var ownMobile = TestMobiles.NewNational();
        var me = await RegisterOkAsync(TestMobiles.Canonical(ownMobile));
        var client = ClientWith(me.AccessToken);

        var taken = await client.PutAsJsonAsync("/api/v1/customer/profile",
            new UpdateCustomerProfileRequest("Mobile Login User", "+91" + takenMobile));
        taken.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await MessageOf(taken)).Should().Be(IndianMobile.AlreadyRegisteredMessage);

        var own = await client.PutAsJsonAsync("/api/v1/customer/profile",
            new UpdateCustomerProfileRequest("Renamed User", ownMobile));
        own.StatusCode.Should().Be(HttpStatusCode.OK, await own.Content.ReadAsStringAsync());

        var fresh = TestMobiles.NewNational();
        var changed = await client.PutAsJsonAsync("/api/v1/customer/profile",
            new UpdateCustomerProfileRequest("Renamed User", fresh));
        changed.StatusCode.Should().Be(HttpStatusCode.OK);
        (await LoginByMobileAsync(fresh)).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GarageProfile_UsingACustomersMobile_IsRejected_ButTheOwnersOwnIsFine()
    {
        var customerMobile = TestMobiles.NewNational();
        await RegisterOkAsync(TestMobiles.Canonical(customerMobile));
        var ownerMobile = TestMobiles.NewNational();
        var owner = await RegisterOkAsync(TestMobiles.Canonical(ownerMobile), AppRoles.GarageOwner);
        var client = ClientWith(owner.AccessToken);

        UpdateGarageProfileRequest Update(string phone) =>
            new("Mobile Login Motors", phone, $"desk_{Guid.NewGuid():N}@brocomod.com", "45 New Road, Ameerpet, Hyderabad 500016");

        var taken = await client.PutAsJsonAsync("/api/v1/garage/profile", Update(customerMobile));
        taken.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await MessageOf(taken)).Should().Be(IndianMobile.AlreadyRegisteredMessage);

        var desk = await client.PutAsJsonAsync("/api/v1/garage/profile", Update(TestMobiles.NewNational()));
        desk.StatusCode.Should().Be(HttpStatusCode.OK, await desk.Content.ReadAsStringAsync());

        var backToOwn = await client.PutAsJsonAsync("/api/v1/garage/profile", Update(ownerMobile));
        backToOwn.StatusCode.Should().Be(HttpStatusCode.OK, await backToOwn.Content.ReadAsStringAsync());

        // The garage owner signs in with their mobile too.
        var login = await LoginByMobileAsync(ownerMobile);
        login.StatusCode.Should().Be(HttpStatusCode.OK);
        (await login.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(JsonOptions))!.Data!.User.GarageId
            .Should().Be(owner.User.GarageId);
    }
}
