using BroCoMod.Domain.Common;
using BroCoMod.Domain.Enums;

namespace BroCoMod.Domain.Entities;

public class GarageRequest : BaseEntity
{
    public Guid ServiceRequestId { get; private set; }
    public Guid GarageId { get; private set; }
    public double DistanceKm { get; private set; }
    public GarageRequestStatus Status { get; private set; } = GarageRequestStatus.Pending;

    public DateTime SentAtUtc { get; private set; }
    public DateTime? ViewedAtUtc { get; private set; }
    public DateTime? RespondedAtUtc { get; private set; }
    public DateTime? DeclinedAtUtc { get; private set; }
    public DateTime? ExpiredAtUtc { get; private set; }
    public string? DeclineReason { get; private set; }

    // Navigation properties
    public ServiceRequest ServiceRequest { get; private set; } = default!;
    public Garage Garage { get; private set; } = default!;

    protected GarageRequest() { }

    public GarageRequest(Guid serviceRequestId, Guid garageId, double distanceKm, GarageRequestStatus initialStatus = GarageRequestStatus.Notified)
    {
        if (serviceRequestId == Guid.Empty) throw new ArgumentException("ServiceRequestId cannot be empty.", nameof(serviceRequestId));
        if (garageId == Guid.Empty) throw new ArgumentException("GarageId cannot be empty.", nameof(garageId));
        if (distanceKm < 0) throw new ArgumentOutOfRangeException(nameof(distanceKm), "DistanceKm cannot be negative.");

        ServiceRequestId = serviceRequestId;
        GarageId = garageId;
        DistanceKm = Math.Round(distanceKm, 2);
        Status = initialStatus;
        SentAtUtc = DateTime.UtcNow;
    }

    public void MarkNotified()
    {
        Status = GarageRequestStatus.Notified;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void MarkViewed()
    {
        if (ViewedAtUtc == null)
        {
            ViewedAtUtc = DateTime.UtcNow;
        }

        if (Status == GarageRequestStatus.Pending || Status == GarageRequestStatus.Notified)
        {
            Status = GarageRequestStatus.Viewed;
        }

        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Accept()
    {
        if (Status == GarageRequestStatus.Declined || Status == GarageRequestStatus.Expired)
        {
            throw new InvalidOperationException($"Cannot accept a garage request in '{Status}' state.");
        }

        Status = GarageRequestStatus.Accepted;
        RespondedAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Decline(string reason)
    {
        if (Status == GarageRequestStatus.Accepted || Status == GarageRequestStatus.Expired)
        {
            throw new InvalidOperationException($"Cannot decline a garage request in '{Status}' state.");
        }

        Status = GarageRequestStatus.Declined;
        DeclinedAtUtc = DateTime.UtcNow;
        DeclineReason = reason;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void MarkExpired()
    {
        Status = GarageRequestStatus.Expired;
        ExpiredAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
