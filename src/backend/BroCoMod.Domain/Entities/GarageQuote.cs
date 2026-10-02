using System.Text.Json;
using BroCoMod.Domain.Common;
using BroCoMod.Domain.Enums;

namespace BroCoMod.Domain.Entities;

/// <summary>
/// Confidential quotation submitted by an eligible partner garage for a dispatched GarageRequest.
/// PRICING SECURITY REQUIREMENT:
/// Garage internal pricing and internal cost breakdowns must NEVER be exposed to customers.
/// </summary>
public class GarageQuote : BaseEntity
{
    public Guid GarageRequestId { get; private set; }
    public Guid GarageId { get; private set; }
    public Guid ServiceRequestId { get; private set; }
    public string QuoteNumber { get; private set; } = string.Empty;
    public int VersionNumber { get; private set; } = 1;
    public QuoteStatus Status { get; private set; } = QuoteStatus.Draft;
    public string Currency { get; private set; } = "INR";

    public decimal Subtotal { get; private set; }
    public decimal TaxAmount { get; private set; }
    public decimal DiscountAmount { get; private set; }
    public decimal TotalAmount { get; private set; }

    public int? EstimatedCompletionHours { get; private set; }
    public int? EstimatedCompletionDays { get; private set; }
    public DateTime ValidUntil { get; private set; }
    public string GarageRemarks { get; private set; } = string.Empty;

    public DateTime? SubmittedAtUtc { get; private set; }
    public DateTime? WithdrawnAtUtc { get; private set; }
    public DateTime? ExpiredAtUtc { get; private set; }
    public string? WithdrawalReason { get; private set; }

    public Guid? CreatedByUserId { get; private set; }
    public Guid? UpdatedByUserId { get; private set; }
    public Guid? SubmittedByUserId { get; private set; }

    public Guid ConcurrencyToken { get; private set; } = Guid.NewGuid();
    public string? IdempotencyKey { get; private set; }

    // Navigation properties
    public GarageRequest GarageRequest { get; private set; } = default!;
    public Garage Garage { get; private set; } = default!;
    public ServiceRequest ServiceRequest { get; private set; } = default!;
    public ICollection<GarageQuoteLineItem> LineItems { get; private set; } = new List<GarageQuoteLineItem>();
    public ICollection<GarageQuoteVersion> Versions { get; private set; } = new List<GarageQuoteVersion>();

    // Backward compatibility properties for Milestone 1-4 tests
    public decimal GarageInternalPrice => TotalAmount;
    public string InternalCostBreakdown => GarageRemarks;
    public string GarageNotes => GarageRemarks;
    public int EstimatedDurationHours => EstimatedCompletionHours ?? (EstimatedCompletionDays * 8 ?? 0);

    protected GarageQuote() { }

    /// <summary>
    /// Milestone 5 Primary Constructor for new GarageQuote drafts.
    /// </summary>
    public GarageQuote(
        Guid garageRequestId,
        Guid garageId,
        Guid serviceRequestId,
        string quoteNumber,
        string currency = "INR",
        DateTime? validUntil = null,
        int? estimatedCompletionHours = null,
        int? estimatedCompletionDays = null,
        string? garageRemarks = null,
        Guid? createdByUserId = null)
    {
        if (garageRequestId == Guid.Empty) throw new ArgumentException("GarageRequestId cannot be empty.", nameof(garageRequestId));
        if (garageId == Guid.Empty) throw new ArgumentException("GarageId cannot be empty.", nameof(garageId));
        if (serviceRequestId == Guid.Empty) throw new ArgumentException("ServiceRequestId cannot be empty.", nameof(serviceRequestId));
        if (string.IsNullOrWhiteSpace(quoteNumber)) throw new ArgumentException("QuoteNumber is required.", nameof(quoteNumber));

        GarageRequestId = garageRequestId;
        GarageId = garageId;
        ServiceRequestId = serviceRequestId;
        QuoteNumber = quoteNumber.Trim().ToUpperInvariant();
        Currency = string.IsNullOrWhiteSpace(currency) ? "INR" : currency.Trim().ToUpperInvariant();
        ValidUntil = DateTime.SpecifyKind(validUntil ?? DateTime.UtcNow.AddDays(7), DateTimeKind.Utc);
        EstimatedCompletionHours = estimatedCompletionHours;
        EstimatedCompletionDays = estimatedCompletionDays;
        GarageRemarks = garageRemarks?.Trim() ?? string.Empty;
        CreatedByUserId = createdByUserId;
        UpdatedByUserId = createdByUserId;
        Status = QuoteStatus.Draft;
        VersionNumber = 1;
        ConcurrencyToken = Guid.NewGuid();
    }

