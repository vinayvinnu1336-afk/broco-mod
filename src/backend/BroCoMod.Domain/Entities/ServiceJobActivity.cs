using BroCoMod.Domain.Common;
using BroCoMod.Domain.Enums;

namespace BroCoMod.Domain.Entities;

/// <summary>
/// Immutable chronological operational event/activity log for a ServiceJob.
/// Supports deliberate customer-visibility tagging to isolate workshop internal events.
/// </summary>
public class ServiceJobActivity : BaseEntity
{
    public Guid ServiceJobId { get; private set; }
    public JobActivityType ActivityType { get; private set; }
    public string Message { get; private set; } = string.Empty;
    public bool IsCustomerVisible { get; private set; }
    public Guid CreatedByUserId { get; private set; }

    // Navigation
    public ServiceJob? ServiceJob { get; private set; }

    protected ServiceJobActivity() { }

    public ServiceJobActivity(
        Guid serviceJobId,
        JobActivityType activityType,
        string message,
        bool isCustomerVisible,
        Guid createdByUserId)
    {
        if (serviceJobId == Guid.Empty)
            throw new ArgumentException("ServiceJobId cannot be empty.", nameof(serviceJobId));
        if (string.IsNullOrWhiteSpace(message))
            throw new ArgumentException("Message cannot be empty.", nameof(message));
        if (createdByUserId == Guid.Empty)
            throw new ArgumentException("CreatedByUserId cannot be empty.", nameof(createdByUserId));

        ServiceJobId = serviceJobId;
        ActivityType = activityType;
        Message = message.Trim();
        IsCustomerVisible = isCustomerVisible;
        CreatedByUserId = createdByUserId;
        CreatedAtUtc = DateTime.UtcNow;
    }
}
