using BroCoMod.Application.Common;
using Microsoft.Extensions.Configuration;

namespace BroCoMod.Infrastructure.Services.Messaging;

/// <summary>
/// Email (ZeptoMail), SMS (Gupshup Enterprise, DLT) and WhatsApp (Gupshup) settings. Each value comes from its
/// appsettings key (docker compose maps the .env names there) or straight from the flat .env name when the API
/// runs without compose, the same way <see cref="PaymentGateway.PaymentSettings"/> reads the Razorpay keys.
/// Settings are read on every use, so tests and restarts see the current values. docs/integrations-setup.md.
/// </summary>
public static class MessagingSettings
{
    public const string Gupshup = "Gupshup";
    public const string None = "None";
    public const string DefaultZeptoMailHost = "api.zeptomail.in";
    public const string DefaultFromAddress = "noreply@brocomob.com";
    public const string DefaultFromName = "BroCo";
    public const string DefaultGupshupSmsUrl = "https://enterprise.smsgupshup.com/GatewayAPI/rest";
    public const string DefaultGupshupWhatsAppUrl = "https://api.gupshup.io/wa/api/v1/template/msg";

    // ---------------------------------------------------------------- Email (ZeptoMail)

    public static string? ZeptoMailToken(IConfiguration c) => Read(c, "Email:ZeptoMailApiToken", "ZEPTOMAIL_API_TOKEN");

    /// <summary>Host only, e.g. "api.zeptomail.in" (India data centre) or "api.zeptomail.com". A pasted URL is reduced to its host.</summary>
    public static string ZeptoMailHost(IConfiguration c)
    {
        var raw = Read(c, "Email:ZeptoMailApiHost", "ZEPTOMAIL_API_HOST") ?? DefaultZeptoMailHost;
        if (Uri.TryCreate(raw, UriKind.Absolute, out var uri) && !string.IsNullOrEmpty(uri.Host)) return uri.Host;
        return raw.Split('/')[0];
    }

    public static string FromAddress(IConfiguration c) => Read(c, "Email:FromAddress", "EMAIL_FROM_ADDRESS") ?? DefaultFromAddress;
    public static string FromName(IConfiguration c) => Read(c, "Email:FromName", "EMAIL_FROM_NAME") ?? DefaultFromName;
    public static bool EmailConfigured(IConfiguration c) => ZeptoMailToken(c) is not null;

    // ---------------------------------------------------------------- SMS (Gupshup Enterprise + DLT)

    /// <summary>"Gupshup" or "None". Empty means Gupshup when its user id and password are set.</summary>
    public static string SmsProvider(IConfiguration c) =>
        Provider(Read(c, "Sms:Provider", "SMS_PROVIDER"), GupshupSmsUserId(c) is not null && GupshupSmsPassword(c) is not null);

    public static string? GupshupSmsUserId(IConfiguration c) => Read(c, "Sms:GupshupUserId", "GUPSHUP_SMS_USERID");
    public static string? GupshupSmsPassword(IConfiguration c) => Read(c, "Sms:GupshupPassword", "GUPSHUP_SMS_PASSWORD");
    /// <summary>The 6-character DLT header (sender id), e.g. BROCOM.</summary>
    public static string? SmsSenderId(IConfiguration c) => Read(c, "Sms:SenderId", "SMS_SENDER_ID");
    public static string? DltEntityId(IConfiguration c) => Read(c, "Sms:DltEntityId", "DLT_ENTITY_ID");
    public static string GupshupSmsUrl(IConfiguration c) => Read(c, "Sms:GupshupUrl", "GUPSHUP_SMS_URL") ?? DefaultGupshupSmsUrl;
    public static string? DltTemplateId(IConfiguration c, SmsTemplate template) => Read(c, template.ConfigKey, template.EnvVariable);

    /// <summary>Gupshup chosen and every account-level value present (template ids are checked per message).</summary>
    public static bool SmsConfigured(IConfiguration c) =>
        SmsProvider(c) == Gupshup && GupshupSmsUserId(c) is not null && GupshupSmsPassword(c) is not null
        && SmsSenderId(c) is not null && DltEntityId(c) is not null;

    // ---------------------------------------------------------------- WhatsApp (Gupshup)

