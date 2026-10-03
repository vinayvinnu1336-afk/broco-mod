using BroCoMod.Domain.Common;
using BroCoMod.Domain.Enums;

namespace BroCoMod.Domain.Entities;

/// <summary>
/// Separate, independent quotation for advisor-approved additional work.
/// Preserves the absolute immutability of the original accepted CustomerQuotation.
/// </summary>
public class AdditionalWorkQuotation : BaseEntity
{
    public string QuotationNumber { get; private set; } = string.Empty;
    public Guid ServiceJobId { get; private set; }
    public Guid AdditionalWorkRequestId { get; private set; }
    public Guid CustomerId { get; private set; }
    public Guid GarageId { get; private set; }
    public decimal Subtotal { get; private set; }
    public decimal Tax { get; private set; }
    public decimal Total { get; private set; }
    public string Currency { get; private set; } = "INR";
    public CustomerQuotationStatus Status { get; private set; } = CustomerQuotationStatus.Sent;
    public string Description { get; private set; } = string.Empty;
    public DateTime? CustomerRespondedAtUtc { get; private set; }

    // Navigation properties
    public ServiceJob? ServiceJob { get; private set; }
    public AdditionalWorkRequest? AdditionalWorkRequest { get; private set; }
    public Payment? Payment { get; private set; }
    public Invoice? Invoice { get; private set; }

    protected AdditionalWorkQuotation() { }

    public AdditionalWorkQuotation(
        string quotationNumber,
        Guid serviceJobId,
        Guid additionalWorkRequestId,
        Guid customerId,
        Guid garageId,
        decimal subtotal,
        decimal tax,
        decimal total,
        string description,
        string currency = "INR")
    {
        if (string.IsNullOrWhiteSpace(quotationNumber))
            throw new ArgumentException("QuotationNumber cannot be empty.", nameof(quotationNumber));
        if (serviceJobId == Guid.Empty)
            throw new ArgumentException("ServiceJobId cannot be empty.", nameof(serviceJobId));
        if (additionalWorkRequestId == Guid.Empty)
            throw new ArgumentException("AdditionalWorkRequestId cannot be empty.", nameof(additionalWorkRequestId));
        if (customerId == Guid.Empty)
            throw new ArgumentException("CustomerId cannot be empty.", nameof(customerId));
        if (garageId == Guid.Empty)
            throw new ArgumentException("GarageId cannot be empty.", nameof(garageId));
        if (total <= 0.0m)
            throw new ArgumentException("Total must be greater than zero.", nameof(total));

        QuotationNumber = quotationNumber.Trim().ToUpperInvariant();
        ServiceJobId = serviceJobId;
        AdditionalWorkRequestId = additionalWorkRequestId;
        CustomerId = customerId;
        GarageId = garageId;
        Subtotal = Math.Max(0m, subtotal);
        Tax = Math.Max(0m, tax);
        Total = total;
        Description = description?.Trim() ?? string.Empty;
        Currency = string.IsNullOrWhiteSpace(currency) ? "INR" : currency.Trim().ToUpperInvariant();
        Status = CustomerQuotationStatus.Sent;
    }

    public void Accept()
    {
        if (Status != CustomerQuotationStatus.Sent && Status != CustomerQuotationStatus.ReadyToSend)
            throw new InvalidOperationException($"Cannot accept additional work quotation in state {Status}.");

        Status = CustomerQuotationStatus.Accepted;
        CustomerRespondedAtUtc = DateTime.UtcNow;
    }

    public void Reject()
    {
        if (Status != CustomerQuotationStatus.Sent && Status != CustomerQuotationStatus.ReadyToSend)
            throw new InvalidOperationException($"Cannot reject additional work quotation in state {Status}.");

        Status = CustomerQuotationStatus.Rejected;
        CustomerRespondedAtUtc = DateTime.UtcNow;
    }
}
