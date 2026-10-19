using BroCoMod.Application.Common;
using BroCoMod.Domain.Enums;

namespace BroCoMod.Application.Interfaces;

/// <summary>What a provider said about one message. <see cref="Detail"/> is safe to show an admin: never a secret.</summary>
public sealed record MessageSendResult(
    bool Success,
    string Provider,
    bool Configured,
    string Detail,
    string? ProviderMessageId = null,
    int? HttpStatus = null)
{
    public static MessageSendResult NotConfigured(string provider, string detail) => new(false, provider, false, detail);
    public static MessageSendResult Sent(string provider, string detail, string? id, int? status = null) => new(true, provider, true, detail, id, status);
    public static MessageSendResult Failed(string provider, string detail, int? status = null) => new(false, provider, true, detail, null, status);
}

public sealed record EmailMessage(
    string ToAddress,
    string? ToName,
    string Subject,
    string HtmlBody,
    string TextBody,
    string Category = "GENERAL");

/// <summary>Transactional email (ZeptoMail). Not configured = every send returns a NotConfigured result.</summary>
public interface IEmailSender
{
    bool IsConfigured { get; }
    Task<MessageSendResult> SendAsync(EmailMessage message, CancellationToken cancellationToken = default);
}

/// <summary>DLT-compliant SMS (Gupshup Enterprise). Only registered templates can be sent.</summary>
public interface ISmsSender
{
    bool IsConfigured { get; }
    /// <param name="mobile">Any Indian mobile format; sent as 91XXXXXXXXXX.</param>
    Task<MessageSendResult> SendAsync(string mobile, SmsTemplateKind template, IReadOnlyList<string?> values, CancellationToken cancellationToken = default);
}

/// <summary>WhatsApp template messages (Gupshup). Only Meta-approved templates can be sent outside a chat session.</summary>
public interface IWhatsAppSender
{
    bool IsConfigured { get; }
    Task<MessageSendResult> SendOtpAsync(string mobile, string code, CancellationToken cancellationToken = default);
}

public sealed record OtpDeliveryResult(bool Delivered, NotificationChannel? Channel, IReadOnlyList<MessageSendResult> Attempts);

/// <summary>Sends a one-time code to a mobile: WhatsApp first when it is set up, SMS when WhatsApp is off or fails.</summary>
public interface IOtpDelivery
{
    bool IsAvailable { get; }
    Task<OtpDeliveryResult> SendOtpAsync(string mobile, string code, CancellationToken cancellationToken = default);
}
