using BroCoMod.Domain.Common;
using BroCoMod.Domain.Enums;

namespace BroCoMod.Domain.Entities;

/// <summary>
/// Operational entity representing the actual physical service execution at the assigned partner garage.
/// Tied directly to a confirmed GarageAssignment and accepted CustomerQuotation.
/// </summary>
public class ServiceJob : BaseEntity
{
    public Guid ServiceRequestId { get; private set; }
    public Guid GarageAssignmentId { get; private set; }
    public Guid CustomerQuotationId { get; private set; }
    public Guid GarageId { get; private set; }
    public string JobNumber { get; private set; } = string.Empty;
    public ServiceJobStatus Status { get; private set; } = ServiceJobStatus.BookingConfirmed;

    // Operational Milestones
    public DateTime? ScheduledStartAtUtc { get; private set; }
    public DateTime? EstimatedCompletionAtUtc { get; private set; }
    public DateTime? ActualVehicleReceivedAtUtc { get; private set; }
    public DateTime? ActualWorkStartedAtUtc { get; private set; }
    public DateTime? ActualWorkCompletedAtUtc { get; private set; }
    public DateTime? VehicleReadyAtUtc { get; private set; }
    public DateTime? HandedOverAtUtc { get; private set; }
    public DateTime? ClosedAtUtc { get; private set; }
    public DateTime? CancelledAtUtc { get; private set; }
    public string? CancellationReason { get; private set; }

    // Service specifics
    public int? CurrentMileageKm { get; private set; }
    public string CustomerComplaintSnapshot { get; private set; } = string.Empty;
    public string? GarageInternalNotes { get; private set; }
    public string? CustomerFacingNotes { get; private set; }

    // Auditing & Concurrency
    public Guid CreatedByUserId { get; private set; }
    public Guid? UpdatedByUserId { get; private set; }
    public Guid ConcurrencyToken { get; private set; } = Guid.NewGuid();

    // Navigations
    public ServiceRequest? ServiceRequest { get; private set; }
    public GarageAssignment? GarageAssignment { get; private set; }
    public CustomerQuotation? CustomerQuotation { get; private set; }
    public Garage? Garage { get; private set; }
    public ICollection<ServiceInspection> Inspections { get; private set; } = new List<ServiceInspection>();
    public ICollection<ServiceJobActivity> Activities { get; private set; } = new List<ServiceJobActivity>();
    public ICollection<AdditionalWorkRequest> AdditionalWorkRequests { get; private set; } = new List<AdditionalWorkRequest>();

    protected ServiceJob() { }

    public ServiceJob(
        Guid serviceRequestId,
        Guid garageAssignmentId,
        Guid customerQuotationId,
        Guid garageId,
        string jobNumber,
        string customerComplaintSnapshot,
        Guid createdByUserId)
    {
        if (serviceRequestId == Guid.Empty)
            throw new ArgumentException("ServiceRequestId cannot be empty.", nameof(serviceRequestId));
        if (garageAssignmentId == Guid.Empty)
            throw new ArgumentException("GarageAssignmentId cannot be empty.", nameof(garageAssignmentId));
        if (customerQuotationId == Guid.Empty)
            throw new ArgumentException("CustomerQuotationId cannot be empty.", nameof(customerQuotationId));
        if (garageId == Guid.Empty)
            throw new ArgumentException("GarageId cannot be empty.", nameof(garageId));
        if (string.IsNullOrWhiteSpace(jobNumber))
            throw new ArgumentException("JobNumber cannot be empty.", nameof(jobNumber));
        if (createdByUserId == Guid.Empty)
            throw new ArgumentException("CreatedByUserId cannot be empty.", nameof(createdByUserId));

        ServiceRequestId = serviceRequestId;
        GarageAssignmentId = garageAssignmentId;
        CustomerQuotationId = customerQuotationId;
        GarageId = garageId;
        JobNumber = jobNumber.Trim().ToUpperInvariant();
        CustomerComplaintSnapshot = customerComplaintSnapshot?.Trim() ?? string.Empty;
        CreatedByUserId = createdByUserId;
        Status = ServiceJobStatus.BookingConfirmed;
        ConcurrencyToken = Guid.NewGuid();
    }

