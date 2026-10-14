using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using BroCoMod.Application.DTOs;
using BroCoMod.Infrastructure.Services.PaymentGateway;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace BroCoMod.IntegrationTests;

/// <summary>
/// The Razorpay webhook route and startup checks, on a host configured with dummy test values
/// (nothing here is a real key, and no request ever leaves the test server).
/// </summary>
public class PaymentWebhookIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private const string DummyKeyId = "rzp_test_dummy";
    private const string DummySecret = "dummysecret";
    private const string DummyWebhookSecret = "dummywebhooksecret";
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };
    private readonly WebApplicationFactory<Program> _factory;

    public PaymentWebhookIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    private WebApplicationFactory<Program> RazorpayHost(bool withKeys = true) => _factory.WithWebHostBuilder(b =>
    {
        b.UseSetting("Payment:Provider", "Razorpay");
        b.UseSetting("Razorpay:KeyId", withKeys ? DummyKeyId : "");
        b.UseSetting("Razorpay:KeySecret", withKeys ? DummySecret : "");
        b.UseSetting("Razorpay:WebhookSecret", withKeys ? DummyWebhookSecret : "");
    });

    private static HttpRequestMessage Webhook(string payload, string signature) =>
        new(HttpMethod.Post, "/api/v1/payments/webhook/razorpay")
        {
            Content = new StringContent(payload, Encoding.UTF8, "application/json"),
            Headers = { { "X-Razorpay-Signature", signature } }
        };

    private static string CapturedPayload(string orderId) => JsonSerializer.Serialize(new
    {
        @event = "payment.captured",
        payload = new { payment = new { entity = new { id = $"pay_{Guid.NewGuid():N}", order_id = orderId, amount = 50000, currency = "INR", status = "captured", method = "upi" } } }
    });

    [Fact]
    public async Task RazorpayWebhook_WithBadSignature_IsRejectedWith400()
    {
        using var host = RazorpayHost();
        var client = host.CreateClient();
        var payload = CapturedPayload("order_unknown");

        var wrongSecret = await client.SendAsync(Webhook(payload, RazorpayPaymentGateway.ComputeSignature(payload, "not-the-webhook-secret")));
        wrongSecret.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var noSignature = await client.SendAsync(new HttpRequestMessage(HttpMethod.Post, "/api/v1/payments/webhook/razorpay")
        {
            Content = new StringContent(payload, Encoding.UTF8, "application/json")
        });
        noSignature.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // The route is anonymous: a bad signature must never surface as 401/403 or as a server error.
        var tampered = await client.SendAsync(Webhook(payload + " ", RazorpayPaymentGateway.ComputeSignature(payload, DummyWebhookSecret)));
        tampered.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task RazorpayWebhook_WithValidSignatureForAnUnknownOrder_IsRejected_NotCrashed()
    {
        using var host = RazorpayHost();
        var payload = CapturedPayload($"order_{Guid.NewGuid():N}");

        var res = await host.CreateClient().SendAsync(Webhook(payload, RazorpayPaymentGateway.ComputeSignature(payload, DummyWebhookSecret)));

        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task RazorpayWebhook_WithoutAWebhookSecret_RejectsEverything()
    {
        using var host = _factory.WithWebHostBuilder(b =>
        {
            b.UseSetting("Payment:Provider", "Razorpay");
            b.UseSetting("Razorpay:KeyId", DummyKeyId);
            b.UseSetting("Razorpay:KeySecret", DummySecret);
            b.UseSetting("Razorpay:WebhookSecret", "");
        });
        var payload = CapturedPayload("order_x");

        var res = await host.CreateClient().SendAsync(Webhook(payload, RazorpayPaymentGateway.ComputeSignature(payload, "")));

        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task PublicConfig_OnARazorpayHost_ReportsTheProviderAndKeyId_NeverTheSecrets()
    {
        using var host = RazorpayHost();
        var client = host.CreateClient();

        var raw = await client.GetStringAsync("/api/v1/config/public");
        var body = JsonSerializer.Deserialize<ApiResponse<PublicConfigDto>>(raw, JsonOptions);

        body!.Data!.PaymentProvider.Should().Be("Razorpay");
        body.Data.RazorpayKeyId.Should().Be(DummyKeyId);
        raw.Should().NotContain(DummySecret).And.NotContain(DummyWebhookSecret);
    }

    [Fact]
    public void RazorpayProvider_WithoutKeys_RefusesToStart()
    {
        using var host = RazorpayHost(withKeys: false);

        var act = () => host.CreateClient();

        act.Should().Throw<Exception>().WithMessage("*RAZORPAY_KEY_ID*");
    }

    [Fact]
    public async Task DevelopmentFakeWebhookRoute_StillWorks_WhenRazorpayIsTheDefault()
    {
        // Older payments keep their provider; the fake route must keep answering on a Razorpay host.
        using var host = RazorpayHost();
        var payload = JsonSerializer.Serialize(new { @event = "payment.captured", payload = new { payment = new { entity = new { id = "pay_old", order_id = "ord_fake_missing", amount = 1, currency = "INR", status = "captured" } } } });
        var req = new HttpRequestMessage(HttpMethod.Post, "/api/v1/payments/webhook/DevelopmentFake")
        {
            Content = new StringContent(payload, Encoding.UTF8, "application/json"),
            Headers = { { "X-Razorpay-Signature", DevelopmentFakePaymentGateway.ComputeHmacSha256(payload, "brocomod_test_webhook_secret") } }
        };

        var res = await host.CreateClient().SendAsync(req);

        // Signature accepted by the fake gateway; the order does not exist, so it is a 400, not a 500.
        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await res.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("message").GetString().Should().Contain("unhandled");
    }
}
