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
