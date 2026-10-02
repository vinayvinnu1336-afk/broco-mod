using BroCoMod.Domain.Common;
using BroCoMod.Domain.Enums;

namespace BroCoMod.Domain.Entities;

/// <summary>
/// Operational physical inspection performed by workshop technicians upon vehicle intake.
/// Segregates internal mechanical notes from customer-facing summaries.
/// </summary>
public class ServiceInspection : BaseEntity
{
    public Guid ServiceJobId { get; private set; }
    public Guid InspectorUserId { get; private set; }
    public DateTime InspectionStartedAtUtc { get; private set; } = DateTime.UtcNow;
    public DateTime? InspectionCompletedAtUtc { get; private set; }
    public string? Findings { get; private set; }
    public string? Recommendations { get; private set; }
    public string? CustomerVisibleSummary { get; private set; }
    public InspectionSeverity OverallSeverity { get; private set; } = InspectionSeverity.Info;

    // Navigation
    public ServiceJob? ServiceJob { get; private set; }

    protected ServiceInspection() { }

    public ServiceInspection(
        Guid serviceJobId,
        Guid inspectorUserId,
        InspectionSeverity severity = InspectionSeverity.Info)
    {
        if (serviceJobId == Guid.Empty)
            throw new ArgumentException("ServiceJobId cannot be empty.", nameof(serviceJobId));
        if (inspectorUserId == Guid.Empty)
            throw new ArgumentException("InspectorUserId cannot be empty.", nameof(inspectorUserId));

        ServiceJobId = serviceJobId;
        InspectorUserId = inspectorUserId;
        InspectionStartedAtUtc = DateTime.UtcNow;
        OverallSeverity = severity;
    }

    public void Complete(
        string? findings,
        string? recommendations,
        string? customerVisibleSummary,
        InspectionSeverity severity)
    {
        Findings = findings?.Trim();
        Recommendations = recommendations?.Trim();
        CustomerVisibleSummary = customerVisibleSummary?.Trim();
        OverallSeverity = severity;
        InspectionCompletedAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
