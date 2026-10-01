using BroCoMod.Domain.Common;
using BroCoMod.Domain.Enums;

namespace BroCoMod.Domain.Entities;

/// <summary>
/// Confidential quotation submitted by an eligible garage.
/// PRICING SECURITY REQUIREMENT:
/// Garage internal pricing and internal cost breakdowns must NEVER be exposed to customers.
/// </summary>
public class GarageQuote : BaseEntity
{
    public Guid ServiceRequestId { get; private set; }
    public Guid GarageId { get; private set; }
    public decimal GarageInternalPrice { get; private set; }
    public string InternalCostBreakdown { get; private set; } = string.Empty;
    public string GarageNotes { get; private set; } = string.Empty;
    public int EstimatedDurationHours { get; private set; }
    public QuoteStatus Status { get; private set; } = QuoteStatus.Submitted;

    // Navigation properties
    public ServiceRequest ServiceRequest { get; private set; } = default!;
    public Garage Garage { get; private set; } = default!;

    protected GarageQuote() { }

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
        GarageId = garageId;
        GarageInternalPrice = garageInternalPrice;
        InternalCostBreakdown = internalCostBreakdown ?? string.Empty;
        GarageNotes = garageNotes ?? string.Empty;
        EstimatedDurationHours = estimatedDurationHours;
        Status = QuoteStatus.Submitted;
    }

    public void MarkUnderReview()
    {
        Status = QuoteStatus.UnderReview;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void MarkSelected()
    {
        Status = QuoteStatus.SelectedByAdvisor;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void MarkRejected()
    {
        Status = QuoteStatus.RejectedByAdvisor;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
