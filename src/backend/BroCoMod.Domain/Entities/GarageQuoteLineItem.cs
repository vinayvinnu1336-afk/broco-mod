using BroCoMod.Domain.Common;
using BroCoMod.Domain.Enums;

namespace BroCoMod.Domain.Entities;

/// <summary>
/// Detailed individual line item for a garage quotation.
/// Strongly typed across Labour, Part, Service, and Other.
/// </summary>
public class GarageQuoteLineItem : BaseEntity
{
    public Guid GarageQuoteId { get; private set; }
    public QuoteLineType LineType { get; private set; }
    public string Description { get; private set; } = string.Empty;
    public decimal Quantity { get; private set; }
    public decimal UnitPrice { get; private set; }
    public decimal TaxRate { get; private set; }
    public decimal DiscountAmount { get; private set; }
    public decimal ItemSubtotal { get; private set; }
    public decimal LineTax { get; private set; }
    public decimal LineTotal { get; private set; }
    public int SortOrder { get; private set; }

    // Navigation
    public GarageQuote GarageQuote { get; private set; } = default!;

    protected GarageQuoteLineItem() { }

    public GarageQuoteLineItem(
        Guid garageQuoteId,
        QuoteLineType lineType,
        string description,
        decimal quantity,
        decimal unitPrice,
        decimal taxRate = 0m,
        decimal discountAmount = 0m,
        int sortOrder = 0)
    {
        if (garageQuoteId == Guid.Empty) throw new ArgumentException("GarageQuoteId cannot be empty.", nameof(garageQuoteId));
        if (string.IsNullOrWhiteSpace(description)) throw new ArgumentException("Description is required.", nameof(description));
        if (quantity <= 0) throw new ArgumentOutOfRangeException(nameof(quantity), "Quantity must be greater than zero.");
        if (unitPrice < 0) throw new ArgumentOutOfRangeException(nameof(unitPrice), "UnitPrice cannot be negative.");
        if (taxRate < 0) throw new ArgumentOutOfRangeException(nameof(taxRate), "TaxRate cannot be negative.");
        if (discountAmount < 0) throw new ArgumentOutOfRangeException(nameof(discountAmount), "DiscountAmount cannot be negative.");

        var grossAmount = quantity * unitPrice;
        if (discountAmount > grossAmount)
        {
            throw new ArgumentOutOfRangeException(nameof(discountAmount), "DiscountAmount cannot exceed gross line item amount.");
        }

        GarageQuoteId = garageQuoteId;
        LineType = lineType;
        Description = description.Trim();
        Quantity = Math.Round(quantity, 2);
        UnitPrice = Math.Round(unitPrice, 2);
        TaxRate = Math.Round(taxRate, 2);
        DiscountAmount = Math.Round(discountAmount, 2);
        SortOrder = sortOrder;

        CalculateLineTotal();
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
        if (string.IsNullOrWhiteSpace(description)) throw new ArgumentException("Description is required.", nameof(description));
        if (quantity <= 0) throw new ArgumentOutOfRangeException(nameof(quantity), "Quantity must be greater than zero.");
        if (unitPrice < 0) throw new ArgumentOutOfRangeException(nameof(unitPrice), "UnitPrice cannot be negative.");
        if (taxRate < 0) throw new ArgumentOutOfRangeException(nameof(taxRate), "TaxRate cannot be negative.");
        if (discountAmount < 0) throw new ArgumentOutOfRangeException(nameof(discountAmount), "DiscountAmount cannot be negative.");

        var grossAmount = quantity * unitPrice;
        if (discountAmount > grossAmount)
        {
            throw new ArgumentOutOfRangeException(nameof(discountAmount), "DiscountAmount cannot exceed gross line item amount.");
        }

        LineType = lineType;
        Description = description.Trim();
        Quantity = Math.Round(quantity, 2);
        UnitPrice = Math.Round(unitPrice, 2);
        TaxRate = Math.Round(taxRate, 2);
        DiscountAmount = Math.Round(discountAmount, 2);
        SortOrder = sortOrder;
        UpdatedAtUtc = DateTime.UtcNow;

        CalculateLineTotal();
    }

    private void CalculateLineTotal()
    {
        ItemSubtotal = Math.Round((Quantity * UnitPrice) - DiscountAmount, 2);
        LineTax = Math.Round(ItemSubtotal * (TaxRate / 100m), 2);
        LineTotal = Math.Round(ItemSubtotal + LineTax, 2);
    }
}
