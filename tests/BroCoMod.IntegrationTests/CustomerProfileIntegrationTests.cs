using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using BroCoMod.Application.DTOs;
using BroCoMod.Domain.Constants;
using BroCoMod.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BroCoMod.IntegrationTests;

/// <summary>
/// A customer editing their own profile, and Indian mobile numbers being validated and stored in one format.
/// Every test registers its own customers, so nothing shared is changed.
/// </summary>
public class CustomerProfileIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private const string InvalidMobile = "Enter a valid 10-digit Indian mobile number.";
    private readonly WebApplicationFactory<Program> _factory;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public CustomerProfileIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    /// <summary>A fresh 10-digit mobile starting with 9.</summary>
    private static string NewMobile() => $"9{Random.Shared.Next(100_000_000, 999_999_999)}";

    private static string Canonical(string tenDigits) => $"+91 {tenDigits[..5]} {tenDigits[5..]}";

    private async Task<(HttpClient Client, AuthResponse Auth)> RegisterCustomerAsync(string phoneAsTyped, string name = "Profile Customer")
    {
        var anon = _factory.CreateClient();
        var response = await anon.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest(
            $"profile_{Guid.NewGuid():N}@brocomod.com", "Password123!", name, phoneAsTyped, AppRoles.Customer));
        response.StatusCode.Should().Be(HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        var auth = (await response.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(JsonOptions))!.Data!;

        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        return (client, auth);
    }

    private static async Task<CustomerProfileDto> GetProfileAsync(HttpClient client)
    {
        var body = await client.GetFromJsonAsync<ApiResponse<CustomerProfileDto>>("/api/v1/customer/profile", JsonOptions);
        return body!.Data!;
    }

    [Fact]
    public async Task Register_StoresTheMobileInCanonicalFormat()
    {
        var mobile = NewMobile();
        var (client, auth) = await RegisterCustomerAsync("0" + mobile);

        auth.User.PhoneNumber.Should().Be(Canonical(mobile));
        (await GetProfileAsync(client)).PhoneNumber.Should().Be(Canonical(mobile));
    }

    [Theory]
    [InlineData("+1 555 123 9999")]
    [InlineData("12345")]
    [InlineData("+91 40 4000 1234")]
    [InlineData("")]
    public async Task Register_WithAnInvalidMobile_Returns400WithAClearMessage(string phone)
    {
        var email = $"badphone_{Guid.NewGuid():N}@brocomod.com";
        var response = await _factory.CreateClient().PostAsJsonAsync("/api/v1/auth/register",
            new RegisterRequest(email, "Password123!", "Bad Phone", phone, AppRoles.Customer));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync()).Should().Contain(InvalidMobile);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        (await db.Users.AnyAsync(u => u.Email == email)).Should().BeFalse();
    }

    [Fact]
    public async Task UpdateProfile_SavesNameMobileAddressAndPreferredContact_AndWritesAnAuditEntry()
    {
        var (client, auth) = await RegisterCustomerAsync(NewMobile());
        var newMobile = NewMobile();

        var response = await client.PutAsJsonAsync("/api/v1/customer/profile", new UpdateCustomerProfileRequest(
            FullName: "  Asha Rao  ",
            PhoneNumber: "+91" + newMobile,
            Address: "  Flat 4B, Road No. 3, Banjara Hills, Hyderabad 500034 ",
            PreferredContactMethod: "whatsapp"));

        response.StatusCode.Should().Be(HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        var updated = (await response.Content.ReadFromJsonAsync<ApiResponse<CustomerProfileDto>>(JsonOptions))!.Data!;
        updated.FullName.Should().Be("Asha Rao");
        updated.PhoneNumber.Should().Be(Canonical(newMobile));
        updated.Address.Should().Be("Flat 4B, Road No. 3, Banjara Hills, Hyderabad 500034");
        updated.PreferredContactMethod.Should().Be("WhatsApp");
        updated.Email.Should().Be(auth.User.Email, "the email is the login and is not editable here");

        var reloaded = await GetProfileAsync(client);
        reloaded.Should().BeEquivalentTo(updated);

        // The signed-in user (header, menus) reads the same record.
        var me = await client.GetFromJsonAsync<ApiResponse<UserDto>>("/api/v1/users/me", JsonOptions);
        me!.Data!.FullName.Should().Be("Asha Rao");
        me.Data.PhoneNumber.Should().Be(Canonical(newMobile));

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var audit = await db.AuditLogs.AsNoTracking()
            .Where(a => a.EntityId == updated.CustomerId.ToString() && a.Action == AuditActions.UserUpdated)
            .ToListAsync();
        audit.Should().ContainSingle();
        audit[0].UserId.Should().Be(auth.User.Id);
        audit[0].Details.Should().Contain("name").And.Contain("mobile").And.NotContain(newMobile);
    }

    [Fact]
    public async Task UpdateProfile_WithoutAddressOrContact_KeepsTheCurrentValues()
    {
        var (client, _) = await RegisterCustomerAsync(NewMobile());
        (await client.PutAsJsonAsync("/api/v1/customer/profile", new UpdateCustomerProfileRequest(
            "First Name", NewMobile(), "12 MG Road, Secunderabad", "Phone"))).EnsureSuccessStatusCode();

        var mobile = NewMobile();
        var response = await client.PutAsJsonAsync("/api/v1/customer/profile", new { fullName = "Second Name", phoneNumber = mobile });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var profile = await GetProfileAsync(client);
        profile.FullName.Should().Be("Second Name");
        profile.PhoneNumber.Should().Be(Canonical(mobile));
        profile.Address.Should().Be("12 MG Road, Secunderabad");
        profile.PreferredContactMethod.Should().Be("Phone");
    }

    [Theory]
    [InlineData("+1 555 123 9999")]
    [InlineData("98765")]
    [InlineData("5876543210")]
    public async Task UpdateProfile_WithAnInvalidMobile_Returns400_AndChangesNothing(string phone)
    {
        var mobile = NewMobile();
        var (client, _) = await RegisterCustomerAsync(mobile, "Unchanged Customer");

        var response = await client.PutAsJsonAsync("/api/v1/customer/profile",
            new UpdateCustomerProfileRequest("Changed Name", phone, "Somewhere", "SMS"));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var raw = await response.Content.ReadAsStringAsync();
        raw.Should().Contain(InvalidMobile).And.Contain("PhoneNumber");

        var profile = await GetProfileAsync(client);
        profile.FullName.Should().Be("Unchanged Customer");
        profile.PhoneNumber.Should().Be(Canonical(mobile));
    }

    [Theory]
    [InlineData("A", "FullName")]
    [InlineData("   ", "FullName")]
    public async Task UpdateProfile_WithAnInvalidName_Returns400(string name, string field)
    {
        var (client, _) = await RegisterCustomerAsync(NewMobile());

        var response = await client.PutAsJsonAsync("/api/v1/customer/profile",
            new UpdateCustomerProfileRequest(name, NewMobile()));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync()).Should().Contain(field);
    }

    [Fact]
    public async Task UpdateProfile_WithAnUnknownContactMethod_Returns400()
    {
        var (client, _) = await RegisterCustomerAsync(NewMobile());

        var response = await client.PutAsJsonAsync("/api/v1/customer/profile",
            new UpdateCustomerProfileRequest("Valid Name", NewMobile(), null, "Pigeon"));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync()).Should().Contain("PreferredContactMethod");
    }

    [Fact]
    public async Task UpdateProfile_OnlyEverChangesTheCallersOwnProfile()
    {
        var otherMobile = NewMobile();
        var (other, otherAuth) = await RegisterCustomerAsync(otherMobile, "Other Customer");
        var (client, auth) = await RegisterCustomerAsync(NewMobile(), "Editing Customer");

        // Extra ids in the body are ignored: the profile is always the one in the caller's token.
        var response = await client.PutAsJsonAsync("/api/v1/customer/profile", new
        {
            customerId = otherAuth.User.CustomerId,
            userId = otherAuth.User.Id,
            fullName = "Edited Name",
            phoneNumber = NewMobile(),
            address = "New address",
            preferredContactMethod = "Email",
        });
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var edited = (await response.Content.ReadFromJsonAsync<ApiResponse<CustomerProfileDto>>(JsonOptions))!.Data!;
        edited.UserId.Should().Be(auth.User.Id);
        edited.FullName.Should().Be("Edited Name");

        var untouched = await GetProfileAsync(other);
        untouched.FullName.Should().Be("Other Customer");
        untouched.PhoneNumber.Should().Be(Canonical(otherMobile));
        untouched.Address.Should().BeEmpty();
    }

    [Fact]
    public async Task WebsiteEnquiry_SameNumberWrittenDifferently_IsOneEnquiry()
    {
        var anon = _factory.CreateClient();
        var mobile = NewMobile();

        var first = await anon.PostAsJsonAsync("/api/v1/leads", new CreateLeadRequest(mobile, "Hyderabad", null, null, "BASIC"));
        first.StatusCode.Should().Be(HttpStatusCode.OK, await first.Content.ReadAsStringAsync());
        var second = await anon.PostAsJsonAsync("/api/v1/leads", new CreateLeadRequest($"+91-{mobile[..5]}-{mobile[5..]}", "Hyderabad", null, null, "BASIC"));
        second.StatusCode.Should().Be(HttpStatusCode.OK);

        var a = (await first.Content.ReadFromJsonAsync<ApiResponse<LeadDto>>(JsonOptions))!.Data!;
        var b = (await second.Content.ReadFromJsonAsync<ApiResponse<LeadDto>>(JsonOptions))!.Data!;
        a.MobileNumber.Should().Be(Canonical(mobile));
        b.Id.Should().Be(a.Id);
    }

    [Fact]
    public async Task AdminCustomerSearch_FindsAStoredMobileByItsPlainDigits()
    {
        var mobile = NewMobile();
        var (_, auth) = await RegisterCustomerAsync(mobile, "Searchable Customer");

        var login = await _factory.CreateClient().PostAsJsonAsync("/api/v1/auth/login",
            new LoginRequest("admin@brocomod.com", "Password123!"));
        var adminAuth = (await login.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(JsonOptions))!.Data!;
        var admin = _factory.CreateClient();
        admin.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", adminAuth.AccessToken);

        foreach (var search in new[] { mobile, Canonical(mobile) })
        {
            var result = await admin.GetFromJsonAsync<ApiResponse<PagedResult<AdminCustomerListDto>>>(
                $"/api/v1/admin/customers?search={Uri.EscapeDataString(search)}", JsonOptions);
            result!.Data!.Items.Should().Contain(c => c.UserId == auth.User.Id, $"searching for '{search}'");
        }
    }

    [Fact]
    public async Task UpdateProfile_RequiresASignedInCustomer()
    {
        var anon = await _factory.CreateClient().PutAsJsonAsync("/api/v1/customer/profile",
            new UpdateCustomerProfileRequest("No One", NewMobile()));
        anon.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        var garageLogin = await _factory.CreateClient().PostAsJsonAsync("/api/v1/auth/login",
            new LoginRequest("garage.owner@centralmetro.com", "Password123!"));
        var garageAuth = (await garageLogin.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(JsonOptions))!.Data!;
        var garage = _factory.CreateClient();
        garage.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", garageAuth.AccessToken);

        var forbidden = await garage.PutAsJsonAsync("/api/v1/customer/profile",
            new UpdateCustomerProfileRequest("Garage Owner", NewMobile()));
        forbidden.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
