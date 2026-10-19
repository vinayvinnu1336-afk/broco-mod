using BroCoMod.Application.DTOs;

namespace BroCoMod.Application.Interfaces;

/// <summary>Admin view of the third-party integrations (Maps, Razorpay, email, SMS, WhatsApp) and test sends.</summary>
public interface IIntegrationsService
{
    IntegrationsStatusDto GetStatus();

    /// <summary>Sends a test email to the admin's own address.</summary>
    Task<TestMessageResultDto> SendTestEmailAsync(Guid adminUserId, CancellationToken cancellationToken = default);

    /// <summary>Sends a test code by SMS or WhatsApp (<paramref name="channel"/> "Sms" or "WhatsApp") to a mobile the admin typed.</summary>
    Task<TestMessageResultDto> SendTestMobileMessageAsync(Guid adminUserId, string mobile, string channel, CancellationToken cancellationToken = default);
}
