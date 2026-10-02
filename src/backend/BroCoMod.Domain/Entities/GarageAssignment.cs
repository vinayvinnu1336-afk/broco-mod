using BroCoMod.Domain.Common;
using BroCoMod.Domain.Enums;

namespace BroCoMod.Domain.Entities;

/// <summary>
/// Operational assignment linking a ServiceRequest to a selected partner Garage and their winning GarageQuote.
/// Only one active assignment (Status = Assigned) can exist per ServiceRequest at any time.
/// </summary>
public class GarageAssignment : BaseEntity
{
    public Guid ServiceRequestId { get; private set; }
    public Guid GarageId { get; private set; }
    public Guid SelectedQuoteId { get; private set; }
    public Guid AssignedByAdvisorId { get; private set; }
    public DateTime AssignedAtUtc { get; private set; } = DateTime.UtcNow;
    public GarageAssignmentStatus Status { get; private set; } = GarageAssignmentStatus.Assigned;
    public string? AssignmentReason { get; private set; }
    public DateTime? CancelledAtUtc { get; private set; }
    public string? CancellationReason { get; private set; }
    public Guid ConcurrencyToken { get; private set; } = Guid.NewGuid();

    // Navigation properties
    public ServiceRequest? ServiceRequest { get; private set; }
    public Garage? Garage { get; private set; }
    public GarageQuote? SelectedQuote { get; private set; }
    public ICollection<CustomerQuotation> CustomerQuotations { get; private set; } = new List<CustomerQuotation>();

    protected GarageAssignment() { }

    public GarageAssignment(
        Guid serviceRequestId,
        Guid garageId,
        Guid selectedQuoteId,
        Guid assignedByAdvisorId,
        string? assignmentReason = null)
    {
        if (serviceRequestId == Guid.Empty)
            throw new ArgumentException("ServiceRequestId cannot be empty.", nameof(serviceRequestId));
        if (garageId == Guid.Empty)
            throw new ArgumentException("GarageId cannot be empty.", nameof(garageId));
        if (selectedQuoteId == Guid.Empty)
            throw new ArgumentException("SelectedQuoteId cannot be empty.", nameof(selectedQuoteId));
        if (assignedByAdvisorId == Guid.Empty)
            throw new ArgumentException("AssignedByAdvisorId cannot be empty.", nameof(assignedByAdvisorId));

        ServiceRequestId = serviceRequestId;
        GarageId = garageId;
        SelectedQuoteId = selectedQuoteId;
        AssignedByAdvisorId = assignedByAdvisorId;
        AssignedAtUtc = DateTime.UtcNow;
        Status = GarageAssignmentStatus.Assigned;
        AssignmentReason = assignmentReason?.Trim();
        ConcurrencyToken = Guid.NewGuid();
    }

    public void Cancel(string reason, Guid advisorId)
    {
        if (Status != GarageAssignmentStatus.Assigned)
            throw new InvalidOperationException($"Cannot cancel garage assignment in '{Status}' state. Allowed only when 'Assigned'.");

        if (advisorId == Guid.Empty)
            throw new ArgumentException("AdvisorId cannot be empty.", nameof(advisorId));

        Status = GarageAssignmentStatus.Cancelled;
        CancelledAtUtc = DateTime.UtcNow;
        CancellationReason = string.IsNullOrWhiteSpace(reason) ? "Cancelled by advisor" : reason.Trim();
        UpdatedAtUtc = DateTime.UtcNow;
        ConcurrencyToken = Guid.NewGuid();
    }

    public void MarkReassigned(string reason, Guid advisorId)
    {
        if (Status != GarageAssignmentStatus.Assigned)
            throw new InvalidOperationException($"Cannot reassign garage assignment in '{Status}' state. Allowed only when 'Assigned'.");

        if (advisorId == Guid.Empty)
            throw new ArgumentException("AdvisorId cannot be empty.", nameof(advisorId));

        Status = GarageAssignmentStatus.Reassigned;
        CancelledAtUtc = DateTime.UtcNow;
        CancellationReason = string.IsNullOrWhiteSpace(reason) ? "Superseded by reassignment" : reason.Trim();
        UpdatedAtUtc = DateTime.UtcNow;
        ConcurrencyToken = Guid.NewGuid();
    }
}
