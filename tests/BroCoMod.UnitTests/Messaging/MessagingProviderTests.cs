using System.Net;
using System.Text.Json;
using System.Web;
using BroCoMod.Application.Common;
using BroCoMod.Application.Interfaces;
using BroCoMod.Infrastructure.Services.Messaging;
using FluentAssertions;

namespace BroCoMod.UnitTests.Messaging;

/// <summary>ZeptoMail, Gupshup SMS and Gupshup WhatsApp request shapes and response parsing, against fake HTTP handlers.</summary>
public class MessagingProviderTests
{
    private const string ZeptoToken = "wSsVR60-secret-token-value";
    private const string SmsPassword = "Gupshup-Pa55-secret";
    private const string WaKey = "wa-api-key-secret-123";

    private static EmailMessage Email() => new("ravi@example.com", "Ravi Kumar", "Subject", "<p>Hi</p>", "Hi", "TEST");

    // ------------------------------------------------------------------ ZeptoMail

    [Fact]
    public async Task ZeptoMail_PostsTheDocumentedJson_WithTheZohoAuthHeader_ToTheIndiaHost()
    {
        var handler = new FakeHttpHandler(HttpStatusCode.Created,
            """{"data":[{"code":"EM_104","additional_info":[],"message":"Email request received"}],"message":"OK","request_id":"req-42"}""");
        var logger = new CapturingLogger<ZeptoMailEmailSender>();
        var sender = new ZeptoMailEmailSender(new HttpClient(handler), TestConfig.Of(
            ("Email:ZeptoMailApiToken", ZeptoToken), ("Email:FromAddress", "noreply@brocomob.com"), ("Email:FromName", "BroCo")), logger);

        var result = await sender.SendAsync(Email());

        result.Success.Should().BeTrue();
        result.ProviderMessageId.Should().Be("req-42");
        handler.LastRequest.Method.Should().Be(HttpMethod.Post);
        handler.LastRequest.RequestUri!.ToString().Should().Be("https://api.zeptomail.in/v1.1/email");
        handler.LastRequest.Headers.GetValues("Authorization").Single().Should().Be($"Zoho-enczapikey {ZeptoToken}");

        using var body = JsonDocument.Parse(handler.LastBody);
        var root = body.RootElement;
        root.GetProperty("from").GetProperty("address").GetString().Should().Be("noreply@brocomob.com");
        root.GetProperty("from").GetProperty("name").GetString().Should().Be("BroCo");
        var to = root.GetProperty("to")[0].GetProperty("email_address");
        to.GetProperty("address").GetString().Should().Be("ravi@example.com");
        to.GetProperty("name").GetString().Should().Be("Ravi Kumar");
        root.GetProperty("subject").GetString().Should().Be("Subject");
        root.GetProperty("htmlbody").GetString().Should().Be("<p>Hi</p>");
        root.GetProperty("textbody").GetString().Should().Be("Hi");

        logger.All.Should().NotContain(ZeptoToken).And.NotContain("ravi@example.com");
    }

    [Fact]
    public async Task ZeptoMail_TokenPastedWithItsScheme_IsNotDoubled_AndHostCanBeChanged()
    {
        var handler = new FakeHttpHandler(HttpStatusCode.OK, """{"request_id":"r"}""");
        var sender = new ZeptoMailEmailSender(new HttpClient(handler), TestConfig.Of(
            ("ZEPTOMAIL_API_TOKEN", $"Zoho-enczapikey {ZeptoToken}"), ("ZEPTOMAIL_API_HOST", "https://api.zeptomail.com/")), new CapturingLogger<ZeptoMailEmailSender>());

        (await sender.SendAsync(Email())).Success.Should().BeTrue();

        handler.LastRequest.Headers.GetValues("Authorization").Single().Should().Be($"Zoho-enczapikey {ZeptoToken}");
        handler.LastRequest.RequestUri!.Host.Should().Be("api.zeptomail.com");
    }

