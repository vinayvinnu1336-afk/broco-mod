using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Enums;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace BroCoMod.Infrastructure.Services.PaymentGateway;

/// <summary>
/// Razorpay (https://razorpay.com/docs/api/): orders are created server-side, the browser opens Razorpay
/// Checkout with the order id, and the result is verified here with the key secret before a payment is
/// marked paid. Keys come from configuration (see <see cref="PaymentSettings"/>); the key secret and the
/// webhook secret are never logged and never leave the server.
/// </summary>
public class RazorpayPaymentGateway : IPaymentGateway
{
    public const string GatewayName = PaymentSettings.Razorpay;
    public const string BaseUrl = "https://api.razorpay.com/v1/";
    /// <summary>Checkout accent colour: the website's primary "electric" blue (tailwind electric-600).</summary>
    public const string ThemeColor = "#2563EB";
    public const string DisplayName = "BroCo";
    /// <summary>Razorpay accepts at most 15 notes per order / refund and receipts of up to 40 characters.</summary>
    public const int MaxNotes = 15;
    public const int MaxReceiptLength = 40;
    private const int GetRetries = 2;
    private static readonly TimeSpan RetryDelay = TimeSpan.FromMilliseconds(300);

    private readonly HttpClient _http;
    private readonly IConfiguration _configuration;
    private readonly ILogger<RazorpayPaymentGateway> _logger;

    public string ProviderName => GatewayName;

    public RazorpayPaymentGateway(HttpClient http, IConfiguration configuration, ILogger<RazorpayPaymentGateway> logger)
    {
        _http = http;
        _configuration = configuration;
        _logger = logger;
        _http.BaseAddress ??= new Uri(BaseUrl);
    }

    // ---------------------------------------------------------------- orders

    public async Task<PaymentOrderResult> CreatePaymentOrderAsync(CreatePaymentOrderParams request, CancellationToken cancellationToken = default)
    {
        var keys = RequireKeys();
        var paise = ToPaise(request.Amount);
        if (paise <= 0)
            throw new InvalidOperationException("The payment amount must be at least ₹0.01.");

        var notes = new Dictionary<string, string> { ["payment_number"] = request.PaymentNumber };
        foreach (var (key, value) in request.Metadata ?? new Dictionary<string, string>())
        {
            if (notes.Count >= MaxNotes) break;
            if (!string.IsNullOrWhiteSpace(key) && !notes.ContainsKey(key)) notes[key] = value ?? string.Empty;
        }

        var body = new Dictionary<string, object>
        {
            ["amount"] = paise,
            ["currency"] = request.Currency,
            ["receipt"] = Truncate(request.PaymentNumber, MaxReceiptLength),
            ["notes"] = notes
        };

        var result = await SendAsync(HttpMethod.Post, "orders", body, keys, retry: false, cancellationToken);
        if (!result.IsSuccess)
        {
            _logger.LogError("Razorpay refused to create an order for payment {PaymentNumber}: {Error}", request.PaymentNumber, result.Error);
            throw new InvalidOperationException($"The payment provider could not start this payment: {result.Error}");
        }

        var orderId = result.Root.TryGetProperty("id", out var idElement) ? idElement.GetString() : null;
        if (string.IsNullOrWhiteSpace(orderId))
            throw new InvalidOperationException("The payment provider did not return an order id.");

        _logger.LogInformation("Razorpay order {OrderId} created for payment {PaymentNumber}: {Amount} {Currency}",
            orderId, request.PaymentNumber, request.Amount, request.Currency);

        var providerData = new Dictionary<string, string>
        {
            ["checkout"] = "razorpay",
            ["key_id"] = keys.KeyId,
            ["order_id"] = orderId,
            ["amount"] = paise.ToString(CultureInfo.InvariantCulture),
            ["currency"] = request.Currency,
            ["name"] = DisplayName,
            ["description"] = request.Description,
            ["theme_color"] = ThemeColor
        };
        if (!string.IsNullOrWhiteSpace(request.CustomerName)) providerData["prefill_name"] = request.CustomerName;
        if (!string.IsNullOrWhiteSpace(request.CustomerEmail)) providerData["prefill_email"] = request.CustomerEmail;
        if (!string.IsNullOrWhiteSpace(request.CustomerPhone)) providerData["prefill_contact"] = request.CustomerPhone;

        return new PaymentOrderResult(
            OrderId: orderId,
            Amount: request.Amount,
            Currency: request.Currency,
            GatewayProvider: GatewayName,
            CheckoutUrl: null, // Razorpay Checkout opens in the page; there is no redirect URL.
            ProviderData: providerData);
    }

