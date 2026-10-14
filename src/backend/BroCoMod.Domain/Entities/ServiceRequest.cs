using BroCoMod.Domain.Common;
using BroCoMod.Domain.Entities.Identity;
using BroCoMod.Domain.Enums;
using NetTopologySuite.Geometries;

namespace BroCoMod.Domain.Entities;

public class ServiceRequest : BaseEntity
{
    public string RequestNumber { get; private set; } = string.Empty;
    public Guid CustomerId { get; private set; }
    public Guid? CustomerVehicleId { get; private set; }

    // Snapshot of vehicle at time of request (denormalized for audit & history)
    public string VehicleMake { get; private set; } = string.Empty;
    public string VehicleModel { get; private set; } = string.Empty;
    public int VehicleYear { get; private set; }
    public string VehicleLicensePlate { get; private set; } = string.Empty;

    public Guid? ServiceLocationId { get; private set; }
    public Point CustomerLocation { get; private set; } = default!;
    public double RadiusKm { get; private set; } = 10.0;

    public string ProblemDescription { get; private set; } = string.Empty;
    public string Description => ProblemDescription; // Compatibility alias

    public string ServiceCategory { get; private set; } = "General";
    public DateTime? PreferredServiceDate { get; private set; }

    public ServiceRequestStatus Status { get; private set; } = ServiceRequestStatus.New;
    public Guid? AssignedAdvisorId { get; private set; }

    public DateTime SubmittedAtUtc { get; private set; } = DateTime.UtcNow;
    public DateTime? CancelledAtUtc { get; private set; }
    public string? CancellationReason { get; private set; }
    public string? IdempotencyKey { get; private set; }

    // Fixed-price package booking (Basic / Standard / Premium). Null for quote-based repairs.
    public Guid? ServicePackageId { get; private set; }
    public string? ServicePackageCode { get; private set; }
    public string? ServicePackageName { get; private set; }
    public decimal? PackagePrice { get; private set; }
    public string? VehicleFuel { get; private set; }

    // 10% booking advance collected online by BroCo
    public decimal AdvancePaidAmount { get; private set; }
    public DateTime? AdvancePaidAtUtc { get; private set; }
    public Guid? AdvancePaymentId { get; private set; }

    // Free pick-up & drop: the customer chooses at booking; the garage plans the job around it.
    public bool NeedsPickup { get; private set; }
    public string? PickupNotes { get; private set; }
    public string? PickupSlot { get; private set; }

    public const int PickupNotesMaxLength = 300;
    public const int PickupSlotMaxLength = 30;

    public bool IsPackageBooking => ServicePackageId.HasValue;
    public bool IsAdvancePaid => AdvancePaidAtUtc.HasValue;

    /// <summary>"Yes, Morning 9-12 - Gate 2" or "No, customer drives in": one line for screens and notifications.</summary>
    public string PickupSummary
    {
        get
        {
            if (!NeedsPickup) return "No, customer drives in";
            var parts = new List<string> { "Yes" };
            if (!string.IsNullOrWhiteSpace(PickupSlot)) parts.Add(PickupSlot);
            var summary = string.Join(", ", parts);
            return string.IsNullOrWhiteSpace(PickupNotes) ? summary : $"{summary} - {PickupNotes}";
        }
    }

    // Navigation properties
    public CustomerProfile? CustomerProfile { get; private set; }
    public CustomerVehicle? CustomerVehicle { get; private set; }
    public ServiceLocation? ServiceLocation { get; private set; }
    public AdvisorProfile? AssignedAdvisor { get; private set; }

    public ICollection<GarageRequest> GarageRequests { get; private set; } = new List<GarageRequest>();
    public ICollection<GarageQuote> GarageQuotes { get; private set; } = new List<GarageQuote>();
    public ICollection<GarageAssignment> GarageAssignments { get; private set; } = new List<GarageAssignment>();
    public ICollection<AdvisorRequestNote> AdvisorNotes { get; private set; } = new List<AdvisorRequestNote>();
    public CustomerQuotation? CustomerQuotation { get; private set; }
    public ServiceJob? ServiceJob { get; private set; }
    public ICollection<Notification> Notifications { get; private set; } = new List<Notification>();

    protected ServiceRequest() { }

