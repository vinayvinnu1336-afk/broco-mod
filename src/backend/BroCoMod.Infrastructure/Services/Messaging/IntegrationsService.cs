using System.Security.Cryptography;
using BroCoMod.Application.Common;
using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Infrastructure.Services.PaymentGateway;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace BroCoMod.Infrastructure.Services.Messaging;

/// <summary>
/// Admin → System health → Integrations: which third-party keys are in place, and test sends so the owner can
/// confirm new keys work right after pasting them. Only "set / not set" and public facts (key mode, sender id
/// length) are reported; secret values never leave the server.
/// </summary>
public sealed class IntegrationsService : IIntegrationsService
{
    private readonly IConfiguration _c;
    private readonly IApplicationDbContext _context;
    private readonly IEmailSender _email;
    private readonly ISmsSender _sms;
    private readonly IWhatsAppSender _whatsApp;
    private readonly IAuditService _audit;

    public IntegrationsService(
        IConfiguration configuration,
        IApplicationDbContext context,
        IEmailSender email,
        ISmsSender sms,
        IWhatsAppSender whatsApp,
        IAuditService audit)
    {
        _c = configuration;
        _context = context;
        _email = email;
        _sms = sms;
        _whatsApp = whatsApp;
        _audit = audit;
    }

    public IntegrationsStatusDto GetStatus() =>
        new(DateTime.UtcNow, new[] { GoogleMaps(), Razorpay(), Email(), Sms(), WhatsApp() });

    private IntegrationStatusDto GoogleMaps()
    {
        var browser = GeocodingSettings.BrowserKey(_c) is not null;
        var server = GeocodingSettings.ServerKey(_c) is not null;
        var checks = new[]
        {
            new IntegrationCheckDto("Browser key (GOOGLE_MAPS_BROWSER_KEY)", browser, browser ? "Map and place search on the booking page" : "Booking form works without the map"),
            new IntegrationCheckDto("Server key (GOOGLE_MAPS_SERVER_KEY)", server, server ? "Address from pin and pincode check" : $"Address lookup falls back to {GeocodingSettings.FallbackProvider(_c)}"),
        };
        var status = browser && server ? IntegrationStatus.Configured : browser || server ? IntegrationStatus.Partial : IntegrationStatus.NotConfigured;
        var summary = status switch
        {
            IntegrationStatus.Configured => "Both keys are set.",
            IntegrationStatus.Partial => browser ? "Browser key set; server key missing." : "Server key set; browser key missing (no map on the booking page).",
            _ => "No keys. The booking form works without a map.",
        };
        return new IntegrationStatusDto("googleMaps", "Google Maps", status, summary, checks);
    }

    private IntegrationStatusDto Razorpay()
    {
        var provider = PaymentSettings.Provider(_c);
        var keyId = PaymentSettings.RazorpayKeyId(_c);
        var hasSecret = PaymentSettings.RazorpayKeySecret(_c) is not null;
        var hasWebhook = PaymentSettings.RazorpayWebhookSecret(_c) is not null;
        var mode = keyId is null ? null
            : keyId.StartsWith("rzp_live_", StringComparison.Ordinal) ? "Live"
            : keyId.StartsWith("rzp_test_", StringComparison.Ordinal) ? "Test"
            : "Unknown";

        var checks = new List<IntegrationCheckDto>
        {
            new("Payment provider (PAYMENT_PROVIDER)", PaymentSettings.IsRazorpay(_c), provider),
            new("Key id (RAZORPAY_KEY_ID)", keyId is not null,
                mode switch { "Live" => "Live key: real money", "Test" => "Test key: no real money moves", "Unknown" => "Does not start with rzp_test_ or rzp_live_", _ => null }),
            new("Key secret (RAZORPAY_KEY_SECRET)", hasSecret),
            new("Webhook secret (RAZORPAY_WEBHOOK_SECRET)", hasWebhook, hasWebhook ? null : "Payments still confirm at checkout; set it so late payments are caught too"),
        };

        if (!PaymentSettings.IsRazorpay(_c))
        {
            var fake = provider == DevelopmentFakePaymentGateway.GatewayName;
            return new IntegrationStatusDto("razorpay", "Razorpay payments", IntegrationStatus.NotConfigured,
                fake ? "Demo payments (no real money). Add Razorpay keys and set PAYMENT_PROVIDER=Razorpay to take payments." : $"Unknown payment provider \"{provider}\".",
                checks, mode);
        }

        if (PaymentSettings.RazorpayConfigurationError(_c) is { } error)
        {
            return new IntegrationStatusDto("razorpay", "Razorpay payments", IntegrationStatus.Error, error, checks, mode);
        }
        if (mode == "Unknown")
        {
            return new IntegrationStatusDto("razorpay", "Razorpay payments", IntegrationStatus.Error,
                "The key id does not look like a Razorpay key (rzp_test_… or rzp_live_…).", checks, mode);
        }

        var summary = (mode == "Live" ? "Live mode: customers pay real money." : "Test mode: use Razorpay test cards, no real money.")
                      + (hasWebhook ? string.Empty : " Webhook secret missing.");
        return new IntegrationStatusDto("razorpay", "Razorpay payments", hasWebhook ? IntegrationStatus.Configured : IntegrationStatus.Partial, summary, checks, mode);
    }

