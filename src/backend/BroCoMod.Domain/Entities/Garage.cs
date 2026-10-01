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

    // Navigation properties
    public ICollection<GarageQuote> Quotes { get; private set; } = new List<GarageQuote>();

    protected Garage() { }

    public Garage(string name, string email, string phoneNumber, string address, double longitude, double latitude)
    {
        Name = name;
        Email = email;
        PhoneNumber = phoneNumber;
        Address = address;
        // SRID 4326 is WGS84: (X = Longitude, Y = Latitude)
        Location = new Point(longitude, latitude) { SRID = 4326 };
        IsActive = true;
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
}