    [Theory]
    [InlineData("""{"error":{"code":"TM_4001","details":[{"code":"SERR_157","message":"Invalid API Token found","target":"Authorization"}],"message":"Access Denied","request_id":"x"}}""", "TM_4001 - Access Denied - Invalid API Token found")]
    [InlineData("""{"data":{"error_code":"TM_3004","message":"Invalid request"},"message":"error"}""", "TM_3004 - Invalid request")]
    [InlineData("<html>Bad gateway</html>", "<html>Bad gateway</html>")]
    public async Task ZeptoMail_Refusal_IsReportedWithTheProvidersReason(string answer, string expected)
    {
        var handler = new FakeHttpHandler(HttpStatusCode.Unauthorized, answer);
        var logger = new CapturingLogger<ZeptoMailEmailSender>();
        var sender = new ZeptoMailEmailSender(new HttpClient(handler), TestConfig.Of(("Email:ZeptoMailApiToken", ZeptoToken)), logger);

        var result = await sender.SendAsync(Email());

        result.Success.Should().BeFalse();
        result.Configured.Should().BeTrue();
        result.HttpStatus.Should().Be(401);
        result.Detail.Should().Contain(expected);
        logger.All.Should().NotContain(ZeptoToken);
    }

    [Fact]
    public async Task ZeptoMail_WithoutAToken_SendsNothing()
    {
        var handler = new FakeHttpHandler(HttpStatusCode.OK, "{}");
        var sender = new ZeptoMailEmailSender(new HttpClient(handler), TestConfig.Of(), new CapturingLogger<ZeptoMailEmailSender>());

        sender.IsConfigured.Should().BeFalse();
        var result = await sender.SendAsync(Email());

        result.Success.Should().BeFalse();
        result.Configured.Should().BeFalse();
        result.Detail.Should().Contain("ZEPTOMAIL_API_TOKEN");
        handler.Requests.Should().BeEmpty();
    }

    [Fact]
    public async Task ZeptoMail_Unreachable_IsAFailureNotAnException()
    {
        var sender = new ZeptoMailEmailSender(new HttpClient(FakeHttpHandler.Throwing()), TestConfig.Of(("Email:ZeptoMailApiToken", ZeptoToken)), new CapturingLogger<ZeptoMailEmailSender>());
        var result = await sender.SendAsync(Email());
        result.Success.Should().BeFalse();
        result.Detail.Should().Contain("Could not reach ZeptoMail");
    }

    // ------------------------------------------------------------------ Gupshup SMS

    private static (string Key, string? Value)[] SmsSettings(bool withOtpTemplate = true) => new (string, string?)[]
    {
        ("Sms:Provider", "Gupshup"), ("Sms:GupshupUserId", "2000123456"), ("Sms:GupshupPassword", SmsPassword),
        ("Sms:SenderId", "BROCOM"), ("Sms:DltEntityId", "1101234567890123456"),
        ("Sms:DltTemplates:Otp", withOtpTemplate ? "1107000000000000001" : null),
    };

    [Fact]
    public async Task GupshupSms_PostsTheEnterpriseParameters_WithDltIds_AndTheExactRegisteredText()
    {
        var handler = new FakeHttpHandler(HttpStatusCode.OK, "success | 919876543210 | 3712345678901234567-123", "text/plain");
        var logger = new CapturingLogger<GupshupSmsSender>();
        var sender = new GupshupSmsSender(new HttpClient(handler), TestConfig.Of(SmsSettings()), logger);

        var result = await sender.SendAsync("+91 98765 43210", SmsTemplateKind.Otp, new[] { "482913" });

        result.Success.Should().BeTrue();
        result.ProviderMessageId.Should().Be("3712345678901234567-123");
        handler.LastRequest.Method.Should().Be(HttpMethod.Post);
        handler.LastRequest.RequestUri!.ToString().Should().Be("https://enterprise.smsgupshup.com/GatewayAPI/rest");
        handler.LastRequest.RequestUri!.Query.Should().BeEmpty("the password must not be in the URL");

        var form = HttpUtility.ParseQueryString(handler.LastBody);
        form["method"].Should().Be("sendMessage");
        form["send_to"].Should().Be("919876543210");
        form["msg_type"].Should().Be("text");
        form["userid"].Should().Be("2000123456");
        form["password"].Should().Be(SmsPassword);
        form["auth_scheme"].Should().Be("plain");
        form["v"].Should().Be("1.1");
        form["format"].Should().Be("text");
        form["mask"].Should().Be("BROCOM");
        form["principalEntityId"].Should().Be("1101234567890123456");
        form["dltTemplateId"].Should().Be("1107000000000000001");
        form["msg"].Should().Be("482913 is your BroCo verification code. It is valid for 10 minutes. Do not share it with anyone. - BroCo");
        SmsTemplates.Matches(SmsTemplates.Otp, form["msg"]!).Should().BeTrue();

        logger.All.Should().NotContain(SmsPassword).And.NotContain("482913").And.NotContain("9876543210");
    }

