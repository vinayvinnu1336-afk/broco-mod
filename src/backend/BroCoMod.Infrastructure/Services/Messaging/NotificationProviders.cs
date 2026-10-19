using BroCoMod.Application.Common;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace BroCoMod.Infrastructure.Services;

// The email / SMS / WhatsApp channels of INotificationProvider. Each looks up the user's address or mobile,
// picks the template for the notification type and returns false (without throwing) when the channel is not set
// up, the user has no address for it, or the type has no template on that channel.

public class EmailNotificationProvider : INotificationProvider
{
    private readonly IApplicationDbContext _context;
    private readonly IEmailSender _email;
    private readonly IConfiguration _configuration;
    private readonly ILogger<EmailNotificationProvider> _logger;

    public EmailNotificationProvider(IApplicationDbContext context, IEmailSender email, IConfiguration configuration, ILogger<EmailNotificationProvider> logger)
    {
        _context = context;
        _email = email;
        _configuration = configuration;
        _logger = logger;
    }

    public NotificationChannel Channel => NotificationChannel.Email;

    public async Task<bool> SendAsync(NotificationMessage message, CancellationToken cancellationToken = default)
    {
        if (!_email.IsConfigured)
        {
            _logger.LogDebug("[Email] Not set up; skipped {Type} email for user {UserId}", message.Type, message.UserId);
            return false;
        }

        var user = await _context.Users.AsNoTracking()
            .Where(u => u.Id == message.UserId)
            .Select(u => new { u.Email, u.FullName, u.IsActive })
            .FirstOrDefaultAsync(cancellationToken);
        if (user is null || !user.IsActive || string.IsNullOrWhiteSpace(user.Email)) return false;

        var rendered = Messaging.EmailTemplates.ForNotification(message, user.FullName, Messaging.MessagingSettings.PublicSiteUrl(_configuration));
        var result = await _email.SendAsync(new EmailMessage(user.Email, user.FullName, rendered.Subject, rendered.Html, rendered.Text, message.Type), cancellationToken);
        return result.Success;
    }
}

public class SmsNotificationProvider : INotificationProvider
{
    private readonly IApplicationDbContext _context;
    private readonly ISmsSender _sms;
    private readonly ILogger<SmsNotificationProvider> _logger;

    public SmsNotificationProvider(IApplicationDbContext context, ISmsSender sms, ILogger<SmsNotificationProvider> logger)
    {
        _context = context;
        _sms = sms;
        _logger = logger;
    }

    public NotificationChannel Channel => NotificationChannel.Sms;

    /// <summary>Which DLT template a notification type uses and its values, or null when the type is never sent by SMS.</summary>
    public static (SmsTemplateKind Kind, string?[] Values)? TemplateFor(NotificationMessage message)
    {
        var data = message.Data ?? new Dictionary<string, string>();
        string? Get(string key) => data.TryGetValue(key, out var v) && !string.IsNullOrWhiteSpace(v) ? v : null;

        (SmsTemplateKind, string?[])? result = message.Type switch
        {
            Messaging.EmailTemplates.PasswordResetType or Messaging.EmailTemplates.MobileVerificationType => (SmsTemplateKind.Otp, new[] { Get("code") }),
            Messaging.EmailTemplates.BookingConfirmedType => (SmsTemplateKind.BookingConfirmed, new[] { Get("requestNumber"), Get("vehicle") ?? "car" }),
            Messaging.EmailTemplates.QuoteReadyType => (SmsTemplateKind.QuoteReady, new[] { Get("requestNumber") }),
            Messaging.EmailTemplates.PaymentReceivedType => (SmsTemplateKind.PaymentReceived, new[] { Get("amount"), Get("purpose") ?? Get("paymentNumber") }),
            Messaging.EmailTemplates.CommissionDueType => (SmsTemplateKind.CommissionReminder, new[] { Get("amount"), Get("jobNumber"), Get("state") ?? "due" }),
            _ => null,
        };
        if (result is { } r && r.Item2.Any(v => v is null)) return null; // a value is missing: don't send a broken SMS
        return result;
    }

    public async Task<bool> SendAsync(NotificationMessage message, CancellationToken cancellationToken = default)
    {
        if (!_sms.IsConfigured || TemplateFor(message) is not { } template) return false;

        var user = await _context.Users.AsNoTracking()
            .Where(u => u.Id == message.UserId)
            .Select(u => new { u.PhoneNumber, u.IsActive })
            .FirstOrDefaultAsync(cancellationToken);
        if (user is null || !user.IsActive || !IndianMobile.IsValid(user.PhoneNumber)) return false;

        var result = await _sms.SendAsync(user.PhoneNumber, template.Kind, template.Values, cancellationToken);
        if (!result.Success)
        {
            _logger.LogInformation("[SMS] {Type} not sent to user {UserId}: {Detail}", message.Type, message.UserId, result.Detail);
        }
        return result.Success;
    }
}

/// <summary>WhatsApp carries one-time codes only (Meta authentication template); other notifications stay on SMS / email.</summary>
public class WhatsAppNotificationProvider : INotificationProvider
{
    private readonly IApplicationDbContext _context;
    private readonly IWhatsAppSender _whatsApp;

    public WhatsAppNotificationProvider(IApplicationDbContext context, IWhatsAppSender whatsApp)
    {
        _context = context;
        _whatsApp = whatsApp;
    }

    public NotificationChannel Channel => NotificationChannel.WhatsApp;

    public async Task<bool> SendAsync(NotificationMessage message, CancellationToken cancellationToken = default)
    {
        if (!_whatsApp.IsConfigured) return false;
        if (message.Type is not (Messaging.EmailTemplates.PasswordResetType or Messaging.EmailTemplates.MobileVerificationType)) return false;
        if (message.Data is null || !message.Data.TryGetValue("code", out var code) || string.IsNullOrWhiteSpace(code)) return false;

        var phone = await _context.Users.AsNoTracking()
            .Where(u => u.Id == message.UserId && u.IsActive)
            .Select(u => u.PhoneNumber)
            .FirstOrDefaultAsync(cancellationToken);
        if (!IndianMobile.IsValid(phone)) return false;

        return (await _whatsApp.SendOtpAsync(phone!, code, cancellationToken)).Success;
    }
}
