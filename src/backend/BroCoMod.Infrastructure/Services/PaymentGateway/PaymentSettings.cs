using Microsoft.Extensions.Configuration;

namespace BroCoMod.Infrastructure.Services.PaymentGateway;

/// <summary>
/// Which gateway takes new payments (<c>Payment:Provider</c> / <c>PAYMENT_PROVIDER</c>) and the Razorpay keys
/// (<c>Razorpay:KeyId</c>, <c>Razorpay:KeySecret</c>, <c>Razorpay:WebhookSecret</c>, or the flat
/// <c>RAZORPAY_*</c> environment variables from .env). Payments already in the database keep the provider
/// they were created with, so switching the default never breaks verification or refunds of older rows.
/// </summary>
public static class PaymentSettings
{
    public const string Razorpay = "Razorpay";

    public static string Provider(IConfiguration configuration)
    {
        var value = FirstNonEmpty(configuration["Payment:Provider"], configuration["PAYMENT_PROVIDER"]);
        if (string.IsNullOrEmpty(value)) return DevelopmentFakePaymentGateway.GatewayName;
        if (value.Equals(Razorpay, StringComparison.OrdinalIgnoreCase)) return Razorpay;
        if (value.Equals(DevelopmentFakePaymentGateway.GatewayName, StringComparison.OrdinalIgnoreCase)) return DevelopmentFakePaymentGateway.GatewayName;
        return value;
    }

    public static bool IsRazorpay(IConfiguration configuration) =>
        Provider(configuration).Equals(Razorpay, StringComparison.OrdinalIgnoreCase);

    /// <summary>Public key id (rzp_test_... / rzp_live_...). Safe to hand to the browser; the secret never is.</summary>
    public static string? RazorpayKeyId(IConfiguration configuration) =>
        FirstNonEmpty(configuration["Razorpay:KeyId"], configuration["RAZORPAY_KEY_ID"]);

    public static string? RazorpayKeySecret(IConfiguration configuration) =>
        FirstNonEmpty(configuration["Razorpay:KeySecret"], configuration["RAZORPAY_KEY_SECRET"]);

    public static string? RazorpayWebhookSecret(IConfiguration configuration) =>
        FirstNonEmpty(configuration["Razorpay:WebhookSecret"], configuration["RAZORPAY_WEBHOOK_SECRET"]);

    /// <summary>Why the Razorpay configuration is unusable, or null when it is complete.</summary>
    public static string? RazorpayConfigurationError(IConfiguration configuration)
    {
        if (!IsRazorpay(configuration)) return null;
        var missing = new List<string>();
        if (string.IsNullOrEmpty(RazorpayKeyId(configuration))) missing.Add("Razorpay:KeyId (RAZORPAY_KEY_ID)");
        if (string.IsNullOrEmpty(RazorpayKeySecret(configuration))) missing.Add("Razorpay:KeySecret (RAZORPAY_KEY_SECRET)");
        if (missing.Count == 0) return null;
        return $"Payment:Provider is Razorpay but {string.Join(" and ", missing)} is empty. " +
               "Paste the key id and secret from the Razorpay dashboard (Settings -> API Keys) into .env, " +
               "or set PAYMENT_PROVIDER=DevelopmentFake for a demo without real money. See docs/razorpay-setup.md.";
    }

    private static string? FirstNonEmpty(params string?[] values) =>
        values.Select(v => v?.Trim()).FirstOrDefault(v => !string.IsNullOrEmpty(v));
}
