using BroCoMod.Application.Common;
using BroCoMod.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace BroCoMod.Infrastructure.Services.Messaging;

/// <summary>
/// SMS through Gupshup Enterprise's HTTP API (https://docs.gupshup.io/docs/send-message-to-single-number):
/// <c>https://enterprise.smsgupshup.com/GatewayAPI/rest</c> with method=sendMessage, send_to, msg, msg_type,
/// userid, password, auth_scheme=plain, v=1.1, format=text, plus the DLT values mask (sender id),
/// principalEntityId and dltTemplateId. The answer is plain text: <c>success | 919876543210 | message-id</c>
/// or <c>error | code | reason</c>.
/// The parameters go in a form-encoded POST body, not the URL, so the account password never lands in a
/// URL that a proxy or HttpClient log could record. Message text is not logged either (it may hold a code).
/// </summary>
public sealed class GupshupSmsSender : ISmsSender
{
    public const string ProviderName = "Gupshup SMS";

    private readonly HttpClient _http;
    private readonly IConfiguration _configuration;
    private readonly ILogger<GupshupSmsSender> _logger;

    public GupshupSmsSender(HttpClient http, IConfiguration configuration, ILogger<GupshupSmsSender> logger)
    {
        _http = http;
        _configuration = configuration;
        _logger = logger;
    }

    public bool IsConfigured => MessagingSettings.SmsConfigured(_configuration);

    public async Task<MessageSendResult> SendAsync(string mobile, SmsTemplateKind kind, IReadOnlyList<string?> values, CancellationToken cancellationToken = default)
    {
        var c = _configuration;
        if (MessagingSettings.SmsProvider(c) != MessagingSettings.Gupshup)
        {
            return MessageSendResult.NotConfigured(ProviderName, "SMS is switched off (SMS_PROVIDER is not Gupshup).");
        }

        var missing = new List<string>();
        if (MessagingSettings.GupshupSmsUserId(c) is null) missing.Add("GUPSHUP_SMS_USERID");
        if (MessagingSettings.GupshupSmsPassword(c) is null) missing.Add("GUPSHUP_SMS_PASSWORD");
        if (MessagingSettings.SmsSenderId(c) is null) missing.Add("SMS_SENDER_ID");
        if (MessagingSettings.DltEntityId(c) is null) missing.Add("DLT_ENTITY_ID");
        var template = SmsTemplates.For(kind);
        var templateId = MessagingSettings.DltTemplateId(c, template);
        if (templateId is null) missing.Add(template.EnvVariable);
        if (missing.Count > 0)
        {
            return MessageSendResult.NotConfigured(ProviderName, $"SMS is not fully set up: {string.Join(", ", missing)} {(missing.Count == 1 ? "is" : "are")} empty.");
        }

        var to = MessagingSettings.GupshupMobile(mobile);
        if (to is null)
        {
            return MessageSendResult.Failed(ProviderName, IndianMobile.InvalidMessage);
        }

        var text = SmsTemplates.Render(template, values);
        var form = new Dictionary<string, string>
        {
            ["method"] = "sendMessage",
            ["send_to"] = to,
            ["msg"] = text,
            ["msg_type"] = "text",
            ["userid"] = MessagingSettings.GupshupSmsUserId(c)!,
            ["password"] = MessagingSettings.GupshupSmsPassword(c)!,
            ["auth_scheme"] = "plain",
            ["v"] = "1.1",
            ["format"] = "text",
            ["mask"] = MessagingSettings.SmsSenderId(c)!,
            ["principalEntityId"] = MessagingSettings.DltEntityId(c)!,
            ["dltTemplateId"] = templateId!,
        };

        try
        {
            using var response = await _http.PostAsync(MessagingSettings.GupshupSmsUrl(c), new FormUrlEncodedContent(form), cancellationToken);
            var raw = (await response.Content.ReadAsStringAsync(cancellationToken)).Trim();
            var status = (int)response.StatusCode;
            var (ok, id, reason) = ParseResponse(raw);

            if (response.IsSuccessStatusCode && ok)
            {
                _logger.LogInformation("[SMS] Gupshup accepted {Template} SMS to {To} (id {MessageId})", kind, MessagingSettings.MaskMobile(mobile), id ?? "-");
                return MessageSendResult.Sent(ProviderName, "Accepted by Gupshup.", id, status);
            }

            _logger.LogWarning("[SMS] Gupshup refused {Template} SMS to {To}: HTTP {Status} {Reason}", kind, MessagingSettings.MaskMobile(mobile), status, reason);
            return MessageSendResult.Failed(ProviderName, $"Gupshup answered HTTP {status}: {reason}", status);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _logger.LogWarning("[SMS] Could not reach Gupshup: {Error}", ex.Message);
            return MessageSendResult.Failed(ProviderName, $"Could not reach Gupshup: {ex.Message}");
        }
    }

    /// <summary>
    /// "success | 919876543210 | 3712345678901234567-123" → (true, id, ...). "error | 105 | Invalid password" →
    /// (false, null, "105 Invalid password"). Anything else is a failure with a short snippet of the answer.
    /// </summary>
    public static (bool Success, string? MessageId, string Reason) ParseResponse(string raw)
    {
        var parts = raw.Split('|', StringSplitOptions.TrimEntries);
        if (parts.Length >= 1 && parts[0].Equals("success", StringComparison.OrdinalIgnoreCase))
        {
            return (true, parts.Length >= 3 ? parts[2] : null, "success");
        }
        if (parts.Length >= 2 && parts[0].Equals("error", StringComparison.OrdinalIgnoreCase))
        {
            return (false, null, string.Join(" ", parts.Skip(1).Where(p => p.Length > 0)));
        }
        return (false, null, ZeptoMailEmailSender.Snippet(raw));
    }
}
