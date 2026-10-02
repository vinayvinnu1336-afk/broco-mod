using BroCoMod.Domain.Common;

namespace BroCoMod.Domain.Entities;

/// <summary>
/// Immutable audit snapshot of a submitted garage quotation version.
/// Guarantees that no historical quote data is lost when a garage revises a quote.
/// </summary>
public class GarageQuoteVersion : BaseEntity
{
    public Guid GarageQuoteId { get; private set; }
    public int VersionNumber { get; private set; }
    public decimal Subtotal { get; private set; }
    public decimal TaxAmount { get; private set; }
    public decimal DiscountAmount { get; private set; }
    public decimal TotalAmount { get; private set; }
    public int? EstimatedCompletionDays { get; private set; }
    public int? EstimatedCompletionHours { get; private set; }
    public DateTime ValidUntil { get; private set; }
    public string GarageRemarks { get; private set; } = string.Empty;
    public string LineItemsJson { get; private set; } = "[]";
    public DateTime SubmittedAtUtc { get; private set; }
    public Guid SubmittedByUserId { get; private set; }

    // Navigation
    public GarageQuote GarageQuote { get; private set; } = default!;

    protected GarageQuoteVersion() { }

    public GarageQuoteVersion(
        Guid garageQuoteId,
        int versionNumber,
        decimal subtotal,
        decimal taxAmount,
        decimal discountAmount,
        decimal totalAmount,
        int? estimatedCompletionDays,
        int? estimatedCompletionHours,
        DateTime validUntil,
        string? garageRemarks,
        string lineItemsJson,
        DateTime submittedAtUtc,
        Guid submittedByUserId)
    {
        if (garageQuoteId == Guid.Empty) throw new ArgumentException("GarageQuoteId cannot be empty.", nameof(garageQuoteId));
        if (versionNumber < 1) throw new ArgumentOutOfRangeException(nameof(versionNumber), "VersionNumber must be at least 1.");

        GarageQuoteId = garageQuoteId;
        VersionNumber = versionNumber;
        Subtotal = Math.Round(subtotal, 2);
        TaxAmount = Math.Round(taxAmount, 2);
        DiscountAmount = Math.Round(discountAmount, 2);
        TotalAmount = Math.Round(totalAmount, 2);
        EstimatedCompletionDays = estimatedCompletionDays;
        EstimatedCompletionHours = estimatedCompletionHours;
        ValidUntil = validUntil;
        GarageRemarks = garageRemarks?.Trim() ?? string.Empty;
        LineItemsJson = string.IsNullOrWhiteSpace(lineItemsJson) ? "[]" : lineItemsJson;
        SubmittedAtUtc = submittedAtUtc;
        SubmittedByUserId = submittedByUserId;
    }
}
