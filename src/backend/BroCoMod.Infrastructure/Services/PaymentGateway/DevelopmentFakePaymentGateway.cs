using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using BroCoMod.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace BroCoMod.Infrastructure.Services.PaymentGateway;

/// <summary>
/// Simulated payment gateway for development, staging, and automated integration testing.
/// Provides deterministic order generation, HMAC signature verification, and mock webhook processing.
/// In strict production mode, usage of this fake gateway will fail configuration assertions.
/// </summary>
public class DevelopmentFakePaymentGateway : IPaymentGateway
{
    public const string GatewayName = "DevelopmentFake";
    private readonly IHostEnvironment _environment;
    private readonly IConfiguration _configuration;
    private readonly ILogger<DevelopmentFakePaymentGateway> _logger;

    public string ProviderName => GatewayName;

    public DevelopmentFakePaymentGateway(
        IHostEnvironment environment,
        IConfiguration configuration,
        ILogger<DevelopmentFakePaymentGateway> logger)
    {
        _environment = environment;
        _configuration = configuration;
        _logger = logger;
    }

    public Task<PaymentOrderResult> CreatePaymentOrderAsync(
        CreatePaymentOrderParams request,
        CancellationToken cancellationToken = default)
    {
        AssertNotProduction();

        var orderId = $"ord_fake_{Guid.NewGuid():N}";
        _logger.LogInformation(
            "FakePaymentGateway: Created order {OrderId} for payment {PaymentNumber}, amount {Amount} {Currency}",
            orderId, request.PaymentNumber, request.Amount, request.Currency);

        var checkoutUrl = $"/customer/payments/checkout?orderId={orderId}&paymentNumber={request.PaymentNumber}";

        var providerData = new Dictionary<string, string>
        {
            ["key_id"] = "rzp_test_brocomod_fake_key",
            ["order_id"] = orderId,
            ["amount"] = ((long)(request.Amount * 100m)).ToString(),
            ["currency"] = request.Currency,
            ["name"] = "BroCo Mod Automotive",
            ["description"] = request.Description
        };

        return Task.FromResult(new PaymentOrderResult(
            OrderId: orderId,
            Amount: request.Amount,
            Currency: request.Currency,
            GatewayProvider: GatewayName,
            CheckoutUrl: checkoutUrl,
            ProviderData: providerData
        ));
    }

    public Task<PaymentVerificationResult> VerifyPaymentAsync(
        VerifyPaymentParams request,
        CancellationToken cancellationToken = default)
    {
        AssertNotProduction();

        if (string.IsNullOrWhiteSpace(request.GatewayPaymentId))
        {
            return Task.FromResult(new PaymentVerificationResult(
                IsSuccess: false,
                GatewayPaymentId: string.Empty,
                GatewayOrderId: request.GatewayOrderId,
                PaidAmount: 0m,
                Currency: request.ExpectedCurrency,
                PaymentMethod: null,
                ErrorMessage: "Gateway payment ID is required."
            ));
        }

        // Check if signature was provided or if using standard test payment ID
        var isValid = !string.IsNullOrWhiteSpace(request.GatewayPaymentId) &&
                      (request.GatewayPaymentId.StartsWith("pay_") || request.GatewayPaymentId.StartsWith("test_") || request.GatewayPaymentId.StartsWith("sim_"));

        if (!isValid)
        {
            return Task.FromResult(new PaymentVerificationResult(
                IsSuccess: false,
                GatewayPaymentId: request.GatewayPaymentId,
                GatewayOrderId: request.GatewayOrderId,
                PaidAmount: 0m,
                Currency: request.ExpectedCurrency,
                PaymentMethod: null,
                ErrorMessage: "Invalid fake payment identifier."
            ));
        }

        _logger.LogInformation(
            "FakePaymentGateway: Successfully verified payment {PaymentId} for order {OrderId}",
            request.GatewayPaymentId, request.GatewayOrderId);

        return Task.FromResult(new PaymentVerificationResult(
            IsSuccess: true,
            GatewayPaymentId: request.GatewayPaymentId,
            GatewayOrderId: request.GatewayOrderId,
            PaidAmount: request.ExpectedAmount,
            Currency: request.ExpectedCurrency,
            PaymentMethod: "Card"
        ));
    }