    [Theory]
    [InlineData("error | 105 | The specified password does not match", "105 The specified password does not match")]
    [InlineData("error|175|Invalid template", "175 Invalid template")]
    [InlineData("", "(empty response)")]
    public async Task GupshupSms_ErrorAnswers_AreFailuresWithTheReason(string answer, string reason)
    {
        var handler = new FakeHttpHandler(HttpStatusCode.OK, answer, "text/plain");
        var logger = new CapturingLogger<GupshupSmsSender>();
        var sender = new GupshupSmsSender(new HttpClient(handler), TestConfig.Of(SmsSettings()), logger);

        var result = await sender.SendAsync("9876543210", SmsTemplateKind.Otp, new[] { "111222" });

        result.Success.Should().BeFalse();
        result.Detail.Should().Contain(reason);
        logger.All.Should().NotContain(SmsPassword).And.NotContain("111222");
    }

    [Fact]
    public async Task GupshupSms_WithoutTheTemplatesDltId_SendsNothing_AndNamesTheMissingSetting()
    {
        var handler = new FakeHttpHandler(HttpStatusCode.OK, "success | 1 | 2", "text/plain");
        var sender = new GupshupSmsSender(new HttpClient(handler), TestConfig.Of(SmsSettings(withOtpTemplate: false)), new CapturingLogger<GupshupSmsSender>());

        var result = await sender.SendAsync("9876543210", SmsTemplateKind.Otp, new[] { "123456" });

        result.Configured.Should().BeFalse();
        result.Detail.Should().Contain("DLT_TEMPLATE_OTP");
        handler.Requests.Should().BeEmpty();
    }

    [Fact]
    public async Task GupshupSms_ProviderNone_IsOff_EvenWithCredentials()
    {
        var settings = SmsSettings().Where(s => s.Key != "Sms:Provider").Append(("Sms:Provider", "None")).ToArray();
        var sender = new GupshupSmsSender(new HttpClient(new FakeHttpHandler(HttpStatusCode.OK, "")), TestConfig.Of(settings), new CapturingLogger<GupshupSmsSender>());
        sender.IsConfigured.Should().BeFalse();
        (await sender.SendAsync("9876543210", SmsTemplateKind.Otp, new[] { "1" })).Configured.Should().BeFalse();
    }

    [Fact]
    public async Task GupshupSms_InvalidMobile_IsRefusedBeforeCallingGupshup()
    {
        var handler = new FakeHttpHandler(HttpStatusCode.OK, "success | 1 | 2", "text/plain");
        var sender = new GupshupSmsSender(new HttpClient(handler), TestConfig.Of(SmsSettings()), new CapturingLogger<GupshupSmsSender>());
        (await sender.SendAsync("12345", SmsTemplateKind.Otp, new[] { "123456" })).Success.Should().BeFalse();
        handler.Requests.Should().BeEmpty();
    }

    // ------------------------------------------------------------------ Gupshup WhatsApp

    private static (string Key, string? Value)[] WaSettings() => new (string, string?)[]
    {
        ("WhatsApp:Provider", "Gupshup"), ("WhatsApp:GupshupApiKey", WaKey), ("WhatsApp:SourceNumber", "+91 80000 12345"),
        ("WhatsApp:AppName", "BroCoApp"), ("WhatsApp:Templates:Otp", "b1c2-otp-template"),
    };

