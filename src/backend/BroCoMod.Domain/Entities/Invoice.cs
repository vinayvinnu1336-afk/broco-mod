using BroCoMod.Domain.Common;
using BroCoMod.Domain.Enums;

namespace BroCoMod.Domain.Entities;

/// <summary>
/// Immutable, server-authoritative tax invoice generated for successful customer payments.
/// Invoices represent finalized legal accounting documents. Changes require credit notes or voiding.
/// </summary>
public class Invoice : BaseEntity
{
    public string InvoiceNumber { get; private set; } = string.Empty;
    public Guid PaymentId { get; private set; }
    public Guid? CustomerQuotationId { get; private set; }
    public Guid? AdditionalWorkQuotationId { get; private set; }
    public Guid? ServiceJobId { get; private set; }
    public Guid CustomerId { get; private set; }
    public Guid GarageId { get; private set; }
    public InvoiceStatus Status { get; private set; } = InvoiceStatus.Draft;
    public decimal Subtotal { get; private set; }
    public decimal DiscountAmount { get; private set; }
    public decimal TaxAmount { get; private set; }
    public decimal TotalAmount { get; private set; }
    public string Currency { get; private set; } = "INR";
    public string BillingName { get; private set; } = string.Empty;
    public string BillingEmail { get; private set; } = string.Empty;
    public string? BillingAddress { get; private set; }
    public string LineItemsJson { get; private set; } = "[]";
    public DateTime IssuedAtUtc { get; private set; } = DateTime.UtcNow;
    public DateTime? PaidAtUtc { get; private set; }
    public DateTime? VoidedAtUtc { get; private set; }
    public string? VoidReason { get; private set; }

    // Navigation properties
    public Payment? Payment { get; private set; }
    public CustomerQuotation? CustomerQuotation { get; private set; }
    public AdditionalWorkQuotation? AdditionalWorkQuotation { get; private set; }
    public ServiceJob? ServiceJob { get; private set; }
    public Garage? Garage { get; private set; }

    protected Invoice() { }

    public Invoice(
        string invoiceNumber,
        Guid paymentId,
        Guid customerId,
        Guid garageId,
        decimal subtotal,
        decimal discountAmount,
        decimal taxAmount,
        decimal totalAmount,
        string billingName,
        string billingEmail,
        string? billingAddress,
        string lineItemsJson,
        string currency = "INR",
        Guid? customerQuotationId = null,
        Guid? additionalWorkQuotationId = null,
        Guid? serviceJobId = null)
    {
        if (string.IsNullOrWhiteSpace(invoiceNumber))
            throw new ArgumentException("InvoiceNumber cannot be empty.", nameof(invoiceNumber));
        if (paymentId == Guid.Empty)
            throw new ArgumentException("PaymentId cannot be empty.", nameof(paymentId));
        if (customerId == Guid.Empty)
            throw new ArgumentException("CustomerId cannot be empty.", nameof(customerId));
        if (garageId == Guid.Empty)
            throw new ArgumentException("GarageId cannot be empty.", nameof(garageId));
        if (string.IsNullOrWhiteSpace(billingName))
            throw new ArgumentException("BillingName cannot be empty.", nameof(billingName));
        if (string.IsNullOrWhiteSpace(billingEmail))
            throw new ArgumentException("BillingEmail cannot be empty.", nameof(billingEmail));

        InvoiceNumber = invoiceNumber.Trim().ToUpperInvariant();
        PaymentId = paymentId;
        CustomerId = customerId;
        GarageId = garageId;
        Subtotal = Math.Max(0m, subtotal);
        DiscountAmount = Math.Max(0m, discountAmount);
        TaxAmount = Math.Max(0m, taxAmount);
        TotalAmount = Math.Max(0m, totalAmount);
        BillingName = billingName.Trim();
        BillingEmail = billingEmail.Trim();
        BillingAddress = billingAddress?.Trim();
        LineItemsJson = string.IsNullOrWhiteSpace(lineItemsJson) ? "[]" : lineItemsJson.Trim();
        Currency = string.IsNullOrWhiteSpace(currency) ? "INR" : currency.Trim().ToUpperInvariant();
        CustomerQuotationId = customerQuotationId;
        AdditionalWorkQuotationId = additionalWorkQuotationId;
        ServiceJobId = serviceJobId;
        Status = InvoiceStatus.Issued;
        IssuedAtUtc = DateTime.UtcNow;
    }

    public void MarkPaid(DateTime paidAtUtc)
    {
        if (Status == InvoiceStatus.Void)
            throw new InvalidOperationException("Cannot mark a voided invoice as Paid.");

        Status = InvoiceStatus.Paid;
        PaidAtUtc = DateTime.SpecifyKind(paidAtUtc, DateTimeKind.Utc);
    }

    public void MarkVoid(string reason)
    {
        if (Status == InvoiceStatus.Void)
            return;

        Status = InvoiceStatus.Void;
        VoidedAtUtc = DateTime.UtcNow;
        VoidReason = string.IsNullOrWhiteSpace(reason) ? "Voided by administrator" : reason.Trim();
    }

    public void MarkRefunded()
    {
        Status = InvoiceStatus.Refunded;
    }
}