    public Task<WebhookProcessResult> HandleWebhookAsync(
        string payload,
        string signature,
        string? webhookSecret = null,
        CancellationToken cancellationToken = default)
    {
        AssertNotProduction();

        try
        {
            // Verify HMAC signature if secret is configured
            var secret = webhookSecret ?? _configuration["Payment:WebhookSecret"] ?? "brocomod_test_webhook_secret";
            if (!string.IsNullOrWhiteSpace(secret) && !string.IsNullOrWhiteSpace(signature))
            {
                var expectedSig = ComputeHmacSha256(payload, secret);
                // Allow exact match or mock test signature "test_signature"
                if (!string.Equals(expectedSig, signature, StringComparison.OrdinalIgnoreCase) &&
                    signature != "test_signature" && !signature.StartsWith("sim_sig_"))
                {
                    _logger.LogWarning("FakePaymentGateway: Invalid webhook signature. Expected {Expected}, got {Actual}", expectedSig, signature);
                    return Task.FromResult(new WebhookProcessResult(
                        IsHandled: false,
                        EventType: null,
                        GatewayOrderId: null,
                        GatewayPaymentId: null,
                        Amount: null,
                        Currency: null,
                        Status: null,
                        ErrorMessage: "Invalid webhook signature."
                    ));
                }
            }

            using var doc = JsonDocument.Parse(payload);
            var root = doc.RootElement;

            string? eventType = root.TryGetProperty("event", out var ev) ? ev.GetString() : "payment.captured";
            string? orderId = null;
            string? paymentId = null;
            decimal? amount = null;
            string? currency = "INR";
            string? status = "captured";

            if (root.TryGetProperty("payload", out var payloadElem) &&
                payloadElem.TryGetProperty("payment", out var paymentElem) &&
                paymentElem.TryGetProperty("entity", out var entityElem))
            {
                orderId = entityElem.TryGetProperty("order_id", out var o) ? o.GetString() : null;
                paymentId = entityElem.TryGetProperty("id", out var p) ? p.GetString() : null;
                if (entityElem.TryGetProperty("amount", out var a) && a.TryGetInt64(out var amtLong))
                {
                    amount = amtLong / 100m;
                }
                currency = entityElem.TryGetProperty("currency", out var c) ? c.GetString() : "INR";
                status = entityElem.TryGetProperty("status", out var s) ? s.GetString() : "captured";
            }
            else
            {
                // Fallback direct root parsing
                if (root.TryGetProperty("order_id", out var o)) orderId = o.GetString();
                if (root.TryGetProperty("payment_id", out var p)) paymentId = p.GetString();
                if (root.TryGetProperty("amount", out var a) && a.TryGetDecimal(out var amtDec)) amount = amtDec;
                if (root.TryGetProperty("currency", out var c)) currency = c.GetString();
                if (root.TryGetProperty("status", out var s)) status = s.GetString();
            }

            return Task.FromResult(new WebhookProcessResult(
                IsHandled: true,
                EventType: eventType,
                GatewayOrderId: orderId,
                GatewayPaymentId: paymentId,
                Amount: amount,
                Currency: currency,
                Status: status
            ));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "FakePaymentGateway: Error handling webhook payload");
            return Task.FromResult(new WebhookProcessResult(
                IsHandled: false,
                EventType: null,
                GatewayOrderId: null,
                GatewayPaymentId: null,
                Amount: null,
                Currency: null,
                Status: null,
                ErrorMessage: ex.Message
            ));
        }
    }

    public Task<RefundPaymentResult> RefundPaymentAsync(
        RefundPaymentParams request,
        CancellationToken cancellationToken = default)
    {
        AssertNotProduction();

        var refundId = $"rfnd_fake_{Guid.NewGuid():N}";
        _logger.LogInformation(
            "FakePaymentGateway: Processed refund {RefundId} of {Amount} {Currency} for payment {PaymentId}. Reason: {Reason}",
            refundId, request.RefundAmount, request.Currency, request.GatewayPaymentId, request.Reason);

        return Task.FromResult(new RefundPaymentResult(
            IsSuccess: true,
            RefundId: refundId,
            RefundedAmount: request.RefundAmount
        ));
    }

    private void AssertNotProduction()
    {
        if (_environment.IsProduction())
        {
            var allowInProd = _configuration.GetValue<bool>("Payment:AllowFakeInProduction", false);
            if (!allowInProd)
            {
                throw new InvalidOperationException(
                    "CRITICAL SECURITY ASSERTION: DevelopmentFakePaymentGateway must NOT be used in Production environment.");
            }
        }
    }

    public static string ComputeHmacSha256(string data, string secret)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(data));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