    // Primary Milestone 4 Constructor
    public ServiceRequest(
        string requestNumber,
        Guid customerId,
        Guid customerVehicleId,
        string vehicleMake,
        string vehicleModel,
        int vehicleYear,
        string vehicleLicensePlate,
        Guid serviceLocationId,
        Point customerLocation,
        string problemDescription,
        string serviceCategory = "General",
        DateTime? preferredServiceDate = null,
        double radiusKm = 10.0,
        string? idempotencyKey = null)
    {
        if (string.IsNullOrWhiteSpace(requestNumber)) throw new ArgumentException("RequestNumber cannot be empty.", nameof(requestNumber));
        if (customerId == Guid.Empty) throw new ArgumentException("CustomerId cannot be empty.", nameof(customerId));
        if (customerLocation == null) throw new ArgumentNullException(nameof(customerLocation));
        if (string.IsNullOrWhiteSpace(problemDescription)) throw new ArgumentException("ProblemDescription cannot be empty.", nameof(problemDescription));

        RequestNumber = requestNumber.Trim().ToUpperInvariant();
        CustomerId = customerId;
        CustomerVehicleId = customerVehicleId;
        VehicleMake = vehicleMake?.Trim() ?? string.Empty;
        VehicleModel = vehicleModel?.Trim() ?? string.Empty;
        VehicleYear = vehicleYear;
        VehicleLicensePlate = vehicleLicensePlate?.Trim().ToUpperInvariant() ?? string.Empty;
        ServiceLocationId = serviceLocationId;
        CustomerLocation = customerLocation;
        RadiusKm = radiusKm > 0 ? radiusKm : 10.0;
        ProblemDescription = problemDescription.Trim();
        ServiceCategory = string.IsNullOrWhiteSpace(serviceCategory) ? "General" : serviceCategory.Trim();
        PreferredServiceDate = preferredServiceDate;
        Status = ServiceRequestStatus.New;
        SubmittedAtUtc = DateTime.UtcNow;
        IdempotencyKey = idempotencyKey?.Trim();
    }

    // Milestone 1 backward compatibility constructor
    public ServiceRequest(
        Guid customerId,
        string vehicleMake,
        string vehicleModel,
        int vehicleYear,
        string description,
        double longitude,
        double latitude,
        double radiusKm = 10.0)
    {
        RequestNumber = $"BM-{Math.Abs(Guid.NewGuid().GetHashCode()) % 900000 + 100000}";
        CustomerId = customerId;
        VehicleMake = vehicleMake;
        VehicleModel = vehicleModel;
        VehicleYear = vehicleYear;
        ProblemDescription = description;
        CustomerLocation = new Point(longitude, latitude) { SRID = 4326 };
        RadiusKm = radiusKm > 0 ? radiusKm : 10.0;
        Status = ServiceRequestStatus.Submitted;
        SubmittedAtUtc = DateTime.UtcNow;
    }

    public void AttachPackage(Guid packageId, string packageCode, string packageName, decimal price, string? vehicleFuel)
    {
        if (packageId == Guid.Empty) throw new ArgumentException("Package is required.", nameof(packageId));
        if (price <= 0) throw new ArgumentException("Package price must be greater than zero.", nameof(price));
        ServicePackageId = packageId;
        ServicePackageCode = packageCode;
        ServicePackageName = packageName;
        PackagePrice = price;
        VehicleFuel = vehicleFuel;
    }

    public void SetVehicleFuel(string? vehicleFuel)
    {
        VehicleFuel = vehicleFuel;
    }

    public void SetPickup(bool needsPickup, string? notes, string? slot)
    {
        var trimmedNotes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        var trimmedSlot = string.IsNullOrWhiteSpace(slot) ? null : slot.Trim();
        if (trimmedNotes != null && trimmedNotes.Length > PickupNotesMaxLength)
            throw new ArgumentException($"Pick-up notes must be at most {PickupNotesMaxLength} characters.", nameof(notes));
        if (trimmedSlot != null && trimmedSlot.Length > PickupSlotMaxLength)
            throw new ArgumentException($"Pick-up slot must be at most {PickupSlotMaxLength} characters.", nameof(slot));

        NeedsPickup = needsPickup;
        // Notes and slot only mean something when the car is picked up.
        PickupNotes = needsPickup ? trimmedNotes : null;
        PickupSlot = needsPickup ? trimmedSlot : null;
    }