    public void Schedule(DateTime scheduledStartAtUtc, DateTime estimatedCompletionAtUtc, Guid userId)
    {
        if (Status != ServiceJobStatus.BookingConfirmed && Status != ServiceJobStatus.Scheduled)
            throw new InvalidOperationException($"Cannot schedule job in '{Status}' state. Allowed only from 'BookingConfirmed' or 'Scheduled'.");

        if (estimatedCompletionAtUtc < scheduledStartAtUtc)
            throw new ArgumentException("Estimated completion date must be greater than or equal to scheduled start date.", nameof(estimatedCompletionAtUtc));

        ScheduledStartAtUtc = DateTime.SpecifyKind(scheduledStartAtUtc, DateTimeKind.Utc);
        EstimatedCompletionAtUtc = DateTime.SpecifyKind(estimatedCompletionAtUtc, DateTimeKind.Utc);
        Status = ServiceJobStatus.Scheduled;
        UpdatedByUserId = userId;
        UpdatedAtUtc = DateTime.UtcNow;
        ConcurrencyToken = Guid.NewGuid();
    }

    public void ReceiveVehicle(int mileageKm, string? internalNote, string? customerNote, Guid userId)
    {
        if (Status != ServiceJobStatus.BookingConfirmed && Status != ServiceJobStatus.Scheduled)
            throw new InvalidOperationException($"Cannot mark vehicle received in '{Status}' state. Allowed only when 'BookingConfirmed' or 'Scheduled'.");

        if (mileageKm < 0)
            throw new ArgumentException("Current mileage cannot be negative.", nameof(mileageKm));

        CurrentMileageKm = mileageKm;
        ActualVehicleReceivedAtUtc = DateTime.UtcNow;
        Status = ServiceJobStatus.VehicleReceived;
        if (!string.IsNullOrWhiteSpace(internalNote)) GarageInternalNotes = internalNote.Trim();
        if (!string.IsNullOrWhiteSpace(customerNote)) CustomerFacingNotes = customerNote.Trim();
        UpdatedByUserId = userId;
        UpdatedAtUtc = DateTime.UtcNow;
        ConcurrencyToken = Guid.NewGuid();
    }

    public void StartInspection(Guid userId)
    {
        if (Status != ServiceJobStatus.VehicleReceived)
            throw new InvalidOperationException($"Cannot start inspection in '{Status}' state. Allowed only when 'VehicleReceived'.");

        Status = ServiceJobStatus.Inspection;
        UpdatedByUserId = userId;
        UpdatedAtUtc = DateTime.UtcNow;
        ConcurrencyToken = Guid.NewGuid();
    }

    public void CompleteInspection(Guid userId)
    {
        if (Status != ServiceJobStatus.Inspection)
            throw new InvalidOperationException($"Cannot complete inspection in '{Status}' state. Allowed only when 'Inspection'.");

        // Status remains Inspection or transitions to WorkStarted once work initiates
        UpdatedByUserId = userId;
        UpdatedAtUtc = DateTime.UtcNow;
        ConcurrencyToken = Guid.NewGuid();
    }

    public void StartWork(Guid userId)
    {
        if (Status != ServiceJobStatus.Inspection && Status != ServiceJobStatus.VehicleReceived)
            throw new InvalidOperationException($"Cannot start work in '{Status}' state. Allowed only from 'Inspection' or 'VehicleReceived'.");

        ActualWorkStartedAtUtc ??= DateTime.UtcNow;
        Status = ServiceJobStatus.WorkStarted;
        UpdatedByUserId = userId;
        UpdatedAtUtc = DateTime.UtcNow;
        ConcurrencyToken = Guid.NewGuid();
    }

