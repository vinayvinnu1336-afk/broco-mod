using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using BroCoMod.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace BroCoMod.Infrastructure.Services.Messaging;

/// <summary>
/// Transactional email through Zoho ZeptoMail's send-mail API:
/// <c>POST https://{host}/v1.1/email</c> with <c>Authorization: Zoho-enczapikey {send mail token}</c> and a JSON body
/// <c>{ from: {address, name}, to: [{ email_address: {address, name} }], subject, htmlbody, textbody }</c>
/// (https://www.zoho.com/zeptomail/help/api/email-sending.html). Accounts in the India data centre use
/// api.zeptomail.in, the others api.zeptomail.com; the Mail Agent's "Setup Info" page shows which.
/// The token is never logged: HttpClient logging redacts the Authorization header.
/// </summary>
public sealed class ZeptoMailEmailSender : IEmailSender
{
    public const string ProviderName = "ZeptoMail";
    private const string AuthScheme = "Zoho-enczapikey";

    private readonly HttpClient _http;
    private readonly IConfiguration _configuration;
    private readonly ILogger<ZeptoMailEmailSender> _logger;

    public ZeptoMailEmailSender(HttpClient http, IConfiguration configuration, ILogger<ZeptoMailEmailSender> logger)
    {
        _http = http;
        _configuration = configuration;
        _logger = logger;
    }

    public bool IsConfigured => MessagingSettings.EmailConfigured(_configuration);

    public async Task<MessageSendResult> SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        var token = MessagingSettings.ZeptoMailToken(_configuration);
        if (token is null)
        {
            return MessageSendResult.NotConfigured(ProviderName, "Email is not set up: ZEPTOMAIL_API_TOKEN is empty.");
        }
        if (string.IsNullOrWhiteSpace(message.ToAddress))
        {
            return MessageSendResult.Failed(ProviderName, "The recipient has no email address.");
        }

        var host = MessagingSettings.ZeptoMailHost(_configuration);
        var body = new
        {
            from = new { address = MessagingSettings.FromAddress(_configuration), name = MessagingSettings.FromName(_configuration) },
            to = new[] { new { email_address = new { address = message.ToAddress.Trim(), name = string.IsNullOrWhiteSpace(message.ToName) ? message.ToAddress.Trim() : message.ToName.Trim() } } },
            subject = message.Subject,
            htmlbody = message.HtmlBody,
            textbody = message.TextBody,
            track_opens = false,
            track_clicks = false,
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, $"https://{host}/v1.1/email")
        {
            Content = JsonContent.Create(body),
        };
        request.Headers.TryAddWithoutValidation("Authorization", AuthorizationValue(token));
        request.Headers.TryAddWithoutValidation("Accept", "application/json");

        try
        {
            using var response = await _http.SendAsync(request, cancellationToken);
            var raw = await response.Content.ReadAsStringAsync(cancellationToken);
            var status = (int)response.StatusCode;

            if (response.IsSuccessStatusCode)
            {
                var requestId = ReadString(raw, "request_id");
                _logger.LogInformation("[Email] ZeptoMail accepted {Category} email to {To} (request {RequestId})",
                    message.Category, MessagingSettings.MaskEmail(message.ToAddress), requestId ?? "-");
                return MessageSendResult.Sent(ProviderName, $"Accepted by ZeptoMail ({host}).", requestId, status);
            }

            var error = DescribeError(raw);
            _logger.LogWarning("[Email] ZeptoMail refused {Category} email to {To}: HTTP {Status} {Error}",
                message.Category, MessagingSettings.MaskEmail(message.ToAddress), status, error);
            return MessageSendResult.Failed(ProviderName, $"ZeptoMail ({host}) answered HTTP {status}: {error}", status);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _logger.LogWarning("[Email] Could not reach ZeptoMail at {Host}: {Error}", host, ex.Message);
            return MessageSendResult.Failed(ProviderName, $"Could not reach ZeptoMail at {host}: {ex.Message}");
        }
    }

    /// <summary>People often paste the whole "Zoho-enczapikey xxx" string from the console; accept both.</summary>
    public static string AuthorizationValue(string token) =>
        token.StartsWith(AuthScheme, StringComparison.OrdinalIgnoreCase) ? token : $"{AuthScheme} {token}";

    /// <summary>
    /// ZeptoMail errors come as <c>{"error":{"code","message","details":[{"message","target"}]}}</c>; the help page
    /// also shows <c>{"data":{"error_code","message"}}</c>. Read either, and fall back to a short raw snippet.
    /// </summary>
    public static string DescribeError(string raw)
    {
        try
        {
            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;
            foreach (var name in new[] { "error", "data" })
            {
                if (!root.TryGetProperty(name, out var e) || e.ValueKind != JsonValueKind.Object) continue;
                var code = Str(e, "code") ?? Str(e, "error_code");
                var text = Str(e, "message");
                var detail = e.TryGetProperty("details", out var details) && details.ValueKind == JsonValueKind.Array && details.GetArrayLength() > 0
                    ? Str(details[0], "message") : null;
                var parts = new[] { code, text, detail }.Where(p => !string.IsNullOrWhiteSpace(p)).Distinct();
                var joined = string.Join(" - ", parts);
                if (joined.Length > 0) return joined;
            }
            if (Str(root, "message") is { } top) return top;
        }
        catch (JsonException)
        {
        }
        return Snippet(raw);
    }

    private static string? ReadString(string raw, string property)
    {
        try
        {
            using var doc = JsonDocument.Parse(raw);
            return Str(doc.RootElement, property);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string? Str(JsonElement e, string property) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(property, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

    public static string Snippet(string raw)
    {
        var oneLine = new StringBuilder(raw.Length);
        foreach (var ch in raw) oneLine.Append(char.IsControl(ch) ? ' ' : ch);
        var text = oneLine.ToString().Trim();
        if (text.Length == 0) return "(empty response)";
        return text.Length <= 200 ? text : text[..200] + "…";
    }
}
