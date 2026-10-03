using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BroCoMod.Api.Controllers.v1;

[ApiController]
[Route("api/v1/payments/webhook")]
[AllowAnonymous]
public class PaymentWebhookController : ControllerBase
{
    private readonly IPaymentService _paymentService;
    private readonly ILogger<PaymentWebhookController> _logger;

    public PaymentWebhookController(
        IPaymentService paymentService,
        ILogger<PaymentWebhookController> logger)
    {
        _paymentService = paymentService;
        _logger = logger;
    }

    [HttpPost("{provider}")]
    public async Task<IActionResult> HandleWebhook(
        string provider,
        CancellationToken cancellationToken)
    {
        // 1. Read raw body
        using var reader = new StreamReader(Request.Body);
        var payload = await reader.ReadToEndAsync(cancellationToken);

        if (string.IsNullOrWhiteSpace(payload))
        {
            return BadRequest(new { success = false, message = "Empty webhook payload" });
        }

        // 2. Extract signature from provider headers
        string signature = string.Empty;
        if (Request.Headers.TryGetValue("X-Razorpay-Signature", out var rzpSig))
        {
            signature = rzpSig.ToString();
        }
        else if (Request.Headers.TryGetValue("X-Signature", out var customSig))
        {
            signature = customSig.ToString();
        }
        else if (Request.Headers.TryGetValue("Stripe-Signature", out var stripeSig))
        {
            signature = stripeSig.ToString();
        }
        else if (Request.Headers.TryGetValue("Signature", out var genericSig))
        {
            signature = genericSig.ToString();
        }

        _logger.LogInformation("Received webhook from provider {Provider} with payload length {Length}",
            provider, payload.Length);

        // 3. Process webhook with signature verification and idempotency
        var handled = await _paymentService.ProcessWebhookAsync(provider, payload, signature, cancellationToken);

        if (!handled)
        {
            _logger.LogWarning("Webhook from provider {Provider} could not be validated or processed.", provider);
            return BadRequest(new { success = false, message = "Invalid webhook signature or unhandled event" });
        }

        return Ok(new { success = true });
    }
}
