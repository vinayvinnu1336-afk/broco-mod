using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using BroCoMod.Application.Interfaces;
using BroCoMod.Infrastructure.Services.PaymentGateway;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace BroCoMod.UnitTests.FinancialTests;

/// <summary>
/// Razorpay gateway without the network: signatures, paise, webhook handling, error mapping and the
/// Orders / Payments / Refunds calls against a scripted HttpMessageHandler. Keys here are dummies.
/// </summary>
public class RazorpayPaymentGatewayTests
{
    private const string KeyId = "rzp_test_dummykey";
    private const string KeySecret = "dummysecret";
    private const string WebhookSecret = "dummywebhooksecret";

    private static IConfiguration Config(params (string Key, string? Value)[] values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values.Select(v => new KeyValuePair<string, string?>(v.Key, v.Value))).Build();

    private static IConfiguration RazorpayConfig() =>
        Config(("Payment:Provider", "Razorpay"), ("Razorpay:KeyId", KeyId), ("Razorpay:KeySecret", KeySecret), ("Razorpay:WebhookSecret", WebhookSecret));

    /// <summary>Answers each request from a queue (status, body) and records what was sent.</summary>
    private sealed class ScriptedHandler : HttpMessageHandler
    {
        private readonly Queue<(HttpStatusCode Status, string Body)> _answers = new();
        public List<(HttpRequestMessage Request, string? Body)> Sent { get; } = new();

