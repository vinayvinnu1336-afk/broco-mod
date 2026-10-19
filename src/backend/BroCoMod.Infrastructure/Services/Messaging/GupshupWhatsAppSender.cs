using System.Text.Json;
using BroCoMod.Application.Common;
using BroCoMod.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace BroCoMod.Infrastructure.Services.Messaging;

/// <summary>
/// WhatsApp template messages through Gupshup (https://docs.gupshup.io/docs/template-messages):
/// <c>POST https://api.gupshup.io/wa/api/v1/template/msg</c>, header <c>apikey</c>, form fields channel=whatsapp,
/// source (business number), destination, src.name (Gupshup app name) and
/// <c>template={"id":"...","params":["..."]}</c>. Gupshup answers <c>{"status":"submitted","messageId":"..."}</c>
/// and reports delivery later by webhook, so "submitted" means accepted, not yet delivered.
/// The API key is never logged: HttpClient logging redacts the apikey header.
/// </summary>
public sealed class GupshupWhatsAppSender : IWhatsAppSender
{
    public const string ProviderName = "Gupshup WhatsApp";

    private readonly HttpClient _http;
    private readonly IConfiguration _configuration;
    private readonly ILogger<GupshupWhatsAppSender> _logger;

    public GupshupWhatsAppSender(HttpClient http, IConfiguration configuration, ILogger<GupshupWhatsAppSender> logger)
    {
        _http = http;
        _configuration = configuration;
        _logger = logger;
    }

    public bool IsConfigured => MessagingSettings.WhatsAppConfigured(_configuration);

    public Task<MessageSendResult> SendOtpAsync(string mobile, string code, CancellationToken cancellationToken = default) =>
        SendTemplateAsync(mobile, MessagingSettings.WhatsAppOtpTemplateId(_configuration), "WA_TEMPLATE_OTP", new[] { code }, "OTP", cancellationToken);

    private async Task<MessageSendResult> SendTemplateAsync(
        string mobile, string? templateId, string templateEnv, IReadOnlyList<string> parameters, string label, CancellationToken ct)
    {
        var c = _configuration;
        if (MessagingSettings.WhatsAppProvider(c) != MessagingSettings.Gupshup)
        {
            return MessageSendResult.NotConfigured(ProviderName, "WhatsApp is switched off (WHATSAPP_PROVIDER is not Gupshup).");
        }

        var apiKey = MessagingSettings.GupshupWhatsAppApiKey(c);
        var source = MessagingSettings.WhatsAppSourceNumber(c);
        var missing = new List<string>();
        if (apiKey is null) missing.Add("GUPSHUP_WA_API_KEY");
        if (string.IsNullOrEmpty(source)) missing.Add("GUPSHUP_WA_SOURCE_NUMBER");
        if (templateId is null) missing.Add(templateEnv);
        if (missing.Count > 0)
        {
            return MessageSendResult.NotConfigured(ProviderName, $"WhatsApp is not fully set up: {string.Join(", ", missing)} {(missing.Count == 1 ? "is" : "are")} empty.");
        }

        var to = MessagingSettings.GupshupMobile(mobile);
        if (to is null)
        {
            return MessageSendResult.Failed(ProviderName, IndianMobile.InvalidMessage);
        }

        var form = new Dictionary<string, string>
        {
            ["channel"] = "whatsapp",
            ["source"] = source!,
            ["destination"] = to,
            ["template"] = JsonSerializer.Serialize(new { id = templateId, @params = parameters }),
        };
        if (MessagingSettings.WhatsAppAppName(c) is { } appName) form["src.name"] = appName;

        using var request = new HttpRequestMessage(HttpMethod.Post, MessagingSettings.GupshupWhatsAppUrl(c))
        {
            Content = new FormUrlEncodedContent(form),
        };
        request.Headers.TryAddWithoutValidation("apikey", apiKey);

        try
        {
            using var response = await _http.SendAsync(request, ct);
            var raw = await response.Content.ReadAsStringAsync(ct);
            var status = (int)response.StatusCode;
            var (ok, id, reason) = ParseResponse(raw);

            if (response.IsSuccessStatusCode && ok)
            {
                _logger.LogInformation("[WhatsApp] Gupshup accepted {Template} message to {To} (id {MessageId})", label, MessagingSettings.MaskMobile(mobile), id ?? "-");
                return MessageSendResult.Sent(ProviderName, "Submitted to Gupshup (delivery is confirmed later by WhatsApp).", id, status);
            }

            _logger.LogWarning("[WhatsApp] Gupshup refused {Template} message to {To}: HTTP {Status} {Reason}", label, MessagingSettings.MaskMobile(mobile), status, reason);
            return MessageSendResult.Failed(ProviderName, $"Gupshup answered HTTP {status}: {reason}", status);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _logger.LogWarning("[WhatsApp] Could not reach Gupshup: {Error}", ex.Message);
            return MessageSendResult.Failed(ProviderName, $"Could not reach Gupshup: {ex.Message}");
        }
    }

    /// <summary>{"status":"submitted","messageId":"..."} is success; {"status":"error","message":"..."} (or anything else) is not.</summary>
    public static (bool Success, string? MessageId, string Reason) ParseResponse(string raw)
    {
        try
        {
            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return (false, null, ZeptoMailEmailSender.Snippet(raw));
            var status = root.TryGetProperty("status", out var s) && s.ValueKind == JsonValueKind.String ? s.GetString() : null;
            var id = root.TryGetProperty("messageId", out var m) && m.ValueKind == JsonValueKind.String ? m.GetString() : null;
            if (string.Equals(status, "submitted", StringComparison.OrdinalIgnoreCase) || (status is null && id is not null))
            {
                return (true, id, "submitted");
            }

            var message = root.TryGetProperty("message", out var msg)
                ? msg.ValueKind == JsonValueKind.String ? msg.GetString() : msg.ToString()
                : null;
            return (false, null, string.Join(" - ", new[] { status, message }.Where(p => !string.IsNullOrWhiteSpace(p))) is { Length: > 0 } r ? r : ZeptoMailEmailSender.Snippet(raw));
        }
        catch (JsonException)
        {
            return (false, null, ZeptoMailEmailSender.Snippet(raw));
        }
    }
}
