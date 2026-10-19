using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using BroCoMod.Api.Controllers.v1;
using BroCoMod.Application.Common;
using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Constants;
using BroCoMod.Domain.Entities.Identity;
using BroCoMod.Infrastructure.Persistence;
using BroCoMod.Infrastructure.Services;
using BroCoMod.Infrastructure.Services.Messaging;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BroCoMod.IntegrationTests;

/// <summary>
/// Forgot password by mobile end to end, and the admin integrations page. No real provider is ever called:
/// WhatsApp is a fake that always fails (so the SMS fallback is exercised), SMS is a fake that keeps the
/// messages it was given, and ZeptoMail gets a fake HTTP handler. Every test uses its own random mobile numbers.
/// </summary>
public class MessagingIntegrationTests : IClassFixture<WebApplicationFactory<Program>>, IDisposable
{
    private const string Password = "Password123!";
    private const string DummyZeptoToken = "zepto-dummy-token-0123456789";
    private const string DummySmsPassword = "gupshup-dummy-password-xyz";
    private const string DummyRazorpaySecret = "razorpay-dummy-secret-abc";

    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    private readonly WebApplicationFactory<Program> _host;
    private readonly CapturingSmsSender _sms = new();
    private readonly AlwaysFailingWhatsApp _whatsApp = new();
    private readonly FakeZeptoHandler _zepto = new();

