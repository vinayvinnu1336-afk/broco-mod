using BroCoMod.Domain.Common;

namespace BroCoMod.Domain.Entities;

/// <summary>
/// Immutable historical version snapshot of a CustomerQuotation created upon submission or ready-to-send transitions.
/// Preserves financial data and line items so that subsequent revisions never silently overwrite history.
/// </summary>
public class CustomerQuotationVersion : BaseEntity
{
    public Guid CustomerQuotationId { get; private set; }
    public int VersionNumber { get; private set; }
    public decimal CustomerSubtotal { get; private set; }
    public decimal CustomerDiscount { get; private set; }
    public decimal CustomerTax { get; private set; }
    public decimal CustomerTotal { get; private set; }
    public DateTime ValidUntilUtc { get; private set; }
    public string? AdvisorRemarks { get; private set; }
    public string? ScopeSummary { get; private set; }
    public string LineItemsJson { get; private set; } = string.Empty;
    public Guid CreatedByUserId { get; private set; }

    // Navigation property
    public CustomerQuotation? CustomerQuotation { get; private set; }

    protected CustomerQuotationVersion() { }

    public CustomerQuotationVersion(
        Guid customerQuotationId,
        int versionNumber,
        decimal customerSubtotal,
        decimal customerDiscount,
        decimal customerTax,
        decimal customerTotal,
        DateTime validUntilUtc,
        string? advisorRemarks,
        string? scopeSummary,
        string lineItemsJson,
        Guid createdByUserId)
    {
        if (customerQuotationId == Guid.Empty)
            throw new ArgumentException("CustomerQuotationId cannot be empty.", nameof(customerQuotationId));
        if (versionNumber <= 0)
            throw new ArgumentException("VersionNumber must be greater than zero.", nameof(versionNumber));
        if (string.IsNullOrWhiteSpace(lineItemsJson))
            throw new ArgumentException("LineItemsJson cannot be empty.", nameof(lineItemsJson));

        CustomerQuotationId = customerQuotationId;
        VersionNumber = versionNumber;
        CustomerSubtotal = customerSubtotal;
        CustomerDiscount = customerDiscount;
        CustomerTax = customerTax;
        CustomerTotal = customerTotal;
        ValidUntilUtc = DateTime.SpecifyKind(validUntilUtc, DateTimeKind.Utc);
        AdvisorRemarks = advisorRemarks?.Trim();
        ScopeSummary = scopeSummary?.Trim();
        LineItemsJson = lineItemsJson;
        CreatedByUserId = createdByUserId;
        CreatedAtUtc = DateTime.UtcNow;
    }
}