    private IntegrationStatusDto Email()
    {
        var token = MessagingSettings.ZeptoMailToken(_c) is not null;
        var from = MessagingSettings.FromAddress(_c);
        var fromOk = System.Net.Mail.MailAddress.TryCreate(from, out _);
        var checks = new[]
        {
            new IntegrationCheckDto("Send mail token (ZEPTOMAIL_API_TOKEN)", token),
            new IntegrationCheckDto("API host (ZEPTOMAIL_API_HOST)", true, MessagingSettings.ZeptoMailHost(_c)),
            new IntegrationCheckDto("From address (EMAIL_FROM_ADDRESS)", fromOk, $"{MessagingSettings.FromName(_c)} <{from}>"),
        };
        if (!token)
        {
            return new IntegrationStatusDto("email", "Email (ZeptoMail)", IntegrationStatus.NotConfigured,
                "No token. Password reset by email and email receipts are not sent.", checks);
        }
        return fromOk
            ? new IntegrationStatusDto("email", "Email (ZeptoMail)", IntegrationStatus.Configured, $"Sends from {from}. Use \"Send test email\" to confirm.", checks)
            : new IntegrationStatusDto("email", "Email (ZeptoMail)", IntegrationStatus.Error, $"EMAIL_FROM_ADDRESS \"{from}\" is not a valid email address.", checks);
    }

    private IntegrationStatusDto Sms()
    {
        var provider = MessagingSettings.SmsProvider(_c);
        var user = MessagingSettings.GupshupSmsUserId(_c) is not null;
        var password = MessagingSettings.GupshupSmsPassword(_c) is not null;
        var sender = MessagingSettings.SmsSenderId(_c);
        var entity = MessagingSettings.DltEntityId(_c) is not null;
        var senderOk = sender is { Length: 6 } && sender.All(char.IsAsciiLetter);

        var checks = new List<IntegrationCheckDto>
        {
            new("Provider (SMS_PROVIDER)", provider == MessagingSettings.Gupshup, provider),
            new("Gupshup user id (GUPSHUP_SMS_USERID)", user),
            new("Gupshup password (GUPSHUP_SMS_PASSWORD)", password),
            new("Sender id / DLT header (SMS_SENDER_ID)", senderOk, sender is null ? null : senderOk ? sender : $"\"{sender}\": DLT headers are 6 letters"),
            new("DLT entity id (DLT_ENTITY_ID)", entity),
        };
        var missingTemplates = new List<string>();
        foreach (var t in SmsTemplates.All)
        {
            var set = MessagingSettings.DltTemplateId(_c, t) is not null;
            if (!set) missingTemplates.Add(t.EnvVariable);
            checks.Add(new IntegrationCheckDto($"Template: {t.Kind} ({t.EnvVariable})", set, set ? null : "Not sent until set"));
        }

        if (provider != MessagingSettings.Gupshup)
        {
            return new IntegrationStatusDto("sms", "SMS (Gupshup, DLT)", IntegrationStatus.NotConfigured, "SMS is off. Codes go by WhatsApp only, if that is set up.", checks);
        }
        var missing = new List<string>();
        if (!user) missing.Add("GUPSHUP_SMS_USERID");
        if (!password) missing.Add("GUPSHUP_SMS_PASSWORD");
        if (sender is null) missing.Add("SMS_SENDER_ID");
        if (!entity) missing.Add("DLT_ENTITY_ID");
        if (missing.Count > 0)
        {
            return new IntegrationStatusDto("sms", "SMS (Gupshup, DLT)", IntegrationStatus.Error, $"SMS_PROVIDER is Gupshup but {string.Join(", ", missing)} {(missing.Count == 1 ? "is" : "are")} empty.", checks);
        }
        if (MessagingSettings.DltTemplateId(_c, SmsTemplates.Otp) is null)
        {
            return new IntegrationStatusDto("sms", "SMS (Gupshup, DLT)", IntegrationStatus.Error, "DLT_TEMPLATE_OTP is empty, so password reset codes cannot go by SMS.", checks);
        }
        return missingTemplates.Count == 0
            ? new IntegrationStatusDto("sms", "SMS (Gupshup, DLT)", IntegrationStatus.Configured, $"Sends as {sender}. Use \"Send test SMS\" to confirm.", checks)
            : new IntegrationStatusDto("sms", "SMS (Gupshup, DLT)", IntegrationStatus.Partial, $"Codes work. Not sent until their template id is set: {string.Join(", ", missingTemplates)}.", checks);
    }

