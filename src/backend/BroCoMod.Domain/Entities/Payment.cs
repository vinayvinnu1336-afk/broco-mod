using BroCoMod.Domain.Common;
using BroCoMod.Domain.Enums;

namespace BroCoMod.Domain.Entities;

/// <summary>
/// Server-authoritative record of a financial transaction.
/// Represents payments collected from customers via integrated payment gateways or test providers.
/// </summary>
public class Payment : BaseEntity
{
    public string PaymentNumber { get; private set; } = string.Empty;
    public Guid? CustomerQuotationId { get; private set; }
    public Guid? AdditionalWorkQuotationId { get; private set; }
    public Guid? ServiceJobId { get; private set; }
    public Guid CustomerId { get; private set; }
    public Guid GarageId { get; private set; }
    public decimal Amount { get; private set; }
    public string Currency { get; private set; } = "INR";
    public PaymentStatus Status { get; private set; } = PaymentStatus.Created;
    public PaymentPurpose Purpose { get; private set; } = PaymentPurpose.ServiceQuotation;
    public PaymentMethod PaymentMethod { get; private set; } = PaymentMethod.TestProvider;
    public string GatewayProvider { get; private set; } = "DevelopmentFake";
    public string? GatewayOrderId { get; private set; }
    public string? GatewayPaymentId { get; private set; }
    public string? GatewaySignature { get; private set; }
    public string? IdempotencyKey { get; private set; }
    public string? FailureReason { get; private set; }
    public decimal RefundedAmount { get; private set; } = 0.0m;
    public DateTime? PaidAtUtc { get; private set; }
    public Guid ConcurrencyToken { get; private set; } = Guid.NewGuid();

    // Navigation properties
    public CustomerQuotation? CustomerQuotation { get; private set; }
    public AdditionalWorkQuotation? AdditionalWorkQuotation { get; private set; }
    public ServiceJob? ServiceJob { get; private set; }
    public Garage? Garage { get; private set; }
    public Invoice? Invoice { get; private set; }
    public GarageSettlement? Settlement { get; private set; }
    public ICollection<FinancialLedgerEntry> LedgerEntries { get; private set; } = new List<FinancialLedgerEntry>();

    protected Payment() { }

    public Payment(
        string paymentNumber,
        Guid customerId,
        Guid garageId,
        decimal amount,
        string currency,
        PaymentPurpose purpose,
        string gatewayProvider,
        Guid? customerQuotationId = null,
        Guid? additionalWorkQuotationId = null,
        Guid? serviceJobId = null,
        string? idempotencyKey = null,
        PaymentMethod paymentMethod = PaymentMethod.TestProvider)
    {
        if (string.IsNullOrWhiteSpace(paymentNumber))
            throw new ArgumentException("PaymentNumber cannot be empty.", nameof(paymentNumber));
        if (customerId == Guid.Empty)
            throw new ArgumentException("CustomerId cannot be empty.", nameof(customerId));
        if (garageId == Guid.Empty)
            throw new ArgumentException("GarageId cannot be empty.", nameof(garageId));
        if (amount <= 0.0m)
            throw new ArgumentException("Amount must be greater than zero.", nameof(amount));

        PaymentNumber = paymentNumber.Trim().ToUpperInvariant();
        CustomerId = customerId;
        GarageId = garageId;
        Amount = amount;
        Currency = string.IsNullOrWhiteSpace(currency) ? "INR" : currency.Trim().ToUpperInvariant();
        Purpose = purpose;
        GatewayProvider = string.IsNullOrWhiteSpace(gatewayProvider) ? "DevelopmentFake" : gatewayProvider.Trim();
        CustomerQuotationId = customerQuotationId;
        AdditionalWorkQuotationId = additionalWorkQuotationId;
        ServiceJobId = serviceJobId;
        IdempotencyKey = idempotencyKey?.Trim();
        PaymentMethod = paymentMethod;
        Status = PaymentStatus.Created;
        RefundedAmount = 0.0m;
        ConcurrencyToken = Guid.NewGuid();
    }

    public void SetGatewayOrder(string gatewayOrderId, string? gatewayProvider = null)
    {
        if (string.IsNullOrWhiteSpace(gatewayOrderId))
            throw new ArgumentException("GatewayOrderId cannot be empty.", nameof(gatewayOrderId));

        GatewayOrderId = gatewayOrderId.Trim();
        if (!string.IsNullOrWhiteSpace(gatewayProvider))
        {
            GatewayProvider = gatewayProvider.Trim();
        }

        if (Status == PaymentStatus.Created)
        {
            Status = PaymentStatus.Pending;
        }
        ConcurrencyToken = Guid.NewGuid();
    }

    public void MarkProcessing()
    {
        if (Status != PaymentStatus.Created && Status != PaymentStatus.Pending)
            throw new InvalidOperationException($"Cannot transition payment from {Status} to Processing.");

        Status = PaymentStatus.Processing;
        ConcurrencyToken = Guid.NewGuid();
    }

    public void MarkPaid(string gatewayPaymentId, string? gatewaySignature, DateTime paidAtUtc, PaymentMethod? method = null)
    {
        if (Status == PaymentStatus.Paid)
            return; // Idempotent success

        if (Status != PaymentStatus.Created && Status != PaymentStatus.Pending && Status != PaymentStatus.Processing)
            throw new InvalidOperationException($"Cannot mark payment {PaymentNumber} as Paid from status {Status}.");

        if (string.IsNullOrWhiteSpace(gatewayPaymentId))
            throw new ArgumentException("GatewayPaymentId cannot be empty.", nameof(gatewayPaymentId));

        GatewayPaymentId = gatewayPaymentId.Trim();
        GatewaySignature = gatewaySignature?.Trim();
        PaidAtUtc = DateTime.SpecifyKind(paidAtUtc, DateTimeKind.Utc);
        Status = PaymentStatus.Paid;
        FailureReason = null;
        if (method.HasValue)
        {
            PaymentMethod = method.Value;
        }
        ConcurrencyToken = Guid.NewGuid();
    }

    public void MarkFailed(string failureReason)
    {
        if (Status == PaymentStatus.Paid)
            throw new InvalidOperationException("Cannot mark an already Paid payment as Failed.");

        Status = PaymentStatus.Failed;
        FailureReason = string.IsNullOrWhiteSpace(failureReason) ? "Payment processing failed" : failureReason.Trim();
        ConcurrencyToken = Guid.NewGuid();
    }

    public void MarkCancelled(string reason)
    {
        if (Status == PaymentStatus.Paid || Status == PaymentStatus.Refunded)
            throw new InvalidOperationException($"Cannot cancel payment in {Status} state.");

        Status = PaymentStatus.Cancelled;
        FailureReason = reason;
        ConcurrencyToken = Guid.NewGuid();
    }

    public void RecordRefund(decimal refundAmount, string reason)
    {
        if (Status != PaymentStatus.Paid && Status != PaymentStatus.PartiallyRefunded)
            throw new InvalidOperationException($"Cannot refund payment with status {Status}.");

        if (refundAmount <= 0.0m)
            throw new ArgumentException("Refund amount must be greater than zero.", nameof(refundAmount));

        if (RefundedAmount + refundAmount > Amount)
            throw new InvalidOperationException($"Total refunds ({RefundedAmount + refundAmount}) cannot exceed total payment amount ({Amount}).");

        RefundedAmount += refundAmount;
        Status = RefundedAmount == Amount ? PaymentStatus.Refunded : PaymentStatus.PartiallyRefunded;
        ConcurrencyToken = Guid.NewGuid();
    }
}