    // ---------------------------------------------------------------- verify

    public async Task<PaymentVerificationResult> VerifyPaymentAsync(VerifyPaymentParams request, CancellationToken cancellationToken = default)
    {
        PaymentVerificationResult Fail(string message, decimal paid = 0m, string? currency = null, string? method = null) =>
            new(false, request.GatewayPaymentId ?? string.Empty, request.GatewayOrderId, paid, currency ?? request.ExpectedCurrency, method, message);

        var keys = RequireKeys();
        if (string.IsNullOrWhiteSpace(request.GatewayPaymentId) || string.IsNullOrWhiteSpace(request.GatewayOrderId))
            return Fail("The payment id and order id from Razorpay are required.");
        if (string.IsNullOrWhiteSpace(request.GatewaySignature))
            return Fail("The Razorpay checkout signature is missing.");

        var expected = ComputeSignature($"{request.GatewayOrderId}|{request.GatewayPaymentId}", keys.KeySecret);
        if (!SignaturesMatch(expected, request.GatewaySignature))
        {
            _logger.LogWarning("Razorpay signature mismatch for payment {PaymentId} / order {OrderId}", request.GatewayPaymentId, request.GatewayOrderId);
            return Fail("The payment signature is invalid.");
        }

        // The signature proves the browser's claim came from Razorpay; the payment itself is still read
        // from Razorpay so the status and amount cannot be tampered with on the client.
        var fetched = await SendAsync(HttpMethod.Get, $"payments/{Uri.EscapeDataString(request.GatewayPaymentId)}", null, keys, retry: true, cancellationToken);
        if (!fetched.IsSuccess)
            return Fail($"Razorpay could not confirm the payment: {fetched.Error}");

        var payment = ReadPayment(fetched.Root);
        if (!string.Equals(payment.OrderId, request.GatewayOrderId, StringComparison.Ordinal))
            return Fail("The payment belongs to a different order.");

        if (payment.Status == "authorized")
        {
            // Automatic capture is Razorpay's default; capture ourselves if the account is set to manual.
            var captured = await SendAsync(HttpMethod.Post, $"payments/{Uri.EscapeDataString(request.GatewayPaymentId)}/capture",
                new Dictionary<string, object> { ["amount"] = ToPaise(request.ExpectedAmount), ["currency"] = request.ExpectedCurrency },
                keys, retry: false, cancellationToken);
            if (!captured.IsSuccess)
                return Fail($"Razorpay could not capture the payment: {captured.Error}");
            payment = ReadPayment(captured.Root);
        }

        if (payment.Status != "captured")
        {
            var reason = payment.ErrorDescription ?? $"Razorpay reports the payment as '{payment.Status}'.";
            _logger.LogWarning("Razorpay payment {PaymentId} is {Status}: {Reason}", request.GatewayPaymentId, payment.Status, reason);
            return Fail(reason, payment.Amount, payment.Currency, payment.Method);
        }

        if (payment.AmountPaise != ToPaise(request.ExpectedAmount) ||
            !string.Equals(payment.Currency, request.ExpectedCurrency, StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Razorpay payment {PaymentId} is {Paid} {Currency}, expected {Expected} {ExpectedCurrency}",
                request.GatewayPaymentId, payment.Amount, payment.Currency, request.ExpectedAmount, request.ExpectedCurrency);
            return Fail($"The amount paid ({payment.Amount:0.00} {payment.Currency}) does not match the amount due ({request.ExpectedAmount:0.00} {request.ExpectedCurrency}).",
                payment.Amount, payment.Currency, payment.Method);
        }

        _logger.LogInformation("Razorpay payment {PaymentId} for order {OrderId} verified ({Method})", request.GatewayPaymentId, request.GatewayOrderId, payment.Method);
        return new PaymentVerificationResult(true, request.GatewayPaymentId, request.GatewayOrderId, payment.Amount, payment.Currency ?? request.ExpectedCurrency, payment.Method);
    }