        public ScriptedHandler Reply(HttpStatusCode status, string body)
        {
            _answers.Enqueue((status, body));
            return this;
        }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var body = request.Content == null ? null : await request.Content.ReadAsStringAsync(ct);
            Sent.Add((request, body));
            if (_answers.Count == 0) throw new InvalidOperationException($"Unexpected request {request.Method} {request.RequestUri}");
            var (status, answer) = _answers.Dequeue();
            return new HttpResponseMessage(status) { Content = new StringContent(answer, Encoding.UTF8, "application/json") };
        }
    }

    private static RazorpayPaymentGateway Gateway(ScriptedHandler handler, IConfiguration? config = null) =>
        new(new HttpClient(handler), config ?? RazorpayConfig(), NullLogger<RazorpayPaymentGateway>.Instance);

    private static string Hmac(string data, string secret)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        return Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(data))).ToLowerInvariant();
    }

    private static string PaymentJson(string id, string orderId, long amount, string status, string method = "upi", string currency = "INR") =>
        JsonSerializer.Serialize(new { id, entity = "payment", amount, currency, status, order_id = orderId, method });

    // ---------- pure helpers ----------

    [Theory]
    [InlineData("500", 50000)]
    [InlineData("499.99", 49999)]
    [InlineData("12.345", 1235)]
    [InlineData("0.004", 0)]
    [InlineData("0.005", 1)]
    [InlineData("1234567.89", 123456789)]
    public void ToPaise_RoundsToWholePaise(string rupees, long expectedPaise)
    {
        RazorpayPaymentGateway.ToPaise(decimal.Parse(rupees)).Should().Be(expectedPaise);
    }

    [Fact]
    public void ComputeSignature_MatchesAnIndependentHmacSha256_LowercaseHex()
    {
        var data = "order_abc123|pay_def456";
        var expected = Hmac(data, KeySecret);

        var actual = RazorpayPaymentGateway.ComputeSignature(data, KeySecret);

        actual.Should().Be(expected);
        actual.Should().HaveLength(64).And.MatchRegex("^[0-9a-f]+$");
        RazorpayPaymentGateway.ComputeSignature(data, "othersecret").Should().NotBe(expected);
    }

    [Fact]
    public void SignaturesMatch_IgnoresCase_AndRejectsWrongOrEmptyValues()
    {
        var sig = Hmac("a|b", KeySecret);
        RazorpayPaymentGateway.SignaturesMatch(sig, sig.ToUpperInvariant()).Should().BeTrue();
        RazorpayPaymentGateway.SignaturesMatch(sig, " " + sig + " ").Should().BeTrue();
        RazorpayPaymentGateway.SignaturesMatch(sig, sig[..^1] + (sig.EndsWith('0') ? "1" : "0")).Should().BeFalse();
        RazorpayPaymentGateway.SignaturesMatch(sig, sig + "00").Should().BeFalse();
        RazorpayPaymentGateway.SignaturesMatch(sig, "").Should().BeFalse();
        RazorpayPaymentGateway.SignaturesMatch(sig, null).Should().BeFalse();
    }

    [Theory]
    [InlineData("card", "Card")]
    [InlineData("emi", "Card")]
    [InlineData("upi", "Upi")]
    [InlineData("netbanking", "NetBanking")]
    [InlineData("wallet", "Wallet")]
    [InlineData("bank_transfer", "BankTransfer")]
    [InlineData(null, "Card")]
    [InlineData("paylater", "paylater")]
    public void MapMethod_UsesTheAppsPaymentMethodNames(string? razorpay, string expected)
    {
        RazorpayPaymentGateway.MapMethod(razorpay).Should().Be(expected);
    }

    [Fact]
    public void DescribeError_ReadsRazorpayErrorJson_AndFallsBackToStatus()
    {
        var withField = JsonDocument.Parse("""{"error":{"code":"BAD_REQUEST_ERROR","description":"amount must be at least INR 1.00","field":"amount"}}""").RootElement;
        RazorpayPaymentGateway.DescribeError(withField, HttpStatusCode.BadRequest).Should().Be("amount must be at least INR 1.00 (amount)");

        var codeOnly = JsonDocument.Parse("""{"error":{"code":"SERVER_ERROR"}}""").RootElement;
        RazorpayPaymentGateway.DescribeError(codeOnly, HttpStatusCode.InternalServerError).Should().Be("SERVER_ERROR");

        RazorpayPaymentGateway.DescribeError(default, HttpStatusCode.Unauthorized).Should().Contain("RAZORPAY_KEY_ID");
        RazorpayPaymentGateway.DescribeError(default, HttpStatusCode.BadGateway).Should().Be("Razorpay returned HTTP 502.");
    }

    [Fact]
    public void Settings_ReadNestedKeysOrFlatEnvNames_AndExplainMissingKeys()
    {
        PaymentSettings.Provider(Config()).Should().Be("DevelopmentFake");
        PaymentSettings.Provider(Config(("PAYMENT_PROVIDER", "razorpay"))).Should().Be("Razorpay");
        PaymentSettings.RazorpayKeyId(Config(("RAZORPAY_KEY_ID", " rzp_test_flat "))).Should().Be("rzp_test_flat");
        PaymentSettings.RazorpayKeyId(Config(("Razorpay:KeyId", "rzp_test_nested"), ("RAZORPAY_KEY_ID", "rzp_test_flat"))).Should().Be("rzp_test_nested");

        PaymentSettings.RazorpayConfigurationError(Config(("Payment:Provider", "DevelopmentFake"))).Should().BeNull();
        PaymentSettings.RazorpayConfigurationError(RazorpayConfig()).Should().BeNull();
        var error = PaymentSettings.RazorpayConfigurationError(Config(("Payment:Provider", "Razorpay"), ("Razorpay:KeyId", KeyId)));
        error.Should().Contain("RAZORPAY_KEY_SECRET").And.NotContain("RAZORPAY_KEY_ID (");
    }

    [Fact]
    public void Validator_FailsOnStartWhenRazorpayHasNoKeys_AndPassesOtherwise()
    {
        var bad = new RazorpayOptions();
        RazorpayOptions.Bind(bad, Config(("Payment:Provider", "Razorpay")));
        new RazorpayOptionsValidator().Validate(null, bad).Failed.Should().BeTrue();

        var good = new RazorpayOptions();
        RazorpayOptions.Bind(good, RazorpayConfig());
        new RazorpayOptionsValidator().Validate(null, good).Succeeded.Should().BeTrue();
        good.HasWebhookSecret.Should().BeTrue();
    }

    // ---------- orders ----------

    [Fact]
    public async Task CreateOrder_PostsPaiseReceiptAndNotes_WithBasicAuth_AndReturnsCheckoutData()
    {
        var handler = new ScriptedHandler().Reply(HttpStatusCode.OK, """{"id":"order_123","entity":"order","amount":50000,"currency":"INR","status":"created"}""");
        var gateway = Gateway(handler);
        var metadata = Enumerable.Range(1, 20).ToDictionary(i => $"k{i}", i => $"v{i}");

        var result = await gateway.CreatePaymentOrderAsync(new CreatePaymentOrderParams(
            "PAY-2026-000123", 500m, "INR", "asha@example.com", "Asha", "Booking advance for BRC-1", metadata, "+919876543210"));

        var (request, body) = handler.Sent.Single();
        request.Method.Should().Be(HttpMethod.Post);
        request.RequestUri!.ToString().Should().Be("https://api.razorpay.com/v1/orders");
        request.Headers.Authorization.Should().Be(new AuthenticationHeaderValue("Basic", Convert.ToBase64String(Encoding.ASCII.GetBytes($"{KeyId}:{KeySecret}"))));

        var sent = JsonDocument.Parse(body!).RootElement;
        sent.GetProperty("amount").GetInt64().Should().Be(50000);
        sent.GetProperty("currency").GetString().Should().Be("INR");
        sent.GetProperty("receipt").GetString().Should().Be("PAY-2026-000123");
        var notes = sent.GetProperty("notes");
        notes.EnumerateObject().Count().Should().Be(RazorpayPaymentGateway.MaxNotes);
        notes.GetProperty("payment_number").GetString().Should().Be("PAY-2026-000123");
        body.Should().NotContain(KeySecret);

        result.OrderId.Should().Be("order_123");
        result.GatewayProvider.Should().Be("Razorpay");
        result.CheckoutUrl.Should().BeNull();
        result.ProviderData.Should().NotBeNull();
        result.ProviderData!["checkout"].Should().Be("razorpay");
        result.ProviderData["key_id"].Should().Be(KeyId);
        result.ProviderData["order_id"].Should().Be("order_123");
        result.ProviderData["amount"].Should().Be("50000");
        result.ProviderData["currency"].Should().Be("INR");
        result.ProviderData["name"].Should().Be("BroCo");
        result.ProviderData["description"].Should().Be("Booking advance for BRC-1");
        result.ProviderData["prefill_name"].Should().Be("Asha");
        result.ProviderData["prefill_email"].Should().Be("asha@example.com");
        result.ProviderData["prefill_contact"].Should().Be("+919876543210");
        result.ProviderData["theme_color"].Should().Be("#2563EB");
        result.ProviderData.Values.Should().NotContain(KeySecret);
    }

    [Fact]
    public async Task CreateOrder_SurfacesRazorpaysErrorDescription()
    {
        var handler = new ScriptedHandler().Reply(HttpStatusCode.BadRequest,
            """{"error":{"code":"BAD_REQUEST_ERROR","description":"The amount must be atleast INR 1.00","field":"amount"}}""");

        var act = () => Gateway(handler).CreatePaymentOrderAsync(new CreatePaymentOrderParams("PAY-1", 0.5m, "INR", "a@b.c", "A", "x"));

        (await act.Should().ThrowAsync<InvalidOperationException>()).WithMessage("*The amount must be atleast INR 1.00*");
    }

    [Fact]
    public async Task CreateOrder_WithoutKeys_FailsWithTheSetupMessage()
    {
        var handler = new ScriptedHandler();
        var gateway = Gateway(handler, Config(("Payment:Provider", "Razorpay")));

        var act = () => gateway.CreatePaymentOrderAsync(new CreatePaymentOrderParams("PAY-1", 10m, "INR", "a@b.c", "A", "x"));

        (await act.Should().ThrowAsync<InvalidOperationException>()).WithMessage("*RAZORPAY_KEY_ID*");
        handler.Sent.Should().BeEmpty();
    }

    // ---------- verify ----------

    [Fact]
    public async Task Verify_WithValidSignatureAndCapturedPayment_Succeeds_AndMapsTheMethod()
    {
        var handler = new ScriptedHandler().Reply(HttpStatusCode.OK, PaymentJson("pay_1", "order_1", 50000, "captured", "upi"));
        var signature = Hmac("order_1|pay_1", KeySecret);

        var result = await Gateway(handler).VerifyPaymentAsync(new VerifyPaymentParams("order_1", "pay_1", signature, 500m, "INR"));

        result.IsSuccess.Should().BeTrue(result.ErrorMessage);
        result.PaidAmount.Should().Be(500m);
        result.Currency.Should().Be("INR");
        result.PaymentMethod.Should().Be("Upi");
        var (request, _) = handler.Sent.Single();
        request.Method.Should().Be(HttpMethod.Get);
        request.RequestUri!.ToString().Should().Be("https://api.razorpay.com/v1/payments/pay_1");
    }

    [Fact]
    public async Task Verify_WithWrongSignature_FailsWithoutCallingRazorpay()
    {
        var handler = new ScriptedHandler();

        var result = await Gateway(handler).VerifyPaymentAsync(new VerifyPaymentParams("order_1", "pay_1", Hmac("order_1|pay_1", "wrong"), 500m, "INR"));

        result.IsSuccess.Should().BeFalse();
        result.ErrorMessage.Should().Contain("signature");
        handler.Sent.Should().BeEmpty();

        var missing = await Gateway(handler).VerifyPaymentAsync(new VerifyPaymentParams("order_1", "pay_1", null, 500m, "INR"));
        missing.IsSuccess.Should().BeFalse();
    }

    [Fact]
    public async Task Verify_CapturesAnAuthorizedPayment()
    {
        var handler = new ScriptedHandler()
            .Reply(HttpStatusCode.OK, PaymentJson("pay_1", "order_1", 50000, "authorized", "card"))
            .Reply(HttpStatusCode.OK, PaymentJson("pay_1", "order_1", 50000, "captured", "card"));

        var result = await Gateway(handler).VerifyPaymentAsync(new VerifyPaymentParams("order_1", "pay_1", Hmac("order_1|pay_1", KeySecret), 500m, "INR"));

        result.IsSuccess.Should().BeTrue(result.ErrorMessage);
        result.PaymentMethod.Should().Be("Card");
        handler.Sent.Should().HaveCount(2);
        var (capture, body) = handler.Sent[1];
        capture.Method.Should().Be(HttpMethod.Post);
        capture.RequestUri!.ToString().Should().Be("https://api.razorpay.com/v1/payments/pay_1/capture");
        JsonDocument.Parse(body!).RootElement.GetProperty("amount").GetInt64().Should().Be(50000);
    }

    [Fact]
    public async Task Verify_RejectsAmountMismatch_OtherOrder_AndFailedPayments()
    {
        var sig = Hmac("order_1|pay_1", KeySecret);

        var short1 = await Gateway(new ScriptedHandler().Reply(HttpStatusCode.OK, PaymentJson("pay_1", "order_1", 49900, "captured")))
            .VerifyPaymentAsync(new VerifyPaymentParams("order_1", "pay_1", sig, 500m, "INR"));
        short1.IsSuccess.Should().BeFalse();
        short1.ErrorMessage.Should().Contain("does not match");

        var other = await Gateway(new ScriptedHandler().Reply(HttpStatusCode.OK, PaymentJson("pay_1", "order_other", 50000, "captured")))
            .VerifyPaymentAsync(new VerifyPaymentParams("order_1", "pay_1", sig, 500m, "INR"));
        other.IsSuccess.Should().BeFalse();
        other.ErrorMessage.Should().Contain("different order");

        var failedJson = """{"id":"pay_1","amount":50000,"currency":"INR","status":"failed","order_id":"order_1","method":"card","error_description":"Card declined by the bank"}""";
        var failed = await Gateway(new ScriptedHandler().Reply(HttpStatusCode.OK, failedJson))
            .VerifyPaymentAsync(new VerifyPaymentParams("order_1", "pay_1", sig, 500m, "INR"));
        failed.IsSuccess.Should().BeFalse();
        failed.ErrorMessage.Should().Be("Card declined by the bank");
    }

    [Fact]
    public async Task Verify_RetriesTheGetOnServerErrors()
    {
        var handler = new ScriptedHandler()
            .Reply(HttpStatusCode.BadGateway, "")
            .Reply(HttpStatusCode.OK, PaymentJson("pay_1", "order_1", 50000, "captured"));

        var result = await Gateway(handler).VerifyPaymentAsync(new VerifyPaymentParams("order_1", "pay_1", Hmac("order_1|pay_1", KeySecret), 500m, "INR"));

        result.IsSuccess.Should().BeTrue(result.ErrorMessage);
        handler.Sent.Should().HaveCount(2);
    }

    // ---------- webhooks ----------

    private static string WebhookJson(string eventName, object payload) => JsonSerializer.Serialize(new { @event = eventName, payload });

    [Fact]
    public async Task Webhook_PaymentCaptured_WithValidSignature_IsHandledAsCaptured()
    {
        var payload = WebhookJson("payment.captured", new { payment = new { entity = new { id = "pay_9", order_id = "order_9", amount = 59000, currency = "INR", status = "captured", method = "upi" } } });

        var result = await Gateway(new ScriptedHandler()).HandleWebhookAsync(payload, Hmac(payload, WebhookSecret));

        result.IsHandled.Should().BeTrue(result.ErrorMessage);
        result.EventType.Should().Be("payment.captured");
        result.Status.Should().Be("captured");
        result.GatewayOrderId.Should().Be("order_9");
        result.GatewayPaymentId.Should().Be("pay_9");
        result.Amount.Should().Be(590m);
        result.Currency.Should().Be("INR");
    }

    [Fact]
    public async Task Webhook_RejectsBadSignature_MissingSecret_AndBrokenJson()
    {
        var payload = WebhookJson("payment.captured", new { payment = new { entity = new { id = "pay_9", order_id = "order_9", amount = 100, currency = "INR" } } });

        var tampered = await Gateway(new ScriptedHandler()).HandleWebhookAsync(payload + " ", Hmac(payload, WebhookSecret));
        tampered.IsHandled.Should().BeFalse();
        tampered.ErrorMessage.Should().Contain("signature");

        var wrongSecret = await Gateway(new ScriptedHandler()).HandleWebhookAsync(payload, Hmac(payload, "not-the-secret"));
        wrongSecret.IsHandled.Should().BeFalse();

        var noSecret = await Gateway(new ScriptedHandler(), Config(("Payment:Provider", "Razorpay"), ("Razorpay:KeyId", KeyId), ("Razorpay:KeySecret", KeySecret)))
            .HandleWebhookAsync(payload, Hmac(payload, WebhookSecret));
        noSecret.IsHandled.Should().BeFalse();
        noSecret.ErrorMessage.Should().Contain("not configured");

        var broken = await Gateway(new ScriptedHandler()).HandleWebhookAsync("{not json", Hmac("{not json", WebhookSecret));
        broken.IsHandled.Should().BeFalse();
        broken.ErrorMessage.Should().Contain("JSON");

        // An explicit secret argument wins over configuration.
        var explicitSecret = await Gateway(new ScriptedHandler()).HandleWebhookAsync(payload, Hmac(payload, "override"), "override");
        explicitSecret.IsHandled.Should().BeTrue();
    }

    [Fact]
    public async Task Webhook_MapsOrderPaid_PaymentFailed_RefundProcessed_AndUnknownEvents()
    {
        var gateway = Gateway(new ScriptedHandler());

        var orderPaid = WebhookJson("order.paid", new
        {
            order = new { entity = new { id = "order_5", amount = 50000, amount_paid = 50000, currency = "INR", status = "paid" } },
            payment = new { entity = new { id = "pay_5", order_id = "order_5", amount = 50000, currency = "INR", status = "captured" } }
        });
        var paid = await gateway.HandleWebhookAsync(orderPaid, Hmac(orderPaid, WebhookSecret));
        paid.Status.Should().Be("paid");
        paid.GatewayOrderId.Should().Be("order_5");
        paid.GatewayPaymentId.Should().Be("pay_5");

        var failedJson = WebhookJson("payment.failed", new { payment = new { entity = new { id = "pay_6", order_id = "order_6", amount = 50000, currency = "INR", status = "failed", error_description = "Payment was unsuccessful due to a temporary issue" } } });
        var failed = await gateway.HandleWebhookAsync(failedJson, Hmac(failedJson, WebhookSecret));
        failed.IsHandled.Should().BeTrue();
        failed.Status.Should().Be("attempt_failed", "a failed attempt must not close the order: the customer can retry");
        failed.ErrorMessage.Should().Contain("temporary issue");
        failed.GatewayOrderId.Should().Be("order_6");

        var refundJson = WebhookJson("refund.processed", new { refund = new { entity = new { id = "rfnd_7", payment_id = "pay_7", amount = 25000, currency = "INR", status = "processed" } } });
        var refund = await gateway.HandleWebhookAsync(refundJson, Hmac(refundJson, WebhookSecret));
        refund.Status.Should().Be("refunded");
        refund.GatewayPaymentId.Should().Be("pay_7");
        refund.Amount.Should().Be(250m);

        var other = WebhookJson("payment.authorized", new { payment = new { entity = new { id = "pay_8", order_id = "order_8", amount = 1, currency = "INR" } } });
        var ignored = await gateway.HandleWebhookAsync(other, Hmac(other, WebhookSecret));
        ignored.IsHandled.Should().BeTrue();
        ignored.Status.Should().Be("ignored");
    }

    // ---------- refunds ----------

    [Fact]
    public async Task Refund_PostsPaiseReasonAndReceipt_AndReturnsTheRefundId()
    {
        var handler = new ScriptedHandler().Reply(HttpStatusCode.OK, """{"id":"rfnd_1","entity":"refund","amount":25000,"currency":"INR","payment_id":"pay_1","status":"processed"}""");

        var result = await Gateway(handler).RefundPaymentAsync(new RefundPaymentParams("pay_1", 250m, "INR", "Booking cancelled", "PAY-1-refund-1"));

        result.IsSuccess.Should().BeTrue(result.ErrorMessage);
        result.RefundId.Should().Be("rfnd_1");
        result.RefundedAmount.Should().Be(250m);
        var (request, body) = handler.Sent.Single();
        request.RequestUri!.ToString().Should().Be("https://api.razorpay.com/v1/payments/pay_1/refund");
        var sent = JsonDocument.Parse(body!).RootElement;
        sent.GetProperty("amount").GetInt64().Should().Be(25000);
        sent.GetProperty("notes").GetProperty("reason").GetString().Should().Be("Booking cancelled");
        sent.GetProperty("receipt").GetString().Should().Be("PAY-1-refund-1");
    }

    [Fact]
    public async Task Refund_MapsRazorpayErrors_AndNeverRetriesAPost()
    {
        var handler = new ScriptedHandler().Reply(HttpStatusCode.BadRequest, """{"error":{"code":"BAD_REQUEST_ERROR","description":"The refund amount provided is greater than amount captured"}}""");

        var result = await Gateway(handler).RefundPaymentAsync(new RefundPaymentParams("pay_1", 9999m, "INR", "too much"));

        result.IsSuccess.Should().BeFalse();
        result.ErrorMessage.Should().Be("The refund amount provided is greater than amount captured");
        handler.Sent.Should().HaveCount(1);

        var outage = await Gateway(new ScriptedHandler().Reply(HttpStatusCode.ServiceUnavailable, "")).RefundPaymentAsync(new RefundPaymentParams("pay_1", 1m, "INR", "x"));
        outage.IsSuccess.Should().BeFalse();
        outage.ErrorMessage.Should().Be("Razorpay returned HTTP 503.");

        var noId = await Gateway(new ScriptedHandler()).RefundPaymentAsync(new RefundPaymentParams("", 1m, "INR", "x"));
        noId.IsSuccess.Should().BeFalse();
    }

    // ---------- factory ----------

    [Fact]
    public void Factory_UsesTheConfiguredProviderForNewPayments_AndTheStoredOneForOldRows()
    {
        var services = new ServiceCollection();
        var config = RazorpayConfig();
        services.AddSingleton(config);
        services.AddSingleton<IPaymentGateway>(new StubGateway("DevelopmentFake"));
        services.AddSingleton<IPaymentGateway>(new StubGateway("Razorpay"));
        var provider = services.BuildServiceProvider();
        var factory = new PaymentGatewayFactory(provider, config);

        factory.GetGateway().ProviderName.Should().Be("Razorpay");
        factory.GetGateway("default").ProviderName.Should().Be("Razorpay");
        factory.GetGateway("DevelopmentFake").ProviderName.Should().Be("DevelopmentFake");
        factory.GetGateway("razorpay").ProviderName.Should().Be("Razorpay");
        new PaymentGatewayFactory(provider, Config()).GetGateway().ProviderName.Should().Be("DevelopmentFake");

        var act = () => factory.GetGateway("Stripe");
        act.Should().Throw<InvalidOperationException>().WithMessage("*Stripe*");
    }

    private sealed class StubGateway : IPaymentGateway
    {
        public StubGateway(string name) => ProviderName = name;
        public string ProviderName { get; }
        public Task<PaymentOrderResult> CreatePaymentOrderAsync(CreatePaymentOrderParams request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<PaymentVerificationResult> VerifyPaymentAsync(VerifyPaymentParams request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<WebhookProcessResult> HandleWebhookAsync(string payload, string signature, string? webhookSecret = null, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<RefundPaymentResult> RefundPaymentAsync(RefundPaymentParams request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }
}
