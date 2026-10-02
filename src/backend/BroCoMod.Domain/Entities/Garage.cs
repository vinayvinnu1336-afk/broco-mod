using BroCoMod.Domain.Common;
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
        bool isOperational = true)
    {
        Name = name;
        Email = email;
        PhoneNumber = phoneNumber;
        Address = address;
        // SRID 4326 is WGS84: (X = Longitude, Y = Latitude)
        Location = new Point(longitude, latitude) { SRID = 4326 };
        IsActive = true;
        IsVerified = isVerified;
        IsOperational = isOperational;
    }

    public void UpdateLocation(double longitude, double latitude)
    {
        Location = new Point(longitude, latitude) { SRID = 4326 };
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void SetActive(bool active)
    {
        IsActive = active;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void SetVerified(bool verified)
    {
        IsVerified = verified;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void SetOperational(bool operational)
    {
        IsOperational = operational;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
