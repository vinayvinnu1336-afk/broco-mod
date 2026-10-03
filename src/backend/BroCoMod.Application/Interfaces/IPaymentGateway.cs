namespace BroCoMod.Application.Interfaces;

public record CreatePaymentOrderParams(
    string PaymentNumber,
    decimal Amount,
    string Currency,
    string CustomerEmail,
    string CustomerName,
    string Description,
    Dictionary<string, string>? Metadata = null
);

public record PaymentOrderResult(
    string OrderId,
    decimal Amount,
    string Currency,
    string GatewayProvider,
    string? CheckoutUrl = null,
    Dictionary<string, string>? ProviderData = null
);

public record VerifyPaymentParams(
    string GatewayOrderId,
    string GatewayPaymentId,
    string? GatewaySignature,
    decimal ExpectedAmount,
    string ExpectedCurrency
);

public record PaymentVerificationResult(
    bool IsSuccess,
    string GatewayPaymentId,
    string? GatewayOrderId,
    decimal PaidAmount,
    string Currency,
    string? PaymentMethod,
    string? ErrorMessage = null
);

public record WebhookProcessResult(
    bool IsHandled,
    string? EventType,
    string? GatewayOrderId,
    string? GatewayPaymentId,
    decimal? Amount,
    string? Currency,
    string? Status,
    string? ErrorMessage = null
);

public record RefundPaymentParams(
    string GatewayPaymentId,
    decimal RefundAmount,
    string Currency,
    string Reason,
    string? IdempotencyKey = null
);

public record RefundPaymentResult(
    bool IsSuccess,
    string? RefundId,
    decimal RefundedAmount,
    string? ErrorMessage = null
);

public interface IPaymentGateway
{
    string ProviderName { get; }
    Task<PaymentOrderResult> CreatePaymentOrderAsync(CreatePaymentOrderParams request, CancellationToken cancellationToken = default);
    Task<PaymentVerificationResult> VerifyPaymentAsync(VerifyPaymentParams request, CancellationToken cancellationToken = default);
    Task<WebhookProcessResult> HandleWebhookAsync(string payload, string signature, string? webhookSecret = null, CancellationToken cancellationToken = default);
    Task<RefundPaymentResult> RefundPaymentAsync(RefundPaymentParams request, CancellationToken cancellationToken = default);
}

public interface IPaymentGatewayFactory
{
    IPaymentGateway GetGateway(string? providerName = null);
}
