using BroCoMod.Domain.Common;
using BroCoMod.Domain.Enums;

namespace BroCoMod.Domain.Entities;

/// <summary>
/// Sanitized, customer-facing commercial quotation curated by a Technical Advisor.
/// Contains strictly customer-visible line items, pricing, discounts, and taxes.
/// CRITICAL: Internal garage wholesale prices, cost breakdowns, and advisor notes are strictly omitted.
/// </summary>
public class CustomerQuotation : BaseEntity
{
    public Guid ServiceRequestId { get; private set; }
    public Guid? GarageAssignmentId { get; private set; }
    public Guid AssignedGarageId { get; private set; }
    public string QuotationNumber { get; private set; } = string.Empty;
    public string Currency { get; private set; } = "INR";
    public decimal CustomerSubtotal { get; private set; } = 0.0m;
    public decimal CustomerDiscount { get; private set; } = 0.0m;
    public decimal CustomerTax { get; private set; } = 0.0m;
    public decimal CustomerTotal { get; private set; } = 0.0m;
    public decimal CustomerFacingPrice { get; private set; } = 0.0m;
    public decimal AdvisorMarginApplied { get; private set; } = 0.0m;
    public DateTime ValidUntilUtc { get; private set; } = DateTime.UtcNow.AddDays(7);
    public CustomerQuotationStatus Status { get; private set; } = CustomerQuotationStatus.Draft;
    public Guid AdvisorId { get; private set; }
    public int VersionNumber { get; private set; } = 1;
    public string ScopeSummary { get; private set; } = string.Empty;
    public string AdvisorNotes { get; private set; } = string.Empty;
    public string? AdvisorRemarks { get; private set; }
    public DateTime? SentAtUtc { get; private set; }
    public DateTime? AcceptedAtUtc { get; private set; }
    public DateTime? RejectedAtUtc { get; private set; }
    public DateTime? CancelledAtUtc { get; private set; }
    public DateTime? CustomerRespondedAtUtc { get; private set; }

    // Navigation properties
    public ServiceRequest? ServiceRequest { get; private set; }
    public GarageAssignment? GarageAssignment { get; private set; }
    public ICollection<CustomerQuotationLineItem> LineItems { get; private set; } = new List<CustomerQuotationLineItem>();
    public ICollection<CustomerQuotationVersion> Versions { get; private set; } = new List<CustomerQuotationVersion>();

    protected CustomerQuotation() { }

    // Milestone 6 Primary Constructor
    public CustomerQuotation(
        Guid serviceRequestId,
        Guid? garageAssignmentId,
        Guid assignedGarageId,
        Guid advisorId,
        string quotationNumber,
        string scopeSummary,
        string? advisorRemarks,
        DateTime validUntilUtc,
        decimal customerDiscount = 0.0m,
        string currency = "INR")
    {
        if (serviceRequestId == Guid.Empty)
            throw new ArgumentException("ServiceRequestId cannot be empty.", nameof(serviceRequestId));
        if (assignedGarageId == Guid.Empty)
            throw new ArgumentException("AssignedGarageId cannot be empty.", nameof(assignedGarageId));
        if (advisorId == Guid.Empty)
            throw new ArgumentException("AdvisorId cannot be empty.", nameof(advisorId));
        if (string.IsNullOrWhiteSpace(quotationNumber))
            throw new ArgumentException("QuotationNumber cannot be empty.", nameof(quotationNumber));
        if (validUntilUtc <= DateTime.UtcNow)
            throw new ArgumentException("ValidUntilUtc must be in the future.", nameof(validUntilUtc));

        ServiceRequestId = serviceRequestId;
        GarageAssignmentId = garageAssignmentId;
        AssignedGarageId = assignedGarageId;
        AdvisorId = advisorId;
        QuotationNumber = quotationNumber.Trim().ToUpperInvariant();
        ScopeSummary = scopeSummary?.Trim() ?? string.Empty;
        AdvisorRemarks = advisorRemarks?.Trim();
        AdvisorNotes = advisorRemarks?.Trim() ?? string.Empty;
        ValidUntilUtc = DateTime.SpecifyKind(validUntilUtc, DateTimeKind.Utc);
        CustomerDiscount = Math.Max(0m, customerDiscount);
        Currency = string.IsNullOrWhiteSpace(currency) ? "INR" : currency.Trim().ToUpperInvariant();
        Status = CustomerQuotationStatus.Draft;
        VersionNumber = 1;
    }

    // Milestone 1 Legacy Compatibility Constructor
    public CustomerQuotation(
        Guid serviceRequestId,
        Guid assignedGarageId,
        decimal customerFacingPrice,
        decimal advisorMarginApplied,
        string scopeSummary,
        string advisorNotes)
    {
        if (customerFacingPrice <= 0)
            throw new ArgumentException("Customer price must be greater than zero.", nameof(customerFacingPrice));

        ServiceRequestId = serviceRequestId;
        AssignedGarageId = assignedGarageId;
        CustomerFacingPrice = customerFacingPrice;
        CustomerTotal = customerFacingPrice;
        CustomerSubtotal = customerFacingPrice;
        AdvisorMarginApplied = advisorMarginApplied;
        ScopeSummary = scopeSummary ?? string.Empty;
        AdvisorNotes = advisorNotes ?? string.Empty;
        AdvisorRemarks = advisorNotes;
        QuotationNumber = $"CQ-{Math.Abs(Guid.NewGuid().GetHashCode()) % 900000 + 100000}";
        ValidUntilUtc = DateTime.UtcNow.AddDays(7);
        Status = CustomerQuotationStatus.Sent; // Legacy default
    }

