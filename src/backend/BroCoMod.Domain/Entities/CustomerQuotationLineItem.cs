using BroCoMod.Domain.Common;
using BroCoMod.Domain.Enums;

namespace BroCoMod.Domain.Entities;

/// <summary>
/// Individual customer-facing commercial line item in a CustomerQuotation.
/// STAGE BOUNDARY: Curated by Technical Advisors. Completely segregated from internal garage wholesale rates.
/// </summary>
public class CustomerQuotationLineItem : BaseEntity
{
    public Guid CustomerQuotationId { get; private set; }
    public QuoteLineType LineType { get; private set; } = QuoteLineType.Service;
    public string Description { get; private set; } = string.Empty;
    public decimal Quantity { get; private set; } = 1.0m;
    public decimal UnitPrice { get; private set; } = 0.0m;
    public decimal TaxRate { get; private set; } = 18.0m; // Default standard GST
    public decimal DiscountAmount { get; private set; } = 0.0m;
    public decimal LineTotal { get; private set; } = 0.0m;
    public int SortOrder { get; private set; } = 0;

    // Navigation property
    public CustomerQuotation? CustomerQuotation { get; private set; }

    protected CustomerQuotationLineItem() { }

    public CustomerQuotationLineItem(
        Guid customerQuotationId,
        QuoteLineType lineType,
        string description,
        decimal quantity,
        decimal unitPrice,
        decimal taxRate = 18.0m,
        decimal discountAmount = 0.0m,
        int sortOrder = 0)
    {
        if (customerQuotationId == Guid.Empty)
            throw new ArgumentException("CustomerQuotationId cannot be empty.", nameof(customerQuotationId));
        if (string.IsNullOrWhiteSpace(description))
            throw new ArgumentException("Description cannot be empty.", nameof(description));
        if (quantity <= 0)
            throw new ArgumentException("Quantity must be greater than zero.", nameof(quantity));
        if (unitPrice < 0)
            throw new ArgumentException("UnitPrice cannot be negative.", nameof(unitPrice));
        if (discountAmount < 0)
            throw new ArgumentException("DiscountAmount cannot be negative.", nameof(discountAmount));

        CustomerQuotationId = customerQuotationId;
        LineType = lineType;
        Description = description.Trim();
        Quantity = quantity;
        UnitPrice = unitPrice;
        TaxRate = Math.Max(0m, taxRate);
        DiscountAmount = discountAmount;
        SortOrder = sortOrder;

        RecalculateLineTotal();
    }

    public void Update(
        QuoteLineType lineType,
        string description,
        decimal quantity,
        decimal unitPrice,
        decimal taxRate,
        decimal discountAmount,
        int sortOrder)
    {
        if (string.IsNullOrWhiteSpace(description))
            throw new ArgumentException("Description cannot be empty.", nameof(description));
        if (quantity <= 0)
            throw new ArgumentException("Quantity must be greater than zero.", nameof(quantity));
        if (unitPrice < 0)
            throw new ArgumentException("UnitPrice cannot be negative.", nameof(unitPrice));
        if (discountAmount < 0)
            throw new ArgumentException("DiscountAmount cannot be negative.", nameof(discountAmount));

        LineType = lineType;
        Description = description.Trim();
        Quantity = quantity;
        UnitPrice = unitPrice;
        TaxRate = Math.Max(0m, taxRate);
        DiscountAmount = discountAmount;
        SortOrder = sortOrder;
        UpdatedAtUtc = DateTime.UtcNow;

        RecalculateLineTotal();
    }

    public void RecalculateLineTotal()
    {
        var rawTotal = (Quantity * UnitPrice) - DiscountAmount;
        LineTotal = Math.Max(0m, decimal.Round(rawTotal, 2, MidpointRounding.AwayFromZero));
    }
}
