using BroCoMod.Domain.Common;
using BroCoMod.Domain.Enums;

namespace BroCoMod.Domain.Entities;

/// <summary>
/// Sanitized, customer-facing quotation curated and approved by an Advisor.
/// Contains strictly customer-facing price and sanitized scope summary.
/// Internal garage costs and margins are segregated.
/// </summary>
public class CustomerQuotation : BaseEntity
{
    public Guid ServiceRequestId { get; private set; }
    public Guid AssignedGarageId { get; private set; }
    public decimal CustomerFacingPrice { get; private set; }
    public string ScopeSummary { get; private set; } = string.Empty;
    public string AdvisorNotes { get; private set; } = string.Empty;
    public decimal AdvisorMarginApplied { get; private set; }
    public QuoteStatus Status { get; private set; } = QuoteStatus.UnderReview;
    public DateTime? CustomerRespondedAtUtc { get; private set; }

    // Navigation properties
    public ServiceRequest ServiceRequest { get; private set; } = default!;

    protected CustomerQuotation() { }

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
        AdvisorMarginApplied = advisorMarginApplied;
        ScopeSummary = scopeSummary ?? string.Empty;
        AdvisorNotes = advisorNotes ?? string.Empty;
        Status = QuoteStatus.Submitted;
    }

    public void Accept()
    {
        Status = QuoteStatus.AcceptedByCustomer;
        CustomerRespondedAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Reject()
    {
        Status = QuoteStatus.RejectedByCustomer;
        CustomerRespondedAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