    public void UpdateProgress(string? internalNote, string? customerNote, Guid userId)
    {
        if (Status != ServiceJobStatus.WorkStarted && Status != ServiceJobStatus.WorkInProgress)
            throw new InvalidOperationException($"Cannot update progress in '{Status}' state. Allowed only when work is started or in progress.");

        Status = ServiceJobStatus.WorkInProgress;
        if (!string.IsNullOrWhiteSpace(internalNote)) GarageInternalNotes = internalNote.Trim();
        if (!string.IsNullOrWhiteSpace(customerNote)) CustomerFacingNotes = customerNote.Trim();
        UpdatedByUserId = userId;
        UpdatedAtUtc = DateTime.UtcNow;
        ConcurrencyToken = Guid.NewGuid();
    }

    public void CompleteWork(Guid userId)
    {
        if (Status != ServiceJobStatus.WorkStarted && Status != ServiceJobStatus.WorkInProgress)
            throw new InvalidOperationException($"Cannot complete work in '{Status}' state. Allowed only when 'WorkStarted' or 'WorkInProgress'.");

        ActualWorkCompletedAtUtc = DateTime.UtcNow;
        Status = ServiceJobStatus.WorkCompleted;
        UpdatedByUserId = userId;
        UpdatedAtUtc = DateTime.UtcNow;
        ConcurrencyToken = Guid.NewGuid();
    }

    public void MarkVehicleReady(string? customerNote, Guid userId)
    {
        if (Status != ServiceJobStatus.WorkCompleted)
            throw new InvalidOperationException($"Cannot mark vehicle ready in '{Status}' state. Allowed only when 'WorkCompleted'.");

        VehicleReadyAtUtc = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(customerNote)) CustomerFacingNotes = customerNote.Trim();
        Status = ServiceJobStatus.VehicleReady;
        UpdatedByUserId = userId;
        UpdatedAtUtc = DateTime.UtcNow;
        ConcurrencyToken = Guid.NewGuid();
    }

    public void HandOverVehicle(string? note, Guid userId)
    {
        if (Status != ServiceJobStatus.VehicleReady)
            throw new InvalidOperationException($"Cannot hand over vehicle in '{Status}' state. Allowed only when 'VehicleReady'.");

        HandedOverAtUtc = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(note)) CustomerFacingNotes = note.Trim();
        Status = ServiceJobStatus.HandedOver;
        UpdatedByUserId = userId;
        UpdatedAtUtc = DateTime.UtcNow;
        ConcurrencyToken = Guid.NewGuid();
    }

    public void CloseJob(string? note, Guid userId)
    {
        if (Status != ServiceJobStatus.HandedOver)
            throw new InvalidOperationException($"Cannot close job in '{Status}' state. Allowed only when 'HandedOver'.");

        ClosedAtUtc = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(note)) GarageInternalNotes = note.Trim();
        Status = ServiceJobStatus.Closed;
        UpdatedByUserId = userId;
        UpdatedAtUtc = DateTime.UtcNow;
        ConcurrencyToken = Guid.NewGuid();
    }

    public void Cancel(string reason, Guid userId)
    {
        if (Status != ServiceJobStatus.BookingConfirmed && Status != ServiceJobStatus.Scheduled)
            throw new InvalidOperationException($"Cannot cancel service job in '{Status}' state. Cancellation is permitted only before physical vehicle intake.");

        if (string.IsNullOrWhiteSpace(reason))
            throw new ArgumentException("Cancellation reason is mandatory.", nameof(reason));

        CancelledAtUtc = DateTime.UtcNow;
        CancellationReason = reason.Trim();
        Status = ServiceJobStatus.Cancelled;
        UpdatedByUserId = userId;
        UpdatedAtUtc = DateTime.UtcNow;
        ConcurrencyToken = Guid.NewGuid();
    }
}