    public void UpdateDraft(
        string scopeSummary,
        string? advisorRemarks,
        DateTime validUntilUtc,
        decimal customerDiscount,
        Guid advisorId)
    {
        if (Status != CustomerQuotationStatus.Draft)
            throw new InvalidOperationException($"Cannot update customer quotation in '{Status}' state. Allowed only when 'Draft'.");

        if (validUntilUtc <= DateTime.UtcNow)
            throw new ArgumentException("ValidUntilUtc must be in the future.", nameof(validUntilUtc));

        ScopeSummary = scopeSummary?.Trim() ?? string.Empty;
        AdvisorRemarks = advisorRemarks?.Trim();
        AdvisorNotes = advisorRemarks?.Trim() ?? string.Empty;
        ValidUntilUtc = DateTime.SpecifyKind(validUntilUtc, DateTimeKind.Utc);
        CustomerDiscount = Math.Max(0m, customerDiscount);
        AdvisorId = advisorId;
        UpdatedAtUtc = DateTime.UtcNow;

        RecalculateTotals();
    }

    public void RecalculateTotals()
    {
        decimal subtotal = 0.0m;
        decimal tax = 0.0m;

        foreach (var item in LineItems)
        {
            item.RecalculateLineTotal();
            subtotal += item.LineTotal;
            if (item.TaxRate > 0)
            {
                var itemTax = (item.LineTotal * item.TaxRate) / 100m;
                tax += itemTax;
            }
        }

        CustomerSubtotal = decimal.Round(subtotal, 2, MidpointRounding.AwayFromZero);
        var taxableAfterDiscount = Math.Max(0m, CustomerSubtotal - CustomerDiscount);
        
        // If tax was calculated per line item, scale tax if overall discount applied
        if (CustomerSubtotal > 0 && CustomerDiscount > 0)
        {
            var discountRatio = taxableAfterDiscount / CustomerSubtotal;
            tax *= discountRatio;
        }

        CustomerTax = decimal.Round(tax, 2, MidpointRounding.AwayFromZero);
        CustomerTotal = decimal.Round(taxableAfterDiscount + CustomerTax, 2, MidpointRounding.AwayFromZero);
        CustomerFacingPrice = CustomerTotal;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void MarkReadyToSend(Guid advisorId)
    {
        if (Status != CustomerQuotationStatus.Draft)
            throw new InvalidOperationException($"Cannot mark customer quotation ready to send in '{Status}' state. Allowed only from 'Draft'.");

        if (LineItems.Count == 0)
            throw new InvalidOperationException("Cannot mark customer quotation ready without at least one line item.");

        if (ValidUntilUtc <= DateTime.UtcNow)
            throw new InvalidOperationException("Cannot mark customer quotation ready because ValidUntil has expired.");

        RecalculateTotals();
        Status = CustomerQuotationStatus.ReadyToSend;
        AdvisorId = advisorId;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Send(Guid advisorId)
    {
        if (Status != CustomerQuotationStatus.ReadyToSend && Status != CustomerQuotationStatus.Draft)
            throw new InvalidOperationException($"Cannot send customer quotation in '{Status}' state. Allowed only from 'ReadyToSend' or 'Draft'.");

        if (LineItems.Count == 0)
            throw new InvalidOperationException("Cannot send customer quotation without at least one line item.");

        if (ValidUntilUtc <= DateTime.UtcNow)
            throw new InvalidOperationException("Cannot send expired customer quotation.");

        RecalculateTotals();
        Status = CustomerQuotationStatus.Sent;
        SentAtUtc = DateTime.UtcNow;
        AdvisorId = advisorId;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void CreateRevision(Guid advisorId)
    {
        if (Status != CustomerQuotationStatus.Sent && Status != CustomerQuotationStatus.ReadyToSend)
            throw new InvalidOperationException($"Cannot create revision from customer quotation in '{Status}' state. Allowed only from 'Sent' or 'ReadyToSend'.");

        Status = CustomerQuotationStatus.Draft;
        VersionNumber++;
        AdvisorId = advisorId;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Expire()
    {
        if (Status == CustomerQuotationStatus.Accepted || Status == CustomerQuotationStatus.Cancelled)
            return;

        Status = CustomerQuotationStatus.Expired;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Cancel(string reason, Guid advisorId)
    {
        if (Status == CustomerQuotationStatus.Accepted)
            throw new InvalidOperationException("Cannot cancel an already accepted customer quotation.");

        Status = CustomerQuotationStatus.Cancelled;
        CancelledAtUtc = DateTime.UtcNow;
        AdvisorRemarks = string.IsNullOrWhiteSpace(reason) ? AdvisorRemarks : $"{AdvisorRemarks} (Cancelled: {reason})";
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Accept()
    {
        Status = CustomerQuotationStatus.Accepted;
        AcceptedAtUtc = DateTime.UtcNow;
        CustomerRespondedAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Reject()
    {
        Status = CustomerQuotationStatus.Rejected;
        RejectedAtUtc = DateTime.UtcNow;
        CustomerRespondedAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
