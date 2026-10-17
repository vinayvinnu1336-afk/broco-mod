using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Constants;
using BroCoMod.Domain.Enums;
using BroCoMod.Infrastructure.Persistence;
using BroCoMod.Infrastructure.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BroCoMod.IntegrationTests;

/// <summary>
/// Garage owners and managers editing their own garage's listing. Every test signs up its own garage, so the
/// demo garages are never touched; a garage a test verifies is deactivated again at the end.
/// </summary>
public class GarageProfileIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private const string InvalidMobile = "Enter a valid 10-digit Indian mobile number.";
    // Hyderabad and Mancherial are live service areas; Delhi is configured but not live.
    private const double HydLat = 17.4065, HydLng = 78.4772;
    private const double MancherialLat = 18.8750, MancherialLng = 79.4500;
    private const double DelhiLat = 28.6139, DelhiLng = 77.2090;

    private readonly WebApplicationFactory<Program> _factory;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public GarageProfileIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    private static string NewMobile() => $"9{Random.Shared.Next(100_000_000, 999_999_999)}";

    private static string Canonical(string tenDigits) => $"+91 {tenDigits[..5]} {tenDigits[5..]}";

    private HttpClient ClientWith(string token)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private async Task<(HttpClient Client, AuthResponse Auth)> RegisterGarageOwnerAsync(string garageName = "Profile Test Motors")
    {
        var response = await _factory.CreateClient().PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest(
            $"garageprofile_{Guid.NewGuid():N}@brocomod.com", "Password123!", "Profile Owner", NewMobile(),
            Role: AppRoles.GarageOwner, GarageName: garageName, Address: "12 Test Lane, Hyderabad 500001",
            Latitude: HydLat, Longitude: HydLng));
        response.StatusCode.Should().Be(HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        var auth = (await response.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(JsonOptions))!.Data!;
        auth.User.GarageId.Should().NotBeNull();
        return (ClientWith(auth.AccessToken), auth);
    }

    /// <summary>A token for a fresh user acting in <paramref name="garageRole"/> at the given garage.</summary>
    private async Task<HttpClient> MemberClientAsync(Guid garageId, string garageRole)
    {
        var response = await _factory.CreateClient().PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest(
            $"garagemember_{Guid.NewGuid():N}@brocomod.com", "Password123!", "Garage Member", NewMobile(), AppRoles.Customer));
        response.StatusCode.Should().Be(HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        var userId = (await response.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(JsonOptions))!.Data!.User.Id;

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var tokens = scope.ServiceProvider.GetRequiredService<ITokenService>();
        var user = await db.Users.SingleAsync(u => u.Id == userId);
        var token = tokens.GenerateAccessToken(user, new[] { garageRole },
            AppPermissions.GetDefaultPermissionsForRole(garageRole), null, garageId, garageRole);
        return ClientWith(token);
    }

    private static UpdateGarageProfileRequest ValidUpdate(string phone, double? lat = null, double? lng = null, string name = "Renamed Motors") =>
        new(name, phone, $"desk_{Guid.NewGuid():N}@brocomod.com", "  45 New Road, Ameerpet, Hyderabad 500016  ", lat, lng);

    private static async Task<GarageProfileDto> ReadProfileAsync(HttpResponseMessage response)
    {
        response.StatusCode.Should().Be(HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        return (await response.Content.ReadFromJsonAsync<ApiResponse<GarageProfileDto>>(JsonOptions))!.Data!;
    }

    [Fact]
    public async Task Owner_UpdatesTheProfile_ChangesArePersisted_AndThePhoneIsNormalised()
    {
        var (client, auth) = await RegisterGarageOwnerAsync();
        var mobile = NewMobile();
        var request = ValidUpdate("0" + mobile, MancherialLat, MancherialLng) with { YourFullName = "  Ravi Kumar  " };

        var updated = await ReadProfileAsync(await client.PutAsJsonAsync("/api/v1/garage/profile", request));

        updated.Name.Should().Be("Renamed Motors");
        updated.PhoneNumber.Should().Be(Canonical(mobile));
        updated.Email.Should().Be(request.Email);
        updated.Address.Should().Be("45 New Road, Ameerpet, Hyderabad 500016");
        updated.Latitude.Should().BeApproximately(MancherialLat, 1e-6);
        updated.Longitude.Should().BeApproximately(MancherialLng, 1e-6);
        updated.Status.Should().Be(nameof(GarageStatus.PendingVerification));
        updated.IsVerified.Should().BeFalse();
        updated.TeamMembers.Should().ContainSingle(m => m.UserId == auth.User.Id && m.FullName == "Ravi Kumar");

        // A fresh read sees the same data, and the admin garage detail shows the edit too.
        var reread = (await client.GetFromJsonAsync<ApiResponse<GarageProfileDto>>("/api/v1/garage/profile", JsonOptions))!.Data!;
        reread.Should().BeEquivalentTo(updated, o => o.Excluding(p => p.TeamMembers).Excluding(p => p.UpdatedAtUtc));

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var garageId = auth.User.GarageId!.Value;
        var garage = await db.Garages.AsNoTracking().SingleAsync(g => g.Id == garageId);
        garage.Name.Should().Be("Renamed Motors");
        garage.PhoneNumber.Should().Be(Canonical(mobile));

        var audit = await db.AuditLogs.AsNoTracking()
            .Where(a => a.Action == AuditActions.GarageProfileUpdated && a.EntityId == garageId.ToString())
            .ToListAsync();
        audit.Should().ContainSingle();
        audit[0].Details.Should().Contain("name").And.Contain("phone").And.Contain("workshop location").And.Contain("your name");
        audit[0].Details.Should().NotContain(mobile, "the audit lists field names, not personal data");

        // Pending garages are not verified yet, so nothing goes to admins.
        (await db.Notifications.AnyAsync(n => n.ReferenceId == garageId && n.Type == GaragePortalService.GarageProfileChangedNotification))
            .Should().BeFalse();
    }

    [Fact]
    public async Task Admin_SeesTheEditedDetails_OnTheGarageDetailPage()
    {
        var (client, auth) = await RegisterGarageOwnerAsync();
        var mobile = NewMobile();
        await ReadProfileAsync(await client.PutAsJsonAsync("/api/v1/garage/profile", ValidUpdate(mobile, name: "Admin Visible Motors")));

        var admin = ClientWith(await LoginAdminAsync());
        var detail = await admin.GetFromJsonAsync<ApiResponse<AdminGarageDetailDto>>($"/api/v1/admin/garages/{auth.User.GarageId}", JsonOptions);
        detail!.Data!.Name.Should().Be("Admin Visible Motors");
        detail.Data.PhoneNumber.Should().Be(Canonical(mobile));
        detail.Data.Address.Should().Be("45 New Road, Ameerpet, Hyderabad 500016");
    }

    [Theory]
    [InlineData("12345")]
    [InlineData("+1 555 123 9999")]
    [InlineData("")]
    public async Task InvalidPhone_Returns400_AndChangesNothing(string phone)
    {
        var (client, auth) = await RegisterGarageOwnerAsync("Phone Check Motors");

        var response = await client.PutAsJsonAsync("/api/v1/garage/profile", ValidUpdate(phone));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync()).Should().Contain(InvalidMobile);
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        (await db.Garages.AsNoTracking().SingleAsync(g => g.Id == auth.User.GarageId)).Name.Should().Be("Phone Check Motors");
    }

    [Fact]
    public async Task WorkshopPin_OutsideEveryLiveServiceArea_Returns400()
    {
        var (client, auth) = await RegisterGarageOwnerAsync();

        var response = await client.PutAsJsonAsync("/api/v1/garage/profile", ValidUpdate(NewMobile(), DelhiLat, DelhiLng));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync()).Should().Contain("We currently serve only");
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var garage = await db.Garages.AsNoTracking().SingleAsync(g => g.Id == auth.User.GarageId);
        garage.Location.Y.Should().BeApproximately(HydLat, 1e-6);
        garage.Name.Should().Be("Profile Test Motors");
    }

    [Fact]
    public async Task OnlyLatitude_OrABlankName_Returns400WithAClearMessage()
    {
        var (client, _) = await RegisterGarageOwnerAsync();

        var halfPin = await client.PutAsJsonAsync("/api/v1/garage/profile", ValidUpdate(NewMobile(), HydLat, null));
        halfPin.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await halfPin.Content.ReadAsStringAsync()).Should().Contain("both latitude and longitude");

        var blankName = await client.PutAsJsonAsync("/api/v1/garage/profile", ValidUpdate(NewMobile(), name: " "));
        blankName.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await blankName.Content.ReadAsStringAsync()).Should().Contain("garage name");
    }

    [Fact]
    public async Task GarageStaff_CanViewButNotEdit_TheProfile()
    {
        var (_, auth) = await RegisterGarageOwnerAsync("Staff Check Motors");
        var staff = await MemberClientAsync(auth.User.GarageId!.Value, AppRoles.GarageStaff);

        (await staff.GetAsync("/api/v1/garage/profile")).StatusCode.Should().Be(HttpStatusCode.OK);
        var response = await staff.PutAsJsonAsync("/api/v1/garage/profile", ValidUpdate(NewMobile()));

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        (await db.Garages.AsNoTracking().SingleAsync(g => g.Id == auth.User.GarageId)).Name.Should().Be("Staff Check Motors");
    }

    [Fact]
    public async Task GarageManager_CanEdit_TheProfile()
    {
        var (_, auth) = await RegisterGarageOwnerAsync();
        var manager = await MemberClientAsync(auth.User.GarageId!.Value, AppRoles.GarageManager);

        var updated = await ReadProfileAsync(await manager.PutAsJsonAsync("/api/v1/garage/profile", ValidUpdate(NewMobile(), name: "Manager Edited Motors")));

        updated.GarageId.Should().Be(auth.User.GarageId!.Value);
        updated.Name.Should().Be("Manager Edited Motors");
    }

    [Fact]
    public async Task AnotherGaragesOwner_OnlyEverEditsTheirOwnGarage()
    {
        var (_, ownerA) = await RegisterGarageOwnerAsync("Garage A Motors");
        var (clientB, ownerB) = await RegisterGarageOwnerAsync("Garage B Motors");

        var updated = await ReadProfileAsync(await clientB.PutAsJsonAsync("/api/v1/garage/profile", ValidUpdate(NewMobile(), name: "Garage B Renamed")));

        updated.GarageId.Should().Be(ownerB.User.GarageId!.Value);
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var garageA = await db.Garages.AsNoTracking().SingleAsync(g => g.Id == ownerA.User.GarageId);
        garageA.Name.Should().Be("Garage A Motors");
        garageA.Address.Should().Be("12 Test Lane, Hyderabad 500001");
    }

    [Fact]
    public async Task VerifiedGarage_MovingItsPin_StaysVerified_AndAdminsAreNotifiedAndAudited()
    {
        var (client, auth) = await RegisterGarageOwnerAsync("Verified Move Motors");
        var garageId = auth.User.GarageId!.Value;
        var admin = ClientWith(await LoginAdminAsync());
        (await admin.PostAsJsonAsync($"/api/v1/admin/garages/{garageId}/verify", new VerifyGarageRequest()))
            .StatusCode.Should().Be(HttpStatusCode.OK);

        try
        {
            var current = (await client.GetFromJsonAsync<ApiResponse<GarageProfileDto>>("/api/v1/garage/profile", JsonOptions))!.Data!;
            current.IsVerified.Should().BeTrue();

            var updated = await ReadProfileAsync(await client.PutAsJsonAsync("/api/v1/garage/profile",
                new UpdateGarageProfileRequest(current.Name, current.PhoneNumber, current.Email, current.Address, MancherialLat, MancherialLng)));

            updated.IsVerified.Should().BeTrue("a garage is never silently un-verified");
            updated.Status.Should().Be(nameof(GarageStatus.Verified));

            using var scope = _factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var adminId = await db.Users.Where(u => u.Email == "admin@brocomod.com").Select(u => u.Id).SingleAsync();
            var notes = await db.Notifications.AsNoTracking()
                .Where(n => n.ReferenceId == garageId && n.Type == GaragePortalService.GarageProfileChangedNotification)
                .ToListAsync();
            notes.Should().Contain(n => n.UserId == adminId);
            notes.Should().OnlyContain(n => n.Title == "Garage changed its location" && n.Message.Contains("Verified Move Motors"));

            var audit = await db.AuditLogs.AsNoTracking()
                .SingleAsync(a => a.Action == AuditActions.GarageProfileUpdated && a.EntityId == garageId.ToString());
            audit.Details.Should().Contain("workshop location").And.NotContain("phone");

            // Saving again with the same pin is not a move: no second round of admin notifications.
            await ReadProfileAsync(await client.PutAsJsonAsync("/api/v1/garage/profile",
                new UpdateGarageProfileRequest(current.Name, current.PhoneNumber, current.Email, current.Address, MancherialLat, MancherialLng)));
            (await db.Notifications.CountAsync(n => n.ReferenceId == garageId && n.Type == GaragePortalService.GarageProfileChangedNotification))
                .Should().Be(notes.Count);
        }
        finally
        {
            // Keep this verified test garage out of other tests' garage matching.
            await admin.PostAsJsonAsync($"/api/v1/admin/garages/{garageId}/deactivate", new DeactivateGarageRequest("Integration test cleanup"));
        }
    }

    private async Task<string> LoginAdminAsync()
    {
        var response = await _factory.CreateClient().PostAsJsonAsync("/api/v1/auth/login", new LoginRequest("admin@brocomod.com", "Password123!"));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(JsonOptions))!.Data!.AccessToken;
    }
}