    /// <summary>
    /// Backward-compatible constructor for existing Milestone 1-4 tests.
    /// </summary>
    public GarageQuote(
        Guid serviceRequestId,
        Guid garageId,
        decimal garageInternalPrice,
        string internalCostBreakdown,
        string garageNotes,
        int estimatedDurationHours)
    {
        if (garageInternalPrice <= 0)
            throw new ArgumentException("Garage internal price must be greater than zero.", nameof(garageInternalPrice));

        ServiceRequestId = serviceRequestId;
        GarageRequestId = serviceRequestId; // Placeholder fallback for legacy mock tests
        GarageId = garageId;
        QuoteNumber = $"BQ-{DateTime.UtcNow.Ticks % 1000000:D6}";
        Subtotal = garageInternalPrice;
        TotalAmount = garageInternalPrice;
        GarageRemarks = $"{internalCostBreakdown} | {garageNotes}".Trim(' ', '|');
        EstimatedCompletionHours = estimatedDurationHours;
        ValidUntil = DateTime.UtcNow.AddDays(7);
        Status = QuoteStatus.Submitted;
        SubmittedAtUtc = DateTime.UtcNow;
        ConcurrencyToken = Guid.NewGuid();
    }

    public void AddLineItem(
        QuoteLineType lineType,
        string description,
        decimal quantity,
        decimal unitPrice,
        decimal taxRate = 0m,
        decimal discountAmount = 0m,
        int sortOrder = 0)
    {
        EnsureDraftState("add line item");

        var item = new GarageQuoteLineItem(
            Id,
            lineType,
            description,
            quantity,
            unitPrice,
            taxRate,
            discountAmount,
            sortOrder);

        LineItems.Add(item);
        RecalculateTotals();
        ConcurrencyToken = Guid.NewGuid();
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void ClearLineItems()
    {
        EnsureDraftState("clear line items");
        LineItems.Clear();
        RecalculateTotals();
        ConcurrencyToken = Guid.NewGuid();
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void RecalculateTotals()
    {
        decimal grossSum = 0m;
        decimal discountSum = 0m;
        decimal taxSum = 0m;

        foreach (var item in LineItems)
        {
            var gross = Math.Round(item.Quantity * item.UnitPrice, 2);
            grossSum += gross;
            discountSum += item.DiscountAmount;

            var taxable = gross - item.DiscountAmount;
            var tax = Math.Round(taxable * (item.TaxRate / 100m), 2);
            taxSum += tax;
        }

        Subtotal = grossSum;
        DiscountAmount = discountSum;
        TaxAmount = taxSum;
        TotalAmount = Math.Round(grossSum - discountSum + taxSum, 2);
    }

    public void UpdateDraft(
        int? estimatedCompletionHours,
        int? estimatedCompletionDays,
        DateTime validUntil,
        string? garageRemarks,
        Guid? updatedByUserId = null)
    {
        EnsureDraftState("update quote draft");

        if (validUntil <= DateTime.UtcNow)
        {
            throw new ArgumentException("ValidUntil must be a future date and time.", nameof(validUntil));
        }

        EstimatedCompletionHours = estimatedCompletionHours;
        EstimatedCompletionDays = estimatedCompletionDays;
        ValidUntil = DateTime.SpecifyKind(validUntil, DateTimeKind.Utc);
        GarageRemarks = garageRemarks?.Trim() ?? string.Empty;
        UpdatedByUserId = updatedByUserId;
        UpdatedAtUtc = DateTime.UtcNow;
        ConcurrencyToken = Guid.NewGuid();
    }

    public void Submit(Guid userId, string? idempotencyKey = null)
    {
        if (Status == QuoteStatus.Submitted)
        {
            // Idempotent safeguard
            if (!string.IsNullOrWhiteSpace(idempotencyKey) && IdempotencyKey == idempotencyKey)
            {
                return;
            }
            throw new InvalidOperationException("Quote has already been submitted.");
        }

        if (Status != QuoteStatus.Draft)
        {
            throw new InvalidOperationException($"Cannot submit quote in '{Status}' state. Only DRAFT quotes can be submitted.");
        }

        if (ValidUntil <= DateTime.UtcNow)
        {
            throw new InvalidOperationException("Cannot submit an expired quote. Validity date must be in the future.");
        }

        if (LineItems.Count == 0)
        {
            throw new InvalidOperationException("Cannot submit a quote without any line items.");
        }

        RecalculateTotals();

        if (TotalAmount <= 0)
        {
            throw new InvalidOperationException("Quote total amount must be greater than zero.");
        }

        Status = QuoteStatus.Submitted;
        SubmittedAtUtc = DateTime.UtcNow;
        SubmittedByUserId = userId;
        UpdatedByUserId = userId;
        UpdatedAtUtc = DateTime.UtcNow;
        IdempotencyKey = idempotencyKey;
        ConcurrencyToken = Guid.NewGuid();

        // Capture immutable version snapshot
        var snapshotLineItems = LineItems.Select(li => new
        {
            li.Id,
            LineType = li.LineType.ToString(),
            li.Description,
            li.Quantity,
            li.UnitPrice,
            li.TaxRate,
            li.DiscountAmount,
            li.ItemSubtotal,
            li.LineTax,
            li.LineTotal,
            li.SortOrder
        }).ToList();

        var version = new GarageQuoteVersion(
            garageQuoteId: Id,
            versionNumber: VersionNumber,
            subtotal: Subtotal,
            taxAmount: TaxAmount,
            discountAmount: DiscountAmount,
            totalAmount: TotalAmount,
            estimatedCompletionDays: EstimatedCompletionDays,
            estimatedCompletionHours: EstimatedCompletionHours,
            validUntil: ValidUntil,
            garageRemarks: GarageRemarks,
            lineItemsJson: JsonSerializer.Serialize(snapshotLineItems),
            submittedAtUtc: SubmittedAtUtc.Value,
            submittedByUserId: userId);

        Versions.Add(version);
    }

    public void Withdraw(Guid userId, string reason)
    {
        if (Status != QuoteStatus.Draft && Status != QuoteStatus.Submitted && Status != QuoteStatus.UnderReview)
        {
            throw new InvalidOperationException($"Cannot withdraw quote in '{Status}' state. Allowed only from DRAFT, SUBMITTED, or UNDER_REVIEW.");
        }

        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new ArgumentException("Withdrawal reason is required.", nameof(reason));
        }

        Status = QuoteStatus.Withdrawn;
        WithdrawnAtUtc = DateTime.UtcNow;
        WithdrawalReason = reason.Trim();
        UpdatedByUserId = userId;
        UpdatedAtUtc = DateTime.UtcNow;
        ConcurrencyToken = Guid.NewGuid();
    }

    public void MarkUnderReview()
    {
        if (Status == QuoteStatus.Submitted)
        {
            Status = QuoteStatus.UnderReview;
            UpdatedAtUtc = DateTime.UtcNow;
            ConcurrencyToken = Guid.NewGuid();
        }
    }

    public void MarkExpired()
    {
        if (Status == QuoteStatus.Draft || Status == QuoteStatus.Submitted || Status == QuoteStatus.UnderReview)
        {
            Status = QuoteStatus.Expired;
            ExpiredAtUtc = DateTime.UtcNow;
            UpdatedAtUtc = DateTime.UtcNow;
            ConcurrencyToken = Guid.NewGuid();
        }
    }

    public void CreateRevision(Guid userId)
    {
        if (Status != QuoteStatus.Submitted && Status != QuoteStatus.UnderReview)
        {
            throw new InvalidOperationException($"Cannot create a revision for a quote in '{Status}' state. Allowed only from SUBMITTED or UNDER_REVIEW.");
        }

        VersionNumber++;
        Status = QuoteStatus.Draft;
        SubmittedAtUtc = null;
        SubmittedByUserId = null;
        UpdatedByUserId = userId;
        UpdatedAtUtc = DateTime.UtcNow;
        ConcurrencyToken = Guid.NewGuid();
    }

    public void MarkSelected()
    {
        Status = QuoteStatus.SelectedByAdvisor;
        UpdatedAtUtc = DateTime.UtcNow;
        ConcurrencyToken = Guid.NewGuid();
    }

    public void MarkRejected()
    {
        Status = QuoteStatus.RejectedByAdvisor;
        UpdatedAtUtc = DateTime.UtcNow;
        ConcurrencyToken = Guid.NewGuid();
    }

    private void EnsureDraftState(string operation)
    {
        if (Status != QuoteStatus.Draft)
        {
            throw new InvalidOperationException($"Cannot {operation} on a quote in '{Status}' state. Submitted quotes cannot be modified directly.");
        }
    }
}