    // ---------------------------------------------------------------- webhooks

    public Task<WebhookProcessResult> HandleWebhookAsync(string payload, string signature, string? webhookSecret = null, CancellationToken cancellationToken = default)
    {
        WebhookProcessResult Rejected(string message) => new(false, null, null, null, null, null, null, message);

        var secret = string.IsNullOrWhiteSpace(webhookSecret) ? PaymentSettings.RazorpayWebhookSecret(_configuration) : webhookSecret;
        if (string.IsNullOrWhiteSpace(secret))
        {
            _logger.LogWarning("Razorpay webhook received but Razorpay:WebhookSecret is not configured; ignoring it.");
            return Task.FromResult(Rejected("Razorpay webhook secret is not configured."));
        }
        if (string.IsNullOrWhiteSpace(signature) || !SignaturesMatch(ComputeSignature(payload, secret), signature))
        {
            _logger.LogWarning("Razorpay webhook rejected: invalid X-Razorpay-Signature.");
            return Task.FromResult(Rejected("Invalid webhook signature."));
        }

        try
        {
            using var doc = JsonDocument.Parse(payload);
            var root = doc.RootElement;
            var eventType = root.TryGetProperty("event", out var ev) ? ev.GetString() : null;
            var payloadElement = root.TryGetProperty("payload", out var p) ? p : default;
            var paymentEntity = Entity(payloadElement, "payment");
            var orderEntity = Entity(payloadElement, "order");
            var refundEntity = Entity(payloadElement, "refund");

            string? orderId = GetString(paymentEntity, "order_id") ?? GetString(orderEntity, "id");
            string? paymentId = GetString(paymentEntity, "id") ?? GetString(refundEntity, "payment_id");
            string? currency = GetString(paymentEntity, "currency") ?? GetString(orderEntity, "currency") ?? GetString(refundEntity, "currency");
            decimal? amount = GetPaise(paymentEntity, "amount") ?? GetPaise(orderEntity, "amount_paid") ?? GetPaise(refundEntity, "amount");

            // PaymentService marks the payment paid on "captured"/"paid", failed on "failed", and only
            // acknowledges anything else. A failed attempt does not close a Razorpay order (the customer
            // can retry in the same checkout), so it is reported as "attempt_failed" rather than "failed".
            var (status, error) = eventType switch
            {
                "payment.captured" => ("captured", null),
                "order.paid" => ("paid", null),
                "payment.failed" => ("attempt_failed", GetString(paymentEntity, "error_description") ?? "The payment attempt failed."),
                "refund.processed" => ("refunded", null),
                _ => ("ignored", null)
            };

            _logger.LogInformation("Razorpay webhook {Event} for order {OrderId} / payment {PaymentId} -> {Status}", eventType, orderId, paymentId, status);
            return Task.FromResult(new WebhookProcessResult(true, eventType, orderId, paymentId, amount, currency, status, error));
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "Razorpay webhook payload is not valid JSON.");
            return Task.FromResult(Rejected("Webhook payload is not valid JSON."));
        }
    }

    // ---------------------------------------------------------------- refunds

    public async Task<RefundPaymentResult> RefundPaymentAsync(RefundPaymentParams request, CancellationToken cancellationToken = default)
    {
        var keys = RequireKeys();
        if (string.IsNullOrWhiteSpace(request.GatewayPaymentId))
            return new RefundPaymentResult(false, null, 0m, "The payment has no Razorpay payment id to refund.");
        var paise = ToPaise(request.RefundAmount);
        if (paise <= 0)
            return new RefundPaymentResult(false, null, 0m, "The refund amount must be at least ₹0.01.");

        var body = new Dictionary<string, object>
        {
            ["amount"] = paise,
            ["notes"] = new Dictionary<string, string> { ["reason"] = Truncate(request.Reason, 512) }
        };
        // Razorpay treats the receipt as the idempotency key for refunds of the same payment.
        if (!string.IsNullOrWhiteSpace(request.IdempotencyKey))
            body["receipt"] = Truncate(request.IdempotencyKey, MaxReceiptLength);

        var result = await SendAsync(HttpMethod.Post, $"payments/{Uri.EscapeDataString(request.GatewayPaymentId)}/refund", body, keys, retry: false, cancellationToken);
        if (!result.IsSuccess)
        {
            _logger.LogError("Razorpay refund of {Amount} {Currency} for payment {PaymentId} failed: {Error}",
                request.RefundAmount, request.Currency, request.GatewayPaymentId, result.Error);
            return new RefundPaymentResult(false, null, 0m, result.Error);
        }

        var refundId = result.Root.TryGetProperty("id", out var id) ? id.GetString() : null;
        var refunded = GetPaise(result.Root, "amount") ?? request.RefundAmount;
        _logger.LogInformation("Razorpay refund {RefundId} of {Amount} {Currency} created for payment {PaymentId}", refundId, refunded, request.Currency, request.GatewayPaymentId);
        return new RefundPaymentResult(true, refundId, refunded);
    }

    // ---------------------------------------------------------------- helpers

    /// <summary>Rupees to integer paise, rounding half away from zero (₹12.345 -> 1235).</summary>
    public static long ToPaise(decimal amount) => (long)Math.Round(amount * 100m, 0, MidpointRounding.AwayFromZero);

    /// <summary>Lower-case hex HMAC-SHA256, the format Razorpay uses for checkout and webhook signatures.</summary>
    public static string ComputeSignature(string data, string secret)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        return Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(data))).ToLowerInvariant();
    }

    /// <summary>Constant-time comparison so a signature cannot be guessed byte by byte from timing.</summary>
    public static bool SignaturesMatch(string expected, string? actual)
    {
        if (string.IsNullOrWhiteSpace(actual)) return false;
        var a = Encoding.UTF8.GetBytes(expected.ToLowerInvariant());
        var b = Encoding.UTF8.GetBytes(actual.Trim().ToLowerInvariant());
        return a.Length == b.Length && CryptographicOperations.FixedTimeEquals(a, b);
    }

    /// <summary>Razorpay payment "method" -> the app's <see cref="PaymentMethod"/> name.</summary>
    public static string MapMethod(string? method) => method?.ToLowerInvariant() switch
    {
        "card" or "emi" => nameof(PaymentMethod.Card),
        "upi" => nameof(PaymentMethod.Upi),
        "netbanking" => nameof(PaymentMethod.NetBanking),
        "wallet" => nameof(PaymentMethod.Wallet),
        "bank_transfer" => nameof(PaymentMethod.BankTransfer),
        null or "" => nameof(PaymentMethod.Card),
        _ => method
    };

    private readonly record struct Keys(string KeyId, string KeySecret);

    private Keys RequireKeys()
    {
        var error = PaymentSettings.RazorpayConfigurationError(_configuration);
        var keyId = PaymentSettings.RazorpayKeyId(_configuration);
        var secret = PaymentSettings.RazorpayKeySecret(_configuration);
        if (error != null || string.IsNullOrEmpty(keyId) || string.IsNullOrEmpty(secret))
            throw new InvalidOperationException(error ?? "Razorpay:KeyId and Razorpay:KeySecret are required to use the Razorpay gateway.");
        return new Keys(keyId, secret);
    }

    private sealed record ApiResult(bool IsSuccess, HttpStatusCode Status, JsonElement Root, string? Error);

    private async Task<ApiResult> SendAsync(HttpMethod method, string path, object? body, Keys keys, bool retry, CancellationToken ct)
    {
        var attempts = retry && method == HttpMethod.Get ? GetRetries + 1 : 1;
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                using var request = new HttpRequestMessage(method, path);
                request.Headers.Authorization = new AuthenticationHeaderValue("Basic",
                    Convert.ToBase64String(Encoding.ASCII.GetBytes($"{keys.KeyId}:{keys.KeySecret}")));
                if (body != null) request.Content = JsonContent.Create(body);

                using var response = await _http.SendAsync(request, ct);
                var text = await response.Content.ReadAsStringAsync(ct);
                var isServerError = (int)response.StatusCode >= 500;
                if (isServerError && attempt < attempts)
                {
                    await Task.Delay(RetryDelay, ct);
                    continue;
                }

                JsonElement root = default;
                if (!string.IsNullOrWhiteSpace(text))
                {
                    try { root = JsonDocument.Parse(text).RootElement.Clone(); }
                    catch (JsonException) { /* not JSON: handled below */ }
                }

                if (response.IsSuccessStatusCode)
                    return new ApiResult(true, response.StatusCode, root, null);

                return new ApiResult(false, response.StatusCode, root, DescribeError(root, response.StatusCode));
            }
            catch (HttpRequestException ex) when (attempt < attempts)
            {
                _logger.LogWarning(ex, "Razorpay {Method} {Path} failed (attempt {Attempt}); retrying", method, path, attempt);
                await Task.Delay(RetryDelay, ct);
            }
            catch (TaskCanceledException ex) when (!ct.IsCancellationRequested && attempt < attempts)
            {
                _logger.LogWarning(ex, "Razorpay {Method} {Path} timed out (attempt {Attempt}); retrying", method, path, attempt);
            }
            catch (HttpRequestException ex)
            {
                _logger.LogError(ex, "Razorpay {Method} {Path} could not be reached", method, path);
                return new ApiResult(false, (HttpStatusCode)0, default, "Razorpay could not be reached. Please try again in a moment.");
            }
            catch (TaskCanceledException) when (!ct.IsCancellationRequested)
            {
                _logger.LogError("Razorpay {Method} {Path} timed out", method, path);
                return new ApiResult(false, HttpStatusCode.RequestTimeout, default, "Razorpay took too long to answer. Please try again in a moment.");
            }
        }
    }

    /// <summary>Razorpay errors look like {"error":{"code":"BAD_REQUEST_ERROR","description":"...","field":"amount"}}.</summary>
    public static string DescribeError(JsonElement root, HttpStatusCode status)
    {
        if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("error", out var error) && error.ValueKind == JsonValueKind.Object)
        {
            var description = GetString(error, "description");
            var code = GetString(error, "code");
            var field = GetString(error, "field");
            if (!string.IsNullOrWhiteSpace(description))
                return string.IsNullOrWhiteSpace(field) ? description : $"{description} ({field})";
            if (!string.IsNullOrWhiteSpace(code)) return code;
        }
        return status switch
        {
            HttpStatusCode.Unauthorized => "Razorpay rejected the API keys (check RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).",
            (HttpStatusCode)0 => "Razorpay could not be reached.",
            _ => $"Razorpay returned HTTP {(int)status}."
        };
    }

    private sealed record PaymentSnapshot(string? Status, string? OrderId, long AmountPaise, decimal Amount, string? Currency, string? Method, string? ErrorDescription);

    private static PaymentSnapshot ReadPayment(JsonElement root)
    {
        var paise = root.ValueKind == JsonValueKind.Object && root.TryGetProperty("amount", out var a) && a.TryGetInt64(out var l) ? l : 0L;
        return new PaymentSnapshot(
            GetString(root, "status"),
            GetString(root, "order_id"),
            paise,
            paise / 100m,
            GetString(root, "currency"),
            MapMethod(GetString(root, "method")),
            GetString(root, "error_description"));
    }

    private static JsonElement Entity(JsonElement payload, string name) =>
        payload.ValueKind == JsonValueKind.Object && payload.TryGetProperty(name, out var wrapper) &&
        wrapper.ValueKind == JsonValueKind.Object && wrapper.TryGetProperty("entity", out var entity) ? entity : default;

    private static string? GetString(JsonElement element, string name) =>
        element.ValueKind == JsonValueKind.Object && element.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

    private static decimal? GetPaise(JsonElement element, string name) =>
        element.ValueKind == JsonValueKind.Object && element.TryGetProperty(name, out var v) && v.TryGetInt64(out var l) ? l / 100m : null;

    private static string Truncate(string value, int max) => value.Length <= max ? value : value[..max];
}