    [Fact]
    public async Task GupshupWhatsApp_PostsTheTemplateForm_WithTheApiKeyHeader()
    {
        var handler = new FakeHttpHandler(HttpStatusCode.Accepted, """{"status":"submitted","messageId":"ee4a68a0-1203"}""");
        var logger = new CapturingLogger<GupshupWhatsAppSender>();
        var sender = new GupshupWhatsAppSender(new HttpClient(handler), TestConfig.Of(WaSettings()), logger);

        var result = await sender.SendOtpAsync("09876543210", "654321");

        result.Success.Should().BeTrue();
        result.ProviderMessageId.Should().Be("ee4a68a0-1203");
        handler.LastRequest.RequestUri!.ToString().Should().Be("https://api.gupshup.io/wa/api/v1/template/msg");
        handler.LastRequest.Headers.GetValues("apikey").Single().Should().Be(WaKey);
        handler.LastRequest.Content!.Headers.ContentType!.MediaType.Should().Be("application/x-www-form-urlencoded");

        var form = HttpUtility.ParseQueryString(handler.LastBody);
        form["channel"].Should().Be("whatsapp");
        form["source"].Should().Be("918000012345");
        form["destination"].Should().Be("919876543210");
        form["src.name"].Should().Be("BroCoApp");
        using var template = JsonDocument.Parse(form["template"]!);
        template.RootElement.GetProperty("id").GetString().Should().Be("b1c2-otp-template");
        template.RootElement.GetProperty("params")[0].GetString().Should().Be("654321");

        logger.All.Should().NotContain(WaKey).And.NotContain("654321");
    }

    [Theory]
    [InlineData(HttpStatusCode.Unauthorized, """{"status":"error","message":"Authentication Failed"}""", "Authentication Failed")]
    [InlineData(HttpStatusCode.BadRequest, """{"status":"error","message":{"code":1002,"message":"Template not found"}}""", "Template not found")]
    [InlineData(HttpStatusCode.OK, """{"status":"error","message":"Invalid destination"}""", "Invalid destination")]
    public async Task GupshupWhatsApp_Errors_AreFailures(HttpStatusCode status, string answer, string reason)
    {
        var sender = new GupshupWhatsAppSender(new HttpClient(new FakeHttpHandler(status, answer)), TestConfig.Of(WaSettings()), new CapturingLogger<GupshupWhatsAppSender>());
        var result = await sender.SendOtpAsync("9876543210", "123456");
        result.Success.Should().BeFalse();
        result.Detail.Should().Contain(reason);
    }

    [Fact]
    public async Task GupshupWhatsApp_WithoutTheOtpTemplate_IsNotConfigured()
    {
        var settings = WaSettings().Where(s => s.Key != "WhatsApp:Templates:Otp").ToArray();
        var handler = new FakeHttpHandler(HttpStatusCode.OK, "{}");
        var sender = new GupshupWhatsAppSender(new HttpClient(handler), TestConfig.Of(settings), new CapturingLogger<GupshupWhatsAppSender>());
        sender.IsConfigured.Should().BeFalse();
        (await sender.SendOtpAsync("9876543210", "1")).Detail.Should().Contain("WA_TEMPLATE_OTP");
        handler.Requests.Should().BeEmpty();
    }

    [Fact]
    public void FlatEnvNames_WorkWhenTheApiRunsWithoutCompose()
    {
        var c = TestConfig.Of(("GUPSHUP_SMS_USERID", "1"), ("GUPSHUP_SMS_PASSWORD", "p"), ("SMS_SENDER_ID", "BROCOM"), ("DLT_ENTITY_ID", "2"),
            ("GUPSHUP_WA_API_KEY", "k"), ("GUPSHUP_WA_SOURCE_NUMBER", "918000012345"), ("WA_TEMPLATE_OTP", "t"));
        // Empty provider = Gupshup once its credentials are there.
        MessagingSettings.SmsConfigured(c).Should().BeTrue();
        MessagingSettings.WhatsAppConfigured(c).Should().BeTrue();
        MessagingSettings.EmailConfigured(c).Should().BeFalse();
    }
}
