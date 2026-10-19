using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using BroCoMod.Application.Common;
using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Constants;
using BroCoMod.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BroCoMod.IntegrationTests;

/// <summary>
/// Admin → Advisors: creating advisor accounts, promoting customer accounts and editing advisors. Email goes to a
/// capturing fake. Every test makes its own accounts with random mobiles and emails; shared demo accounts are only
/// signed in to (and the admin account is only used for a refused promotion, which changes nothing).
/// </summary>
public class AdminAdvisorAccountsIntegrationTests : IClassFixture<WebApplicationFactory<Program>>, IDisposable
{
    private const string Password = "Password123!";
    private const string PublicUrl = "https://broco.test.example.in";
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    private readonly WebApplicationFactory<Program> _host;
    private readonly CapturingEmailSender _email = new();

    public AdminAdvisorAccountsIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _host = factory.WithWebHostBuilder(b =>
        {
            b.UseSetting("App:PublicUrl", PublicUrl);
            b.ConfigureTestServices(services => services.AddSingleton<IEmailSender>(_email));
        });
    }

    public void Dispose() => _host.Dispose();

    // ------------------------------------------------------------------ helpers

    private static string NewEmail(string prefix = "advisor") => $"{prefix}_{Guid.NewGuid():N}@brocomod.com";

    private async Task<HttpResponseMessage> LoginAsync(string? email, string password, string? mobile = null) =>
        await _host.CreateClient().PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, password, mobile));

    private async Task<AuthResponse> LoginOkAsync(string? email, string password, string? mobile = null)
    {
        var response = await LoginAsync(email, password, mobile);
        response.StatusCode.Should().Be(HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        return (await response.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(JsonOptions))!.Data!;
    }

    private HttpClient ClientWith(string token)
    {
        var client = _host.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private async Task<HttpClient> AdminAsync() => ClientWith((await LoginOkAsync("admin@brocomod.com", Password)).AccessToken);

    private async Task<AuthResponse> RegisterAsync(string email, string mobile, string role = AppRoles.Customer)
    {
        var response = await _host.CreateClient().PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest(
            email, Password, "Existing Person", mobile, Role: role,
            GarageName: role == AppRoles.GarageOwner ? "Advisor Test Motors" : null,
            Address: role == AppRoles.GarageOwner ? "1 Test Road, Hyderabad 500001" : null,
            Latitude: role == AppRoles.GarageOwner ? 17.41 : null,
            Longitude: role == AppRoles.GarageOwner ? 78.44 : null));
        response.StatusCode.Should().Be(HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        return (await response.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(JsonOptions))!.Data!;
    }

    private static async Task<ApiResponse<T>> BodyAsync<T>(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<ApiResponse<T>>(JsonOptions))!;

    // ------------------------------------------------------------------ create

    [Fact]
    public async Task CreateAdvisor_WithAGeneratedPassword_CanSignInByMobileAndUseTheAdvisorPortal()
    {
        var admin = await AdminAsync();
        var mobile = TestMobiles.NewNational();
        var email = NewEmail();

        var response = await admin.PostAsJsonAsync("/api/v1/admin/advisors", new
        {
            fullName = "  Priya   Sharma ",
            mobileNumber = mobile,
            email = email.ToUpperInvariant(),
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created, await response.Content.ReadAsStringAsync());
        response.Headers.CacheControl!.NoStore.Should().BeTrue();
        var created = (await BodyAsync<CreatedAdvisorDto>(response)).Data!;
        created.PasswordGenerated.Should().BeTrue();
        created.TemporaryPassword.Should().HaveLength(TemporaryPassword.Length)
            .And.MatchRegex("^[A-HJ-NP-Za-km-z2-9]{12}$")
            .And.MatchRegex("[A-Z]").And.MatchRegex("[a-z]").And.MatchRegex("[0-9]");
        created.LoginMobile.Should().Be(TestMobiles.Canonical(mobile));
        created.Advisor.FullName.Should().Be("Priya Sharma");
        created.Advisor.Email.Should().Be(email);
        created.Advisor.PhoneNumber.Should().Be(TestMobiles.Canonical(mobile));
        created.Advisor.EmployeeCode.Should().MatchRegex("^ADV-[A-Z2-9]{6}$");
        created.Advisor.Specialization.Should().Be("General Automotive");
        created.Advisor.MaxAssignedRequests.Should().Be(25);
        created.Advisor.IsActive.Should().BeTrue();

        // Welcome email: sign-in link, mobile and the password, sent straight to the advisor.
        created.WelcomeEmailSent.Should().BeTrue();
        var mail = _email.To(email).Should().ContainSingle().Subject;
        mail.Category.Should().Be("ADVISOR_WELCOME");
        mail.TextBody.Should().Contain($"{PublicUrl}/login").And.Contain(created.LoginMobile).And.Contain(created.TemporaryPassword!)
            .And.Contain("Keep this password safe");

        // The password is stored only as a hash, and is not in the audit trail.
        using (var scope = _host.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.AsNoTracking().SingleAsync(u => u.Id == created.Advisor.UserId);
            user.PasswordHash.Should().NotContain(created.TemporaryPassword!);
            var audit = await db.AuditLogs.AsNoTracking().Where(a => a.EntityId == created.Advisor.Id.ToString()).ToListAsync();
            audit.Should().Contain(a => a.Action == "ADMIN_ADVISOR_CREATED");
            audit.Should().NotContain(a => a.Details != null && a.Details.Contains(created.TemporaryPassword!));
        }

        var auth = await LoginOkAsync(null, created.TemporaryPassword!, mobile);
        auth.User.Roles.Should().Equal(AppRoles.Advisor);
        var advisor = ClientWith(auth.AccessToken);
        (await advisor.GetAsync("/api/v1/advisor/profile")).StatusCode.Should().Be(HttpStatusCode.OK);
        (await advisor.GetAsync("/api/v1/advisor/dashboard")).StatusCode.Should().Be(HttpStatusCode.OK);

        // The new advisor is in the admin list, searchable by mobile digits.
        var list = await admin.GetFromJsonAsync<ApiResponse<PagedResult<AdminAdvisorListDto>>>(
            $"/api/v1/admin/advisors?search={mobile}", JsonOptions);
        list!.Data!.Items.Should().ContainSingle(a => a.Id == created.Advisor.Id);
    }

    [Fact]
    public async Task CreateAdvisor_WithAPasswordSetByTheAdmin_UsesThatPasswordAndDoesNotEchoIt()
    {
        var admin = await AdminAsync();
        var mobile = TestMobiles.New();
        var email = NewEmail();

        var response = await admin.PostAsJsonAsync("/api/v1/admin/advisors", new CreateAdvisorRequest(
            "Ravi Kumar", mobile, email, Specialization: "EV and hybrids", MaxAssignedRequests: 60, Password: "chosen-pw"));

        response.StatusCode.Should().Be(HttpStatusCode.Created, await response.Content.ReadAsStringAsync());
        var created = (await BodyAsync<CreatedAdvisorDto>(response)).Data!;
        created.PasswordGenerated.Should().BeFalse();
        created.TemporaryPassword.Should().BeNull();
        created.Advisor.Specialization.Should().Be("EV and hybrids");
        created.Advisor.MaxAssignedRequests.Should().Be(60);

        var auth = await LoginOkAsync(email, "chosen-pw");
        (await ClientWith(auth.AccessToken).GetAsync("/api/v1/advisor/profile")).StatusCode.Should().Be(HttpStatusCode.OK);
        (await LoginAsync(null, "chosen-pw", mobile)).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Theory]
    [InlineData("", "9876543210", "a@b.in", null, null)]                // no name
    [InlineData("Valid Name", "12345", "a@b.in", null, null)]           // not an Indian mobile
    [InlineData("Valid Name", "9876543210", "not-an-email", null, null)]
    [InlineData("Valid Name", "9876543210", "a@b.in", "short", null)]   // password under 6
    [InlineData("Valid Name", "9876543210", "a@b.in", null, 0)]
    [InlineData("Valid Name", "9876543210", "a@b.in", null, 201)]
    public async Task CreateAdvisor_WithInvalidDetails_IsRejected(string name, string mobile, string email, string? password, int? max)
    {
        var admin = await AdminAsync();

        var response = await admin.PostAsJsonAsync("/api/v1/admin/advisors",
            new CreateAdvisorRequest(name, mobile, email, MaxAssignedRequests: max, Password: password));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest, await response.Content.ReadAsStringAsync());
        (await BodyAsync<object>(response)).Errors![0].Should().Be(AdvisorAccountErrors.Validation);
    }

    [Fact]
    public async Task CreateAdvisor_WithAMobileOrEmailOfAnotherAdvisorOrGarage_IsRejected()
    {
        var admin = await AdminAsync();
        var mobile = TestMobiles.New();
        var email = NewEmail();
        (await admin.PostAsJsonAsync("/api/v1/admin/advisors", new CreateAdvisorRequest("First Advisor", mobile, email)))
            .StatusCode.Should().Be(HttpStatusCode.Created);

        var sameMobile = await admin.PostAsJsonAsync("/api/v1/admin/advisors", new CreateAdvisorRequest("Second", mobile, NewEmail()));
        var sameEmail = await admin.PostAsJsonAsync("/api/v1/admin/advisors", new CreateAdvisorRequest("Second", TestMobiles.New(), email));

        foreach (var response in new[] { sameMobile, sameEmail })
        {
            response.StatusCode.Should().Be(HttpStatusCode.Conflict);
            (await BodyAsync<object>(response)).Errors![0].Should().Be(AdvisorAccountErrors.AlreadyAdvisor);
        }

        var garageMobile = TestMobiles.New();
        var garageEmail = NewEmail("garage");
        await RegisterAsync(garageEmail, garageMobile, AppRoles.GarageOwner);

        var garageByMobile = await admin.PostAsJsonAsync("/api/v1/admin/advisors", new CreateAdvisorRequest("Third", garageMobile, NewEmail()));
        garageByMobile.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await BodyAsync<object>(garageByMobile)).Errors![0].Should().Be(AdvisorAccountErrors.MobileTaken);

        var garageByEmail = await admin.PostAsJsonAsync("/api/v1/admin/advisors", new CreateAdvisorRequest("Third", TestMobiles.New(), garageEmail));
        garageByEmail.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await BodyAsync<object>(garageByEmail)).Errors![0].Should().Be(AdvisorAccountErrors.EmailTaken);
    }

    // ------------------------------------------------------------------ existing customer → promote

    [Fact]
    public async Task CreateAdvisor_ForAnExistingCustomer_OffersPromotion_AndPromotingLetsThemSignInAsAdvisor()
    {
        var admin = await AdminAsync();
        var mobile = TestMobiles.NewNational();
        var email = NewEmail("customer");
        var customer = await RegisterAsync(email, TestMobiles.Canonical(mobile));

        var response = await admin.PostAsJsonAsync("/api/v1/admin/advisors",
            new CreateAdvisorRequest("Existing Person", mobile, NewEmail()));

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var conflict = await BodyAsync<ExistingCustomerAccountDto>(response);
        conflict.Errors![0].Should().Be(AdvisorAccountErrors.ExistingCustomer);
        conflict.Data!.UserId.Should().Be(customer.User.Id);
        conflict.Data.Email.Should().Be(email);
        conflict.Data.MatchedBy.Should().Be("mobile");

        var promote = await admin.PostAsJsonAsync("/api/v1/admin/advisors/promote",
            new PromoteToAdvisorRequest(Email: conflict.Data.Email, Specialization: "Body work", MaxAssignedRequests: 40));
        promote.StatusCode.Should().Be(HttpStatusCode.OK, await promote.Content.ReadAsStringAsync());
        var promoted = (await BodyAsync<PromotedAdvisorDto>(promote)).Data!;
        promoted.AlreadyAdvisor.Should().BeFalse();
        promoted.Advisor.UserId.Should().Be(customer.User.Id);
        promoted.Advisor.Specialization.Should().Be("Body work");
        promoted.Advisor.MaxAssignedRequests.Should().Be(40);

        // The old customer session cannot be refreshed; a new sign-in carries the advisor role only.
        (await _host.CreateClient().PostAsJsonAsync("/api/v1/auth/refresh-token", new RefreshTokenRequest(customer.RefreshToken)))
            .StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        var auth = await LoginOkAsync(null, Password, mobile);
        auth.User.Roles.Should().Equal(AppRoles.Advisor);
        (await ClientWith(auth.AccessToken).GetAsync("/api/v1/advisor/dashboard")).StatusCode.Should().Be(HttpStatusCode.OK);

        // Repeating it (here by mobile) changes nothing.
        var again = await admin.PostAsJsonAsync("/api/v1/admin/advisors/promote", new PromoteToAdvisorRequest(MobileNumber: mobile));
        again.StatusCode.Should().Be(HttpStatusCode.OK);
        var second = (await BodyAsync<PromotedAdvisorDto>(again)).Data!;
        second.AlreadyAdvisor.Should().BeTrue();
        second.Advisor.Id.Should().Be(promoted.Advisor.Id);

        using var scope = _host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        (await db.AdvisorProfiles.CountAsync(a => a.UserId == customer.User.Id)).Should().Be(1);
        (await db.AuditLogs.CountAsync(a => a.Action == "ADMIN_ADVISOR_PROMOTED" && a.EntityId == promoted.Advisor.Id.ToString()))
            .Should().Be(1);
    }

    [Fact]
    public async Task CreateAdvisor_WithACustomersEmail_IsAlsoOfferedAsPromotion()
    {
        var admin = await AdminAsync();
        var email = NewEmail("customer");
        await RegisterAsync(email, TestMobiles.New());

        var response = await admin.PostAsJsonAsync("/api/v1/admin/advisors",
            new CreateAdvisorRequest("Existing Person", TestMobiles.New(), email));

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var conflict = await BodyAsync<ExistingCustomerAccountDto>(response);
        conflict.Errors![0].Should().Be(AdvisorAccountErrors.ExistingCustomer);
        conflict.Data!.MatchedBy.Should().Be("email");
    }

    [Fact]
    public async Task Promote_RefusesGarageAndAdminAccounts_AndUnknownAccounts()
    {
        var admin = await AdminAsync();
        var garageEmail = NewEmail("garage");
        await RegisterAsync(garageEmail, TestMobiles.New(), AppRoles.GarageOwner);

        var garage = await admin.PostAsJsonAsync("/api/v1/admin/advisors/promote", new PromoteToAdvisorRequest(Email: garageEmail));
        var superAdmin = await admin.PostAsJsonAsync("/api/v1/admin/advisors/promote", new PromoteToAdvisorRequest(Email: "admin@brocomod.com"));
        foreach (var response in new[] { garage, superAdmin })
        {
            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            (await BodyAsync<object>(response)).Errors![0].Should().Be(AdvisorAccountErrors.NotEligible);
        }

        var unknown = await admin.PostAsJsonAsync("/api/v1/admin/advisors/promote", new PromoteToAdvisorRequest(MobileNumber: TestMobiles.New()));
        unknown.StatusCode.Should().Be(HttpStatusCode.NotFound);

        // Still signs in as admin only.
        (await LoginOkAsync("admin@brocomod.com", Password)).User.Roles.Should().Contain(AppRoles.SuperAdmin).And.NotContain(AppRoles.Advisor);
    }

    // ------------------------------------------------------------------ edit

    [Fact]
    public async Task UpdateAdvisor_ChangesNameSpecialityAndLimit()
    {
        var admin = await AdminAsync();
        var created = (await BodyAsync<CreatedAdvisorDto>(await admin.PostAsJsonAsync("/api/v1/admin/advisors",
            new CreateAdvisorRequest("Edit Me", TestMobiles.New(), NewEmail())))).Data!;

        var response = await admin.PutAsJsonAsync($"/api/v1/admin/advisors/{created.Advisor.Id}",
            new UpdateAdvisorRequest("Edited Name", "Diagnostics", 80));

        response.StatusCode.Should().Be(HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        var updated = (await BodyAsync<AdminAdvisorListDto>(response)).Data!;
        updated.FullName.Should().Be("Edited Name");
        updated.Specialization.Should().Be("Diagnostics");
        updated.MaxAssignedRequests.Should().Be(80);

        (await admin.PutAsJsonAsync($"/api/v1/admin/advisors/{created.Advisor.Id}", new UpdateAdvisorRequest(MaxAssignedRequests: 500)))
            .StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await admin.PutAsJsonAsync($"/api/v1/admin/advisors/{Guid.NewGuid()}", new UpdateAdvisorRequest("Nobody")))
            .StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ------------------------------------------------------------------ access

    [Fact]
    public async Task AdvisorAccountEndpoints_AreForAdminsOnly()
    {
        var customer = await RegisterAsync(NewEmail("customer"), TestMobiles.New());
        var advisor = await LoginOkAsync("advisor@brocomod.com", Password);

        foreach (var token in new[] { customer.AccessToken, advisor.AccessToken })
        {
            var client = ClientWith(token);
            (await client.PostAsJsonAsync("/api/v1/admin/advisors", new CreateAdvisorRequest("Nope", TestMobiles.New(), NewEmail())))
                .StatusCode.Should().Be(HttpStatusCode.Forbidden);
            (await client.PostAsJsonAsync("/api/v1/admin/advisors/promote", new PromoteToAdvisorRequest(Email: NewEmail())))
                .StatusCode.Should().Be(HttpStatusCode.Forbidden);
            (await client.PutAsJsonAsync($"/api/v1/admin/advisors/{Guid.NewGuid()}", new UpdateAdvisorRequest("Nope")))
                .StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }

        (await _host.CreateClient().PostAsJsonAsync("/api/v1/admin/advisors", new CreateAdvisorRequest("Nope", TestMobiles.New(), NewEmail())))
            .StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ------------------------------------------------------------------ fakes

    private sealed class CapturingEmailSender : IEmailSender
    {
        private readonly ConcurrentQueue<EmailMessage> _sent = new();

        public bool IsConfigured => true;

        public IReadOnlyList<EmailMessage> To(string address) =>
            _sent.Where(m => m.ToAddress.Equals(address, StringComparison.OrdinalIgnoreCase)).ToList();

        public Task<MessageSendResult> SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
        {
            _sent.Enqueue(message);
            return Task.FromResult(MessageSendResult.Sent("Fake email", "Accepted by the fake.", "fake-email-id"));
        }
    }
}
