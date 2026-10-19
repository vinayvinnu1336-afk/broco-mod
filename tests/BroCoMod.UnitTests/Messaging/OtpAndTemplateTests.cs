using BroCoMod.Application.Common;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Enums;
using BroCoMod.Infrastructure.Services;
using BroCoMod.Infrastructure.Services.Messaging;
using FluentAssertions;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

namespace BroCoMod.UnitTests.Messaging;

/// <summary>DLT template texts, email templates, the OTP store, request limits and the WhatsApp → SMS fallback.</summary>
public class OtpAndTemplateTests
{
    private static RedisCacheService MemoryCacheService() => new(new MemoryCache(new MemoryCacheOptions()));

    private sealed class Env : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Production";
        public string ApplicationName { get; set; } = "Tests";
        public string ContentRootPath { get; set; } = ".";
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }

    // ------------------------------------------------------------------ DLT templates

    [Fact]
    public void EverySmsTemplate_RendersToTextThatMatchesItsRegisteredForm()
    {
        foreach (var template in SmsTemplates.All)
        {
            var values = template.Variables.Select((_, i) => $"value{i}").ToArray();
            var text = SmsTemplates.Render(template, values);
            text.Should().NotContain(SmsTemplates.Variable);
            SmsTemplates.Matches(template, text).Should().BeTrue(template.Kind.ToString());
            text.Length.Should().BeLessThan(320, "two SMS parts at most");
        }
    }

    [Fact]
    public void SmsValues_AreOneLineAndCutTo30Characters_SoTheDltMatchHolds()
    {
        var text = SmsTemplates.Render(SmsTemplates.BookingConfirmed, new[] { "SR-1", "Maruti Suzuki Swift Dzire Tour S\nCNG Edition" });
        text.Should().Be("Your BroCo booking SR-1 for your Maruti Suzuki Swift Dzire Tour is confirmed. We will keep you updated. - BroCo");
        SmsTemplates.Matches(SmsTemplates.BookingConfirmed, text).Should().BeTrue();
        SmsTemplates.Matches(SmsTemplates.BookingConfirmed, text.Replace("We will", "We'll")).Should().BeFalse();
    }

    [Fact]
    public void Render_WithTheWrongNumberOfValues_Throws()
    {
        var act = () => SmsTemplates.Render(SmsTemplates.CommissionReminder, new[] { "1" });
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void TheOwnersSetupGuide_ListsEveryTemplateTextExactly()
    {
        var doc = File.ReadAllText(Path.Combine(RepoRoot(), "docs", "integrations-setup.md"));
        foreach (var template in SmsTemplates.All)
        {
            doc.Should().Contain(template.Text, $"the {template.Kind} text must be registered on DLT exactly as the code sends it");
            doc.Should().Contain(template.EnvVariable);
        }
    }

    [Fact]
    public void NotificationTypes_MapToTheRightSmsTemplate_AndSkipWhenAValueIsMissing()
    {
        NotificationMessage Msg(string type, Dictionary<string, string>? data) => new(Guid.NewGuid(), "t", "m", type, NotificationChannel.Sms, Data: data);

        SmsNotificationProvider.TemplateFor(Msg("PASSWORD_RESET", new() { ["code"] = "123456" }))!.Value.Kind.Should().Be(SmsTemplateKind.Otp);
        SmsNotificationProvider.TemplateFor(Msg("COMMISSION_DUE", new() { ["amount"] = "1,250.00", ["jobNumber"] = "JOB-1", ["state"] = "overdue" }))!.Value
            .Values.Should().Equal("1,250.00", "JOB-1", "overdue");
        SmsNotificationProvider.TemplateFor(Msg("BookingConfirmed", new() { ["requestNumber"] = "SR-1" }))!.Value.Values.Should().Equal("SR-1", "car");
        SmsNotificationProvider.TemplateFor(Msg("CustomerQuotation", null)).Should().BeNull();
        SmsNotificationProvider.TemplateFor(Msg("GARAGE_REQUEST_DISPATCHED", new() { ["x"] = "y" })).Should().BeNull();
    }

    // ------------------------------------------------------------------ Email templates

    [Fact]
    public void PasswordResetEmail_HasTheCode_InHtmlAndText_AndEncodesValues()
    {
        var message = new NotificationMessage(Guid.NewGuid(), "t", "m", EmailTemplates.PasswordResetType, NotificationChannel.Email,
            Data: new Dictionary<string, string> { ["code"] = "482913" });

        var email = EmailTemplates.ForNotification(message, "<b>Ravi</b> Kumar", "https://brocomob.com");

        email.Subject.Should().Be("Your BroCo password reset code");
        email.Html.Should().Contain("482913").And.Contain("BroCo").And.Contain("Hi &lt;b&gt;Ravi&lt;/b&gt;,").And.NotContain("<b>Ravi");
        email.Html.Should().Contain("max-width:560px").And.Contain("name=\"viewport\"");
        email.Text.Should().Contain("Your code: 482913").And.NotContain("<p").And.NotContain("&lt;");
    }

    [Theory]
    [InlineData("BookingConfirmed", "Booking confirmed: SR-9")]
    [InlineData("CustomerQuotation", "Your quotation is ready: SR-9")]
    [InlineData("PAYMENT_RECEIVED", "Payment received: PAY-1")]
    [InlineData("COMMISSION_DUE", "Reminder: BroCo commission due")]
    [InlineData("SOMETHING_ELSE", "Reminder: BroCo commission due")]
    public void EachNotificationType_HasAnEmail(string type, string subject)
    {
        var message = new NotificationMessage(Guid.NewGuid(), "Reminder: BroCo commission due", "Body text", type, NotificationChannel.Email,
            Data: new Dictionary<string, string> { ["requestNumber"] = "SR-9", ["paymentNumber"] = "PAY-1", ["amount"] = "1,250" });

        var email = EmailTemplates.ForNotification(message, "Ravi Kumar", null);

        email.Subject.Should().Be(subject);
        email.Html.Should().Contain("Hi Ravi,").And.Contain("Body text");
        email.Text.Should().Contain("Body text");
        email.Html.Should().NotContain("href=", "no site address is set, so there are no links");
    }

    // ------------------------------------------------------------------ OTP store

    [Fact]
    public async Task Otp_IsSixDigits_SingleUse_AndBoundToItsDestinationAndPurpose()
    {
        var otp = new OtpProvider(MemoryCacheService(), new Env(), new CapturingLogger<OtpProvider>());

        var code = await otp.GenerateOtpAsync("mobile:9876543210", "PasswordReset");

        code.Should().MatchRegex("^[0-9]{6}$");
        (await otp.VerifyOtpAsync("mobile:9876543211", code, "PasswordReset")).Should().BeFalse();
        (await otp.VerifyOtpAsync("mobile:9876543210", code, "Other")).Should().BeFalse();
        (await otp.VerifyOtpAsync("mobile:9876543210", code, "PasswordReset")).Should().BeTrue();
        (await otp.VerifyOtpAsync("mobile:9876543210", code, "PasswordReset")).Should().BeFalse("a code works once");
    }

    [Fact]
    public async Task Otp_StopsAfterFiveWrongGuesses()
    {
        var otp = new OtpProvider(MemoryCacheService(), new Env(), new CapturingLogger<OtpProvider>());
        var code = await otp.GenerateOtpAsync("mobile:9876543210", "PasswordReset");
        var wrong = code == "000000" ? "111111" : "000000";

        for (var i = 0; i < 5; i++) (await otp.VerifyOtpAsync("mobile:9876543210", wrong, "PasswordReset")).Should().BeFalse();

        (await otp.VerifyOtpAsync("mobile:9876543210", code, "PasswordReset")).Should().BeFalse();
    }

    [Fact]
    public async Task Otp_ExpiresAfterTenMinutes()
    {
        var cache = MemoryCacheService();
        var otp = new OtpProvider(cache, new Env(), new CapturingLogger<OtpProvider>());
        var code = await otp.GenerateOtpAsync("mobile:9876543210", "PasswordReset");

        const string key = "otp:passwordreset:mobile:9876543210";
        var entry = await cache.GetAsync<OtpProvider.OtpEntry>(key);
        entry.Should().NotBeNull();
        entry!.ExpiresAtUtc.Should().BeCloseTo(DateTime.UtcNow.AddMinutes(10), TimeSpan.FromSeconds(5));
        entry.CodeHash.Should().NotContain(code, "only a hash is stored");
        await cache.SetAsync(key, entry with { ExpiresAtUtc = DateTime.UtcNow.AddSeconds(-1) }, TimeSpan.FromMinutes(1));

        (await otp.VerifyOtpAsync("mobile:9876543210", code, "PasswordReset")).Should().BeFalse();
    }

    [Fact]
    public async Task Otp_IsNotLoggedOutsideDevelopment()
    {
        var logger = new CapturingLogger<OtpProvider>();
        var code = await new OtpProvider(MemoryCacheService(), new Env(), logger).GenerateOtpAsync("mobile:9876543210", "PasswordReset");
        logger.All.Should().NotContain(code);
    }

    // ------------------------------------------------------------------ request limits

    [Fact]
    public async Task Limiter_AllowsThreeCodesPerNumberPerWindow_ThenRefusesWithAWait()
    {
        var limiter = new OtpRequestLimiter(MemoryCacheService(), TestConfig.Of());

        for (var i = 0; i < 3; i++) await limiter.AcquireAsync("PasswordReset", "mobile:9876543210", null);
        var fourth = () => limiter.AcquireAsync("PasswordReset", "mobile:9876543210", null);

        (await fourth.Should().ThrowAsync<TooManyRequestsException>()).Which.RetryAfter.Should().BeGreaterThan(TimeSpan.FromMinutes(14));
        await limiter.AcquireAsync("PasswordReset", "mobile:9876543211", null); // another number is unaffected
    }

    [Fact]
    public async Task Limiter_CapsRequestsPerIp_AcrossNumbers()
    {
        var limiter = new OtpRequestLimiter(MemoryCacheService(), TestConfig.Of(("Otp:MaxRequestsPerIp", "3")));

        for (var i = 0; i < 3; i++) await limiter.AcquireAsync("PasswordReset", $"mobile:98765432{i:D2}", "203.0.113.7");

        var next = () => limiter.AcquireAsync("PasswordReset", "mobile:9876543299", "203.0.113.7");
        await next.Should().ThrowAsync<TooManyRequestsException>();
        await limiter.AcquireAsync("PasswordReset", "mobile:9876543299", "198.51.100.1");
    }

    [Fact]
    public async Task Limiter_ARefusedRequest_DoesNotUseUpTheOtherAllowance()
    {
        var cache = MemoryCacheService();
        var limiter = new OtpRequestLimiter(cache, TestConfig.Of(("Otp:MaxRequestsPerNumber", "1")));
        await limiter.AcquireAsync("PasswordReset", "mobile:9876543210", "203.0.113.9");
        var again = () => limiter.AcquireAsync("PasswordReset", "mobile:9876543210", "203.0.113.9");
        await again.Should().ThrowAsync<TooManyRequestsException>();

        var ipCounter = await cache.GetAsync<OtpRequestLimiter.Counter>("otp-limit:passwordreset:ip:203.0.113.9");
        ipCounter!.Count.Should().Be(1);
    }

    // ------------------------------------------------------------------ WhatsApp → SMS fallback

    [Fact]
    public async Task Delivery_TriesWhatsAppFirst_AndFallsBackToSmsWhenItFails()
    {
        var wa = new StubWhatsAppSender(true, () => MessageSendResult.Failed("Gupshup WhatsApp", "Template not found"));
        var sms = new StubSmsSender(true, () => MessageSendResult.Sent("Gupshup SMS", "ok", "id-1"));
        var delivery = new OtpDeliveryService(wa, sms, new CapturingLogger<OtpDeliveryService>());

        var result = await delivery.SendOtpAsync("9876543210", "112233");

        result.Delivered.Should().BeTrue();
        result.Channel.Should().Be(NotificationChannel.Sms);
        result.Attempts.Should().HaveCount(2);
        wa.Sent.Should().ContainSingle().Which.Code.Should().Be("112233");
        sms.Sent.Should().ContainSingle().Which.Kind.Should().Be(SmsTemplateKind.Otp);
        sms.Sent[0].Values.Should().Equal("112233");
    }

    [Fact]
    public async Task Delivery_UsesOnlyWhatsApp_WhenItWorks()
    {
        var wa = new StubWhatsAppSender(true, () => MessageSendResult.Sent("Gupshup WhatsApp", "ok", "m"));
        var sms = new StubSmsSender(true, () => MessageSendResult.Sent("Gupshup SMS", "ok", "id"));
        var result = await new OtpDeliveryService(wa, sms, new CapturingLogger<OtpDeliveryService>()).SendOtpAsync("9876543210", "1");
        result.Channel.Should().Be(NotificationChannel.WhatsApp);
        sms.Sent.Should().BeEmpty();
    }

    [Fact]
    public async Task Delivery_SkipsChannelsThatAreNotSetUp_AndNeverLogsTheCode()
    {
        var wa = new StubWhatsAppSender(false, () => throw new InvalidOperationException("must not be called"));
        var sms = new StubSmsSender(false, () => throw new InvalidOperationException("must not be called"));
        var logger = new CapturingLogger<OtpDeliveryService>();
        var delivery = new OtpDeliveryService(wa, sms, logger);

        delivery.IsAvailable.Should().BeFalse();
        var result = await delivery.SendOtpAsync("9876543210", "778899");

        result.Delivered.Should().BeFalse();
        result.Attempts.Should().BeEmpty();
        logger.All.Should().NotContain("778899").And.NotContain("9876543210");
    }

    [Fact]
    public async Task Delivery_AProviderThatThrows_StillFallsBack()
    {
        var wa = new StubWhatsAppSender(true, () => throw new HttpRequestException("boom"));
        var sms = new StubSmsSender(true, () => MessageSendResult.Sent("Gupshup SMS", "ok", "id"));
        var result = await new OtpDeliveryService(wa, sms, new CapturingLogger<OtpDeliveryService>()).SendOtpAsync("9876543210", "1");
        result.Channel.Should().Be(NotificationChannel.Sms);
    }

    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null && !File.Exists(Path.Combine(dir.FullName, "BroCoMod.sln"))) dir = dir.Parent;
        return dir?.FullName ?? throw new DirectoryNotFoundException("Repository root (BroCoMod.sln) not found.");
    }
}
