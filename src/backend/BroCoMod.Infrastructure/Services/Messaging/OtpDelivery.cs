using BroCoMod.Application.Common;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Enums;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace BroCoMod.Infrastructure.Services.Messaging;

/// <summary>
/// One-time codes to a mobile: WhatsApp first when it is set up (cheaper, and it shows who sent it), then SMS
/// when WhatsApp is off or refuses the message. The code itself is never logged here.
/// </summary>
public sealed class OtpDeliveryService : IOtpDelivery
{
    private readonly IWhatsAppSender _whatsApp;
    private readonly ISmsSender _sms;
    private readonly ILogger<OtpDeliveryService> _logger;

    public OtpDeliveryService(IWhatsAppSender whatsApp, ISmsSender sms, ILogger<OtpDeliveryService> logger)
    {
        _whatsApp = whatsApp;
        _sms = sms;
        _logger = logger;
    }

    public bool IsAvailable => _whatsApp.IsConfigured || _sms.IsConfigured;

    public async Task<OtpDeliveryResult> SendOtpAsync(string mobile, string code, CancellationToken cancellationToken = default)
    {
        var attempts = new List<MessageSendResult>();

        if (_whatsApp.IsConfigured)
        {
            var result = await SafeAsync(() => _whatsApp.SendOtpAsync(mobile, code, cancellationToken), "Gupshup WhatsApp");
            attempts.Add(result);
            if (result.Success) return new OtpDeliveryResult(true, NotificationChannel.WhatsApp, attempts);
            _logger.LogWarning("[OTP] WhatsApp failed for {To} ({Detail}); falling back to SMS", MessagingSettings.MaskMobile(mobile), result.Detail);
        }

        if (_sms.IsConfigured)
        {
            var result = await SafeAsync(() => _sms.SendAsync(mobile, SmsTemplateKind.Otp, new[] { code }, cancellationToken), "Gupshup SMS");
            attempts.Add(result);
            if (result.Success) return new OtpDeliveryResult(true, NotificationChannel.Sms, attempts);
        }

        if (attempts.Count == 0)
        {
            _logger.LogWarning("[OTP] No WhatsApp or SMS provider is set up, so the code for {To} was not sent. See docs/integrations-setup.md.",
                MessagingSettings.MaskMobile(mobile));
        }
        else
        {
            _logger.LogError("[OTP] Could not deliver a code to {To}: {Details}", MessagingSettings.MaskMobile(mobile), string.Join("; ", attempts.Select(a => $"{a.Provider}: {a.Detail}")));
        }
        return new OtpDeliveryResult(false, null, attempts);
    }

    private async Task<MessageSendResult> SafeAsync(Func<Task<MessageSendResult>> send, string provider)
    {
        try
        {
            return await send();
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "[OTP] {Provider} threw while sending a code", provider);
            return MessageSendResult.Failed(provider, $"Unexpected error: {ex.GetType().Name}");
        }
    }
}

/// <summary>
/// Caps how many codes can be requested per mobile number (or email) and per client IP in a time window, so the
/// reset form cannot be used to flood someone's phone or to run up the SMS bill. Counters live in the shared
/// cache, next to the codes themselves. The cap applies whether or not an account exists, so it reveals nothing.
/// </summary>
public sealed class OtpRequestLimiter
{
    private readonly ICacheService _cache;
    private readonly IConfiguration _configuration;

    public OtpRequestLimiter(ICacheService cache, IConfiguration configuration)
    {
        _cache = cache;
        _configuration = configuration;
    }

    /// <summary>Counts one request, or throws <see cref="TooManyRequestsException"/> when either allowance is used up.</summary>
    public async Task AcquireAsync(string purpose, string destination, string? ipAddress, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var window = MessagingSettings.OtpRequestWindow(_configuration);
        var checks = new List<(string Key, int Limit)>
        {
            (Key(purpose, "to", destination), MessagingSettings.OtpMaxRequestsPerNumber(_configuration)),
        };
        if (!string.IsNullOrWhiteSpace(ipAddress))
        {
            checks.Add((Key(purpose, "ip", ipAddress), MessagingSettings.OtpMaxRequestsPerIp(_configuration)));
        }

        var counters = new List<(string Key, Counter Counter)>();
        foreach (var (key, limit) in checks)
        {
            var counter = await _cache.GetAsync<Counter>(key, ct);
            if (counter is null || counter.WindowEndsUtc <= now) counter = new Counter(0, now.Add(window));
            if (counter.Count >= limit)
            {
                var wait = counter.WindowEndsUtc - now;
                var minutes = Math.Max(1, (int)Math.Ceiling(wait.TotalMinutes));
                throw new TooManyRequestsException(
                    $"Too many codes requested. Please wait {minutes} minute{(minutes == 1 ? "" : "s")} and try again.", wait);
            }
            counters.Add((key, counter));
        }

        foreach (var (key, counter) in counters)
        {
            var remaining = counter.WindowEndsUtc - now;
            if (remaining > TimeSpan.Zero)
            {
                await _cache.SetAsync(key, counter with { Count = counter.Count + 1 }, remaining, ct);
            }
        }
    }

    private static string Key(string purpose, string scope, string value) =>
        $"otp-limit:{purpose.Trim().ToLowerInvariant()}:{scope}:{value.Trim().ToLowerInvariant()}";

    public sealed record Counter(int Count, DateTime WindowEndsUtc);
}
