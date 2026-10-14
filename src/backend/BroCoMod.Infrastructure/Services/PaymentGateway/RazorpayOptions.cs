using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;

namespace BroCoMod.Infrastructure.Services.PaymentGateway;

/// <summary>
/// Snapshot of the payment configuration, validated when the host starts (ValidateOnStart) so that
/// "Razorpay without keys" is a clear startup error, not a failed checkout for the first customer.
/// Only the key id is kept; secrets are read by the gateway when needed and never copied around.
/// </summary>
public sealed class RazorpayOptions
{
    public string Provider { get; set; } = DevelopmentFakePaymentGateway.GatewayName;
    public string? KeyId { get; set; }
    public bool HasKeySecret { get; set; }
    public bool HasWebhookSecret { get; set; }
    public string? ConfigurationError { get; set; }

    public static void Bind(RazorpayOptions options, IConfiguration configuration)
    {
        options.Provider = PaymentSettings.Provider(configuration);
        options.KeyId = PaymentSettings.RazorpayKeyId(configuration);
        options.HasKeySecret = !string.IsNullOrEmpty(PaymentSettings.RazorpayKeySecret(configuration));
        options.HasWebhookSecret = !string.IsNullOrEmpty(PaymentSettings.RazorpayWebhookSecret(configuration));
        options.ConfigurationError = PaymentSettings.RazorpayConfigurationError(configuration);
    }
}

public sealed class RazorpayOptionsValidator : IValidateOptions<RazorpayOptions>
{
    public ValidateOptionsResult Validate(string? name, RazorpayOptions options) =>
        options.ConfigurationError is null ? ValidateOptionsResult.Success : ValidateOptionsResult.Fail(options.ConfigurationError);
}