    /// <summary>"Gupshup" or "None". Empty means Gupshup when its API key and source number are set.</summary>
    public static string WhatsAppProvider(IConfiguration c) =>
        Provider(Read(c, "WhatsApp:Provider", "WHATSAPP_PROVIDER"), GupshupWhatsAppApiKey(c) is not null && WhatsAppSourceNumber(c) is not null);

    public static string? GupshupWhatsAppApiKey(IConfiguration c) => Read(c, "WhatsApp:GupshupApiKey", "GUPSHUP_WA_API_KEY");
    /// <summary>The WhatsApp business number, digits with country code (919876543210).</summary>
    public static string? WhatsAppSourceNumber(IConfiguration c) =>
        Read(c, "WhatsApp:SourceNumber", "GUPSHUP_WA_SOURCE_NUMBER") is { } n ? new string(n.Where(char.IsAsciiDigit).ToArray()) : null;
    public static string? WhatsAppAppName(IConfiguration c) => Read(c, "WhatsApp:AppName", "GUPSHUP_WA_APP_NAME");
    /// <summary>Gupshup template id of the approved Meta "Authentication" template that carries the code.</summary>
    public static string? WhatsAppOtpTemplateId(IConfiguration c) => Read(c, "WhatsApp:Templates:Otp", "WA_TEMPLATE_OTP");
    public static string GupshupWhatsAppUrl(IConfiguration c) => Read(c, "WhatsApp:GupshupUrl", "GUPSHUP_WA_URL") ?? DefaultGupshupWhatsAppUrl;

    public static bool WhatsAppConfigured(IConfiguration c) =>
        WhatsAppProvider(c) == Gupshup && GupshupWhatsAppApiKey(c) is not null && WhatsAppSourceNumber(c) is { Length: > 0 }
        && WhatsAppOtpTemplateId(c) is not null;

    // ---------------------------------------------------------------- One-time codes

    public static int OtpMaxRequestsPerNumber(IConfiguration c) => PositiveInt(c, "Otp:MaxRequestsPerNumber", 3);
    /// <summary>Per client IP. Higher than per number because mobile networks put many users behind one IP.</summary>
    public static int OtpMaxRequestsPerIp(IConfiguration c) => PositiveInt(c, "Otp:MaxRequestsPerIp", 10);
    public static TimeSpan OtpRequestWindow(IConfiguration c) => TimeSpan.FromMinutes(PositiveInt(c, "Otp:RequestWindowMinutes", 15));

    // ---------------------------------------------------------------- helpers

    /// <summary>The site address for links in emails (PUBLIC_ORIGIN, e.g. https://brocomob.com), or null for no links.</summary>
    public static string? PublicSiteUrl(IConfiguration c) =>
        Read(c, "App:PublicUrl", "PUBLIC_ORIGIN") is { } url && Uri.TryCreate(url, UriKind.Absolute, out var uri)
            && (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp) && !uri.Host.Equals("example.com", StringComparison.OrdinalIgnoreCase)
            ? url.TrimEnd('/')
            : null;

    /// <summary>"91" + the 10-digit national number, as Gupshup expects, or null for anything that is not an Indian mobile.</summary>
    public static string? GupshupMobile(string? mobile) => IndianMobile.NationalNumber(mobile) is { } n ? "91" + n : null;

    /// <summary>"******3210" for logs and admin messages.</summary>
    public static string MaskMobile(string? mobile)
    {
        var n = IndianMobile.NationalNumber(mobile);
        return n is null ? "(invalid number)" : $"******{n[^4..]}";
    }

    /// <summary>"ad***@brocomod.com" for logs.</summary>
    public static string MaskEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email)) return "(no email)";
        var at = email.IndexOf('@');
        if (at <= 0) return "***";
        var name = email[..at];
        return (name.Length <= 2 ? name[..1] : name[..2]) + "***" + email[at..];
    }

    private static string Provider(string? configured, bool hasCredentials)
    {
        if (string.IsNullOrEmpty(configured)) return hasCredentials ? Gupshup : None;
        return configured.Equals(Gupshup, StringComparison.OrdinalIgnoreCase) ? Gupshup : None;
    }

    private static int PositiveInt(IConfiguration c, string key, int fallback) =>
        int.TryParse(c[key], out var value) && value > 0 ? value : fallback;

    private static string? Read(IConfiguration c, params string[] keys) =>
        keys.Select(k => c[k]?.Trim()).FirstOrDefault(v => !string.IsNullOrEmpty(v));
}
