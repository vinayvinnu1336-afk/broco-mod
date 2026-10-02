using BroCoMod.Domain.Common;
using BroCoMod.Domain.Enums;

namespace BroCoMod.Domain.Entities;

/// <summary>
/// Workshop request for additional repairs or parts discovered during inspection or work.
/// Crucial Architectural Invariant: Never automatically mutates the customer's accepted quotation or charges the customer.
/// </summary>
public class AdditionalWorkRequest : BaseEntity
{
    public Guid ServiceJobId { get; private set; }
    public string Description { get; private set; } = string.Empty;
    public decimal EstimatedAdditionalAmount { get; private set; }
    public string Reason { get; private set; } = string.Empty;
    public AdditionalWorkStatus Status { get; private set; } = AdditionalWorkStatus.PendingAdvisorReview;

    public Guid? ReviewedByAdvisorId { get; private set; }
    public string? AdvisorRemarks { get; private set; }
    public DateTime? ReviewedAtUtc { get; private set; }
    public Guid CreatedByUserId { get; private set; }

    // Navigation
    public ServiceJob? ServiceJob { get; private set; }

    protected AdditionalWorkRequest() { }

    public AdditionalWorkRequest(
        Guid serviceJobId,
        string description,
        decimal estimatedAdditionalAmount,
        string reason,
        Guid createdByUserId)
    {
        if (serviceJobId == Guid.Empty)
            throw new ArgumentException("ServiceJobId cannot be empty.", nameof(serviceJobId));
        if (string.IsNullOrWhiteSpace(description))
            throw new ArgumentException("Description cannot be empty.", nameof(description));
        if (string.IsNullOrWhiteSpace(reason))
            throw new ArgumentException("Reason cannot be empty.", nameof(reason));
        if (estimatedAdditionalAmount < 0)
            throw new ArgumentException("Estimated additional amount cannot be negative.", nameof(estimatedAdditionalAmount));
        if (createdByUserId == Guid.Empty)
            throw new ArgumentException("CreatedByUserId cannot be empty.", nameof(createdByUserId));

        ServiceJobId = serviceJobId;
        Description = description.Trim();
        EstimatedAdditionalAmount = estimatedAdditionalAmount;
        Reason = reason.Trim();
        CreatedByUserId = createdByUserId;
        Status = AdditionalWorkStatus.PendingAdvisorReview;
    }

    public void Approve(Guid advisorId, string? remarks)
    {
        if (Status != AdditionalWorkStatus.PendingAdvisorReview)
            throw new InvalidOperationException($"Cannot approve additional work request in '{Status}' state. Allowed only when 'PendingAdvisorReview'.");

        if (advisorId == Guid.Empty)
            throw new ArgumentException("AdvisorId cannot be empty.", nameof(advisorId));

        Status = AdditionalWorkStatus.Approved;
        ReviewedByAdvisorId = advisorId;
        AdvisorRemarks = remarks?.Trim();
        ReviewedAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Reject(Guid advisorId, string? remarks)
    {
        if (Status != AdditionalWorkStatus.PendingAdvisorReview)
            throw new InvalidOperationException($"Cannot reject additional work request in '{Status}' state. Allowed only when 'PendingAdvisorReview'.");

        if (advisorId == Guid.Empty)
            throw new ArgumentException("AdvisorId cannot be empty.", nameof(advisorId));

        Status = AdditionalWorkStatus.Rejected;
        ReviewedByAdvisorId = advisorId;
        AdvisorRemarks = remarks?.Trim();
        ReviewedAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Cancel(Guid userId)
    {
        if (Status != AdditionalWorkStatus.PendingAdvisorReview)
            throw new InvalidOperationException($"Cannot cancel additional work request in '{Status}' state. Allowed only when 'PendingAdvisorReview'.");

        Status = AdditionalWorkStatus.Cancelled;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
