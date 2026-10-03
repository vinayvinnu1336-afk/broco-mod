using BroCoMod.Domain.Common;
using BroCoMod.Domain.Enums;
using NetTopologySuite.Geometries;

namespace BroCoMod.Domain.Entities;

public class Garage : BaseEntity
{
    public string Name { get; private set; } = string.Empty;
    public string Email { get; private set; } = string.Empty;
    public string PhoneNumber { get; private set; } = string.Empty;
    public string Address { get; private set; } = string.Empty;
    public Point Location { get; private set; } = default!;
    public bool IsActive { get; private set; } = true;
    public bool IsVerified { get; private set; } = true;
    public bool IsOperational { get; private set; } = true;

    // Milestone 9: Operational Verification & Radius Configuration
    public GarageStatus Status { get; private set; } = GarageStatus.Verified;
    public double ServiceRadiusKm { get; private set; } = 10.0;
    public string? StatusReason { get; private set; }
    public DateTime? StatusChangedAtUtc { get; private set; }
    public Guid ConcurrencyToken { get; private set; } = Guid.NewGuid();

    // Navigation properties
    public ICollection<GarageQuote> Quotes { get; private set; } = new List<GarageQuote>();
    public ICollection<GarageRequest> GarageRequests { get; private set; } = new List<GarageRequest>();
    public ICollection<ServiceJob> ServiceJobs { get; private set; } = new List<ServiceJob>();

    protected Garage() { }

    public Garage(
        string name,
        string email,
        string phoneNumber,
        string address,
        double longitude,
        double latitude,
        bool isVerified = true,
        bool isOperational = true,
        GarageStatus? status = null,
        double serviceRadiusKm = 10.0)
    {
        Name = name;
        Email = email;
        PhoneNumber = phoneNumber;
        Address = address;
        // SRID 4326 is WGS84: (X = Longitude, Y = Latitude)
        Location = new Point(longitude, latitude) { SRID = 4326 };
        IsActive = true;
        Status = status ?? (isVerified ? GarageStatus.Verified : GarageStatus.PendingVerification);
        IsVerified = Status == GarageStatus.Verified;
        IsOperational = isOperational;
        ServiceRadiusKm = serviceRadiusKm >= 1.0 && serviceRadiusKm <= 50.0 ? serviceRadiusKm : 10.0;
        StatusChangedAtUtc = DateTime.UtcNow;
    }

    public void UpdateLocation(double longitude, double latitude)
    {
        Location = new Point(longitude, latitude) { SRID = 4326 };
        UpdatedAtUtc = DateTime.UtcNow;
        ConcurrencyToken = Guid.NewGuid();
    }

    public void SetActive(bool active)
    {
        IsActive = active;
        UpdatedAtUtc = DateTime.UtcNow;
        ConcurrencyToken = Guid.NewGuid();
    }

    public void SetVerified(bool verified)
    {
        IsVerified = verified;
        if (verified && Status == GarageStatus.PendingVerification)
        {
            Status = GarageStatus.Verified;
        }
        else if (!verified && Status == GarageStatus.Verified)
        {
            Status = GarageStatus.PendingVerification;
        }
        UpdatedAtUtc = DateTime.UtcNow;
        ConcurrencyToken = Guid.NewGuid();
    }

    public void SetOperational(bool operational)
    {
        IsOperational = operational;
        UpdatedAtUtc = DateTime.UtcNow;
        ConcurrencyToken = Guid.NewGuid();
    }

    public void Verify(Guid adminId)
    {
        if (Status == GarageStatus.Verified)
            throw new InvalidOperationException("Garage is already verified.");
        if (Status == GarageStatus.Inactive)
            throw new InvalidOperationException("Cannot verify an inactive garage. Activate the garage first.");

        Status = GarageStatus.Verified;
        IsVerified = true;
        IsOperational = true;
        IsActive = true;
        StatusReason = null;
        StatusChangedAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
        ConcurrencyToken = Guid.NewGuid();
    }

    public void Suspend(string reason, Guid adminId)
    {
        if (string.IsNullOrWhiteSpace(reason))
            throw new ArgumentException("Suspension reason is required.", nameof(reason));
        if (Status == GarageStatus.Suspended)
            throw new InvalidOperationException("Garage is already suspended.");

        Status = GarageStatus.Suspended;
        IsOperational = false;
        StatusReason = reason.Trim();
        StatusChangedAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
        ConcurrencyToken = Guid.NewGuid();
    }

    public void Activate(Guid adminId)
    {
        if (Status == GarageStatus.Verified && IsActive)
            throw new InvalidOperationException("Garage is already active and verified.");

        Status = GarageStatus.Verified;
        IsActive = true;
        IsOperational = true;
        StatusReason = null;
        StatusChangedAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
        ConcurrencyToken = Guid.NewGuid();
    }

    public void Deactivate(string reason, Guid adminId)
    {
        if (string.IsNullOrWhiteSpace(reason))
            throw new ArgumentException("Deactivation reason is required.", nameof(reason));

        Status = GarageStatus.Inactive;
        IsActive = false;
        IsOperational = false;
        StatusReason = reason.Trim();
        StatusChangedAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
        ConcurrencyToken = Guid.NewGuid();
    }

    public void UpdateServiceRadius(double radiusKm)
    {
        if (radiusKm < 1.0 || radiusKm > 50.0)
            throw new ArgumentOutOfRangeException(nameof(radiusKm), "Service radius must be between 1.0 KM and 50.0 KM.");

        ServiceRadiusKm = radiusKm;
        UpdatedAtUtc = DateTime.UtcNow;
        ConcurrencyToken = Guid.NewGuid();
    }
}