    public MessagingIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _host = factory.WithWebHostBuilder(b =>
        {
            // Dummy values only: they let the status page report "set" and must never appear in a response.
            b.UseSetting("Email:ZeptoMailApiToken", DummyZeptoToken);
            b.UseSetting("Sms:GupshupPassword", DummySmsPassword);
            b.UseSetting("Razorpay:KeySecret", DummyRazorpaySecret);
            b.ConfigureTestServices(services =>
            {
                services.AddSingleton<ISmsSender>(_sms);
                services.AddSingleton<IWhatsAppSender>(_whatsApp);
                services.AddHttpClient<IEmailSender, ZeptoMailEmailSender>().ConfigurePrimaryHttpMessageHandler(() => _zepto);
            });
        });
    }

    public void Dispose() => _host.Dispose();

    // ------------------------------------------------------------------ helpers

    private async Task<(string Mobile, Guid UserId)> RegisterAsync()
    {
        var national = TestMobiles.NewNational();
        var response = await _host.CreateClient().PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest(
            $"reset_{Guid.NewGuid():N}@brocomod.com", Password, "Reset Tester", TestMobiles.Canonical(national)));
        response.StatusCode.Should().Be(HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        var auth = (await response.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(JsonOptions))!.Data!;
        return (national, auth.User.Id);
    }

    private Task<HttpResponseMessage> ForgotAsync(string mobile) =>
        _host.CreateClient().PostAsJsonAsync("/api/v1/auth/forgot-password", new { mobileNumber = mobile });

    private Task<HttpResponseMessage> ResetAsync(string mobile, string code, string newPassword = "NewPassword456!") =>
        _host.CreateClient().PostAsJsonAsync("/api/v1/auth/reset-password", new { mobileNumber = mobile, code, newPassword });

    private Task<HttpResponseMessage> LoginAsync(string mobile, string password) =>
        _host.CreateClient().PostAsJsonAsync("/api/v1/auth/login", new { mobileNumber = mobile, password });

    private static async Task<string> MessageOf(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<ApiResponse<JsonElement?>>(JsonOptions))!.Message;

    private async Task<HttpClient> ClientForAsync(string email)
    {
        var login = await _host.CreateClient().PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, Password));
        login.StatusCode.Should().Be(HttpStatusCode.OK);
        var token = (await login.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(JsonOptions))!.Data!.AccessToken;
        var client = _host.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private async Task InsertUserWithMobileAsync(string phone)
    {
        using var scope = _host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var hash = scope.ServiceProvider.GetRequiredService<IPasswordHasher>().HashPassword(Password, out var salt);
        var user = new User($"shared_{Guid.NewGuid():N}@brocomod.com", "Shared Number", phone, hash, salt);
        db.Users.Add(user);
        var role = await db.Roles.FirstAsync(r => r.Name == AppRoles.Customer);
        db.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = role.Id });
        await db.SaveChangesAsync();
    }

    // ------------------------------------------------------------------ forgot password by mobile

    [Fact]
    public async Task ForgotByMobile_SendsTheCodeBySmsAfterWhatsAppFails_AndTheCodeResetsThePassword()
    {
        var (mobile, _) = await RegisterAsync();

        var forgot = await ForgotAsync(TestMobiles.Canonical(mobile));

        forgot.StatusCode.Should().Be(HttpStatusCode.OK);
        var raw = await forgot.Content.ReadAsStringAsync();
        raw.Should().NotMatchRegex("\\b\\d{6}\\b", "the code is only ever sent to the phone");
        (await MessageOf(forgot)).Should().Be(AuthController.MobileResetSentMessage);

        _whatsApp.Attempts.Should().Contain(mobile, "WhatsApp is tried first");
        var sms = _sms.For(mobile).Should().ContainSingle().Subject;
        sms.Kind.Should().Be(SmsTemplateKind.Otp);
        var text = SmsTemplates.Render(SmsTemplates.Otp, sms.Values);
        SmsTemplates.Matches(SmsTemplates.Otp, text).Should().BeTrue("the SMS must match the registered DLT text");
        var code = sms.Values[0]!;
        code.Should().MatchRegex("^[0-9]{6}$");

        (await ResetAsync(mobile, code)).StatusCode.Should().Be(HttpStatusCode.OK);
        (await LoginAsync(mobile, "NewPassword456!")).StatusCode.Should().Be(HttpStatusCode.OK);
        (await LoginAsync(mobile, Password)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await ResetAsync(mobile, code, "Another789!x")).StatusCode.Should().Be(HttpStatusCode.BadRequest, "a code works once");
    }

    [Fact]
    public async Task ForgotByMobile_UnknownOrSharedNumbers_GetTheSameAnswer_AndNothingIsSent()
    {
        var unknown = TestMobiles.NewNational();
        var shared = TestMobiles.NewNational();
        await InsertUserWithMobileAsync(TestMobiles.Canonical(shared));
        await InsertUserWithMobileAsync(shared);

        foreach (var number in new[] { unknown, shared })
        {
            var response = await ForgotAsync(number);
            response.StatusCode.Should().Be(HttpStatusCode.OK);
            var body = (await response.Content.ReadFromJsonAsync<ApiResponse<JsonElement?>>(JsonOptions))!;
            body.Message.Should().Be(AuthController.MobileResetSentMessage);
            body.Data.Should().BeNull();
            _sms.For(number).Should().BeEmpty();
            _whatsApp.Attempts.Should().NotContain(number);
        }

        AuthController.MobileResetSentMessage.Should().Contain("email", "people with a shared number are pointed to email reset");
    }

    [Fact]
    public async Task ResetByMobile_WrongCodes_LockTheCodeAfterFiveTries()
    {
        var (mobile, _) = await RegisterAsync();
        (await ForgotAsync(mobile)).StatusCode.Should().Be(HttpStatusCode.OK);
        var code = _sms.For(mobile).Single().Values[0]!;
        var wrong = code == "000000" ? "111111" : "000000";

        for (var i = 0; i < 5; i++)
        {
            var attempt = await ResetAsync(mobile, wrong);
            attempt.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            (await MessageOf(attempt)).Should().Contain("wrong or has expired");
        }

        (await ResetAsync(mobile, code)).StatusCode.Should().Be(HttpStatusCode.BadRequest, "five wrong tries use the code up");
        (await LoginAsync(mobile, Password)).StatusCode.Should().Be(HttpStatusCode.OK, "the password is unchanged");
    }

    [Fact]
    public async Task ResetByMobile_ExpiredCode_IsRefused()
    {
        var (mobile, _) = await RegisterAsync();
        (await ForgotAsync(mobile)).StatusCode.Should().Be(HttpStatusCode.OK);
        var code = _sms.For(mobile).Single().Values[0]!;

        var cache = _host.Services.GetRequiredService<ICacheService>();
        var key = $"otp:passwordreset:{IdentityService.MobileOtpDestination(mobile)}";
        var entry = await cache.GetAsync<OtpProvider.OtpEntry>(key);
        entry.Should().NotBeNull();
        await cache.SetAsync(key, entry! with { ExpiresAtUtc = DateTime.UtcNow.AddMinutes(-1) }, TimeSpan.FromMinutes(5));

        (await ResetAsync(mobile, code)).StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task ForgotByMobile_IsLimitedToThreeCodesPerNumber_With429AndRetryAfter()
    {
        var (mobile, _) = await RegisterAsync();
        for (var i = 0; i < 3; i++) (await ForgotAsync(mobile)).StatusCode.Should().Be(HttpStatusCode.OK);

        var fourth = await ForgotAsync(mobile);

        fourth.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
        fourth.Headers.Contains("Retry-After").Should().BeTrue();
        (await MessageOf(fourth)).Should().Contain("Too many codes");
        _sms.For(mobile).Should().HaveCount(3);

        // A resend replaces the earlier code: only the newest one works.
        var codes = _sms.For(mobile).Select(s => s.Values[0]!).ToList();
        if (codes[0] != codes[^1]) (await ResetAsync(mobile, codes[0])).StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await ResetAsync(mobile, codes[^1])).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task ForgotPassword_RejectsAnInvalidNumber_OrAnEmptyRequest()
    {
        (await ForgotAsync("12345")).StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await _host.CreateClient().PostAsJsonAsync("/api/v1/auth/forgot-password", new { })).StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task ResetByMobile_TooShortPassword_IsRefusedWithoutUsingUpTheCode()
    {
        var (mobile, _) = await RegisterAsync();
        (await ForgotAsync(mobile)).StatusCode.Should().Be(HttpStatusCode.OK);
        var code = _sms.For(mobile).Single().Values[0]!;

        (await ResetAsync(mobile, code, "abc")).StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await ResetAsync(mobile, code)).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task ForgotByEmail_StillWorks_AndEmailsTheCodeThroughZeptoMail()
    {
        var (_, userId) = await RegisterAsync();
        string email;
        using (var scope = _host.Services.CreateScope())
        {
            email = await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Users.Where(u => u.Id == userId).Select(u => u.Email).SingleAsync();
        }

        var response = await _host.CreateClient().PostAsJsonAsync("/api/v1/auth/forgot-password", new ForgotPasswordRequest(email));

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await MessageOf(response)).Should().Be(AuthController.EmailResetSentMessage);
        var sent = _zepto.To(email).Should().ContainSingle().Subject;
        var code = Regex.Match(sent, "Your code: (\\d{6})").Groups[1].Value;
        code.Should().NotBeEmpty();
        (await _host.CreateClient().PostAsJsonAsync("/api/v1/auth/reset-password", new ResetPasswordRequest(email, code, "NewPassword456!")))
            .StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // ------------------------------------------------------------------ admin integrations

    [Fact]
    public async Task IntegrationsStatus_ListsEveryIntegration_WithoutAnySecret()
    {
        var admin = await ClientForAsync("admin@brocomod.com");

        var response = await admin.GetAsync("/api/v1/admin/integrations");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var raw = await response.Content.ReadAsStringAsync();
        raw.Should().NotContain(DummyZeptoToken).And.NotContain(DummySmsPassword).And.NotContain(DummyRazorpaySecret);
        var status = (await response.Content.ReadFromJsonAsync<ApiResponse<IntegrationsStatusDto>>(JsonOptions))!.Data!;
        status.Integrations.Select(i => i.Key).Should().Equal("googleMaps", "razorpay", "email", "sms", "whatsapp");
        var email = status.Integrations.Single(i => i.Key == "email");
        email.Status.Should().Be(IntegrationStatus.Configured);
        email.Checks.Should().Contain(c => c.Label.Contains("ZEPTOMAIL_API_TOKEN") && c.Ok);
    }

    [Fact]
    public async Task IntegrationsEndpoints_AreForSuperAdminsOnly()
    {
        var customer = await ClientForAsync("customer@brocomod.com");
        (await customer.GetAsync("/api/v1/admin/integrations")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await customer.PostAsync("/api/v1/admin/integrations/test-email", null)).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await customer.PostAsJsonAsync("/api/v1/admin/integrations/test-mobile", new { mobileNumber = TestMobiles.New(), channel = "Sms" }))
            .StatusCode.Should().Be(HttpStatusCode.Forbidden);

        var advisor = await ClientForAsync("advisor@brocomod.com");
        (await advisor.GetAsync("/api/v1/admin/integrations")).StatusCode.Should().Be(HttpStatusCode.Forbidden);

        (await _host.CreateClient().GetAsync("/api/v1/admin/integrations")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task TestEmail_GoesToTheAdminsOwnAddress_AndReportsZeptoMailsAnswer()
    {
        var admin = await ClientForAsync("admin@brocomod.com");
        var before = _zepto.To("admin@brocomod.com").Count;

        var response = await admin.PostAsync("/api/v1/admin/integrations/test-email", null);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = (await response.Content.ReadFromJsonAsync<ApiResponse<TestMessageResultDto>>(JsonOptions))!.Data!;
        result.Success.Should().BeTrue();
        result.Provider.Should().Be("ZeptoMail");
        result.ProviderMessageId.Should().Be("fake-request-id");
        result.Recipient.Should().Be("admin@brocomod.com");
        _zepto.To("admin@brocomod.com").Count.Should().Be(before + 1);
        _zepto.LastAuthorization.Should().Be($"Zoho-enczapikey {DummyZeptoToken}");
        (await response.Content.ReadAsStringAsync()).Should().NotContain(DummyZeptoToken);
    }

    [Fact]
    public async Task TestSms_SendsTheCodeTemplateToTheTypedNumber_AndRejectsBadInput()
    {
        var admin = await ClientForAsync("admin@brocomod.com");
        var mobile = TestMobiles.NewNational();

        var sms = await admin.PostAsJsonAsync("/api/v1/admin/integrations/test-mobile", new { mobileNumber = mobile, channel = "Sms" });
        sms.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = (await sms.Content.ReadFromJsonAsync<ApiResponse<TestMessageResultDto>>(JsonOptions))!.Data!;
        result.Success.Should().BeTrue();
        result.Channel.Should().Be("Sms");
        _sms.For(mobile).Should().ContainSingle().Which.Kind.Should().Be(SmsTemplateKind.Otp);

        var whatsApp = await admin.PostAsJsonAsync("/api/v1/admin/integrations/test-mobile", new { mobileNumber = mobile, channel = "WhatsApp" });
        var waResult = (await whatsApp.Content.ReadFromJsonAsync<ApiResponse<TestMessageResultDto>>(JsonOptions))!.Data!;
        waResult.Success.Should().BeFalse();
        waResult.Detail.Should().Be(AlwaysFailingWhatsApp.Reason, "the provider's answer is shown to the admin");

        (await admin.PostAsJsonAsync("/api/v1/admin/integrations/test-mobile", new { mobileNumber = "123", channel = "Sms" }))
            .StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await admin.PostAsJsonAsync("/api/v1/admin/integrations/test-mobile", new { mobileNumber = mobile, channel = "Pigeon" }))
            .StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ------------------------------------------------------------------ fakes

    private sealed class CapturingSmsSender : ISmsSender
    {
        private readonly ConcurrentDictionary<string, ConcurrentQueue<(SmsTemplateKind Kind, IReadOnlyList<string?> Values)>> _sent = new();

        public bool IsConfigured => true;

        public IReadOnlyList<(SmsTemplateKind Kind, IReadOnlyList<string?> Values)> For(string mobile) =>
            _sent.TryGetValue(IndianMobile.NationalNumber(mobile)!, out var list) ? list.ToList() : new();

        public Task<MessageSendResult> SendAsync(string mobile, SmsTemplateKind template, IReadOnlyList<string?> values, CancellationToken cancellationToken = default)
        {
            _sent.GetOrAdd(IndianMobile.NationalNumber(mobile)!, _ => new()).Enqueue((template, values.ToList()));
            return Task.FromResult(MessageSendResult.Sent("Fake SMS", "Accepted by the fake.", "fake-sms-id"));
        }
    }

    private sealed class AlwaysFailingWhatsApp : IWhatsAppSender
    {
        public const string Reason = "Gupshup answered HTTP 400: error - Template not approved";
        public ConcurrentBag<string> Attempts { get; } = new();
        public bool IsConfigured => true;

        public Task<MessageSendResult> SendOtpAsync(string mobile, string code, CancellationToken cancellationToken = default)
        {
            Attempts.Add(IndianMobile.NationalNumber(mobile)!);
            return Task.FromResult(MessageSendResult.Failed("Fake WhatsApp", Reason, 400));
        }
    }

    private sealed class FakeZeptoHandler : HttpMessageHandler
    {
        private readonly ConcurrentQueue<(string To, string Text)> _sent = new();
        public string? LastAuthorization { get; private set; }

        public IReadOnlyList<string> To(string address) =>
            _sent.Where(s => s.To.Equals(address, StringComparison.OrdinalIgnoreCase)).Select(s => s.Text).ToList();

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            request.RequestUri!.Host.Should().Be("api.zeptomail.in");
            LastAuthorization = request.Headers.GetValues("Authorization").Single();
            using var body = JsonDocument.Parse(await request.Content!.ReadAsStringAsync(cancellationToken));
            var to = body.RootElement.GetProperty("to")[0].GetProperty("email_address").GetProperty("address").GetString()!;
            _sent.Enqueue((to, body.RootElement.GetProperty("textbody").GetString()!));
            return new HttpResponseMessage(HttpStatusCode.Created)
            {
                Content = new StringContent("""{"data":[{"code":"EM_104","message":"Email request received"}],"message":"OK","request_id":"fake-request-id"}""", Encoding.UTF8, "application/json"),
            };
        }
    }
}