    private IntegrationStatusDto WhatsApp()
    {
        var provider = MessagingSettings.WhatsAppProvider(_c);
        var key = MessagingSettings.GupshupWhatsAppApiKey(_c) is not null;
        var source = MessagingSettings.WhatsAppSourceNumber(_c);
        var app = MessagingSettings.WhatsAppAppName(_c);
        var template = MessagingSettings.WhatsAppOtpTemplateId(_c) is not null;
        var checks = new[]
        {
            new IntegrationCheckDto("Provider (WHATSAPP_PROVIDER)", provider == MessagingSettings.Gupshup, provider),
            new IntegrationCheckDto("API key (GUPSHUP_WA_API_KEY)", key),
            new IntegrationCheckDto("Business number (GUPSHUP_WA_SOURCE_NUMBER)", source is { Length: >= 10 }, source is { Length: > 4 } ? $"ends {source[^4..]}" : null),
            new IntegrationCheckDto("App name (GUPSHUP_WA_APP_NAME)", app is not null, app),
            new IntegrationCheckDto("Code template id (WA_TEMPLATE_OTP)", template),
        };
        if (provider != MessagingSettings.Gupshup)
        {
            return new IntegrationStatusDto("whatsapp", "WhatsApp (Gupshup)", IntegrationStatus.NotConfigured, "WhatsApp is off (optional). Codes go by SMS.", checks);
        }
        var missing = new List<string>();
        if (!key) missing.Add("GUPSHUP_WA_API_KEY");
        if (source is not { Length: >= 10 }) missing.Add("GUPSHUP_WA_SOURCE_NUMBER");
        if (!template) missing.Add("WA_TEMPLATE_OTP");
        if (missing.Count > 0)
        {
            return new IntegrationStatusDto("whatsapp", "WhatsApp (Gupshup)", IntegrationStatus.Error, $"WHATSAPP_PROVIDER is Gupshup but {string.Join(", ", missing)} {(missing.Count == 1 ? "is" : "are")} empty.", checks);
        }
        return new IntegrationStatusDto("whatsapp", "WhatsApp (Gupshup)", app is null ? IntegrationStatus.Partial : IntegrationStatus.Configured,
            app is null ? "Set GUPSHUP_WA_APP_NAME too (Gupshup asks for it on most apps)." : "Codes go by WhatsApp first, SMS if WhatsApp fails.", checks);
    }

    public async Task<TestMessageResultDto> SendTestEmailAsync(Guid adminUserId, CancellationToken cancellationToken = default)
    {
        var admin = await _context.Users.AsNoTracking()
            .Where(u => u.Id == adminUserId)
            .Select(u => new { u.Email, u.FullName })
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new KeyNotFoundException("Your account was not found.");

        var rendered = EmailTemplates.Generic(
            "BroCo test email",
            "This is a test email from Admin → System health. If you can read it, ZeptoMail is set up correctly and BroCo can send password reset codes and receipts.",
            admin.FullName,
            MessagingSettings.PublicSiteUrl(_c));
        var result = await _email.SendAsync(new EmailMessage(admin.Email, admin.FullName, rendered.Subject, rendered.Html, rendered.Text, "TEST"), cancellationToken);

        await AuditAsync(adminUserId, admin.Email, "Email", MessagingSettings.MaskEmail(admin.Email), result, cancellationToken);
        return ToDto("Email", admin.Email, result);
    }

    public async Task<TestMessageResultDto> SendTestMobileMessageAsync(Guid adminUserId, string mobile, string channel, CancellationToken cancellationToken = default)
    {
        var national = IndianMobile.NationalNumber(mobile) ?? throw new ArgumentException(IndianMobile.InvalidMessage);
        var isWhatsApp = string.Equals(channel, "WhatsApp", StringComparison.OrdinalIgnoreCase);
        if (!isWhatsApp && !string.Equals(channel, "Sms", StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException("Channel must be Sms or WhatsApp.");
        }

        // Operators only deliver registered templates, so the test uses the real code template with a random code.
        var code = RandomNumberGenerator.GetInt32(100000, 1000000).ToString("D6");
        var result = isWhatsApp
            ? await _whatsApp.SendOtpAsync(national, code, cancellationToken)
            : await _sms.SendAsync(national, SmsTemplateKind.Otp, new[] { code }, cancellationToken);

        var adminEmail = await _context.Users.AsNoTracking().Where(u => u.Id == adminUserId).Select(u => u.Email).FirstOrDefaultAsync(cancellationToken);
        var label = isWhatsApp ? "WhatsApp" : "Sms";
        await AuditAsync(adminUserId, adminEmail, label, MessagingSettings.MaskMobile(national), result, cancellationToken);
        return ToDto(label, IndianMobile.Normalize(national)!, result);
    }

    private Task AuditAsync(Guid adminUserId, string? adminEmail, string channel, string maskedRecipient, MessageSendResult result, CancellationToken ct) =>
        _audit.LogAsync(
            action: "INTEGRATION_TEST_SENT",
            userId: adminUserId,
            userEmail: adminEmail,
            entityName: "Integration",
            entityId: channel,
            details: $"Test {channel} to {maskedRecipient} via {result.Provider}: {(result.Success ? "accepted" : "failed")} - {result.Detail}",
            cancellationToken: ct);

    private static TestMessageResultDto ToDto(string channel, string recipient, MessageSendResult r) =>
        new(r.Success, channel, r.Provider, r.Configured, recipient, r.Detail, r.ProviderMessageId, r.HttpStatus);
}