    public void RecordAdvancePaid(decimal amount, Guid paymentId, DateTime paidAtUtc)
    {
        if (IsAdvancePaid) return;
        AdvancePaidAmount = amount;
        AdvancePaymentId = paymentId;
        AdvancePaidAtUtc = DateTime.SpecifyKind(paidAtUtc, DateTimeKind.Utc);
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void ClearAdvance()
    {
        AdvancePaidAmount = 0m;
        AdvancePaymentId = null;
        AdvancePaidAtUtc = null;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    // Status Transitions with Validation
    public void AssignAdvisor(Guid advisorId)
    {
        if (Status != ServiceRequestStatus.New && Status != ServiceRequestStatus.Submitted)
        {
            throw new InvalidOperationException($"Cannot transition request in '{Status}' state to '{ServiceRequestStatus.AssignedToAdvisor}'. Allowed only from '{ServiceRequestStatus.New}'.");
        }

        AssignedAdvisorId = advisorId;
        Status = ServiceRequestStatus.AssignedToAdvisor;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    /// <summary>
    /// Records which advisor owns this request without changing its workflow status
    /// (requests are dispatched to garages immediately, so ownership is independent of status).
    /// </summary>
    public void SetResponsibleAdvisor(Guid advisorId)
    {
        if (advisorId == Guid.Empty)
        {
            throw new ArgumentException("Advisor id is required.", nameof(advisorId));
        }

        AssignedAdvisorId = advisorId;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void StartReview()
    {
        if (Status != ServiceRequestStatus.AssignedToAdvisor)
        {
            throw new InvalidOperationException($"Cannot start review on request in '{Status}' state. Allowed only from '{ServiceRequestStatus.AssignedToAdvisor}'.");
        }

        Status = ServiceRequestStatus.UnderReview;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void StartGarageMatching()
    {
        if (Status != ServiceRequestStatus.UnderReview && Status != ServiceRequestStatus.New && Status != ServiceRequestStatus.AssignedToAdvisor)
        {
            throw new InvalidOperationException($"Cannot transition request in '{Status}' state to '{ServiceRequestStatus.GarageMatching}'.");
        }

        Status = ServiceRequestStatus.GarageMatching;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void MarkGaragesNotified()
    {
        if (Status != ServiceRequestStatus.GarageMatching && Status != ServiceRequestStatus.New && Status != ServiceRequestStatus.UnderReview)
        {
            throw new InvalidOperationException($"Cannot transition request in '{Status}' state to '{ServiceRequestStatus.GaragesNotified}'.");
        }

        Status = ServiceRequestStatus.GaragesNotified;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Cancel(string reason)
    {
        if (Status == ServiceRequestStatus.Cancelled)
        {
            throw new InvalidOperationException("Request is already cancelled.");
        }

        if (Status == ServiceRequestStatus.Completed)
        {
            throw new InvalidOperationException("Cannot cancel an already completed request.");
        }

        Status = ServiceRequestStatus.Cancelled;
        CancelledAtUtc = DateTime.UtcNow;
        CancellationReason = string.IsNullOrWhiteSpace(reason) ? "Cancelled by user" : reason.Trim();
        UpdatedAtUtc = DateTime.UtcNow;
    }

    // Milestone 1 legacy compatibility methods
    public void MarkNotified() => MarkGaragesNotified();
    public void MarkQuotesReceived()
    {
        Status = ServiceRequestStatus.QuotesReceived;
        UpdatedAtUtc = DateTime.UtcNow;
    }
    public void TransitionToAdvisorReview()
    {
        if (Status != ServiceRequestStatus.GaragesNotified &&
            Status != ServiceRequestStatus.QuotesReceived &&
            Status != ServiceRequestStatus.UnderReview &&
            Status != ServiceRequestStatus.AdvisorReview)
        {
            throw new InvalidOperationException($"Cannot transition to AdvisorReview from '{Status}'.");
        }

        Status = ServiceRequestStatus.AdvisorReview;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void MarkGarageSelected()
    {
        if (Status != ServiceRequestStatus.QuotesReceived &&
            Status != ServiceRequestStatus.AdvisorReview &&
            Status != ServiceRequestStatus.GaragesNotified &&
            Status != ServiceRequestStatus.UnderReview &&
            Status != ServiceRequestStatus.GarageSelected)
        {
            throw new InvalidOperationException($"Cannot transition to GarageSelected from '{Status}'.");
        }

        Status = ServiceRequestStatus.GarageSelected;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void MarkCustomerQuotationSent()
    {
        Status = ServiceRequestStatus.CustomerQuotationSent;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void AcceptByCustomer()
    {
        Status = ServiceRequestStatus.BookingConfirmed;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void ConfirmBooking()
    {
        Status = ServiceRequestStatus.BookingConfirmed;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void RejectByCustomer(string? reason = null)
    {
        Status = ServiceRequestStatus.CustomerRejected;
        CancellationReason = reason?.Trim();
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
