using BroCoMod.Domain.Common;
using NetTopologySuite.Geometries;

namespace BroCoMod.Domain.Entities;

public class ServiceLocation : BaseEntity
{
    public string AddressLine1 { get; private set; } = string.Empty;
    public string? AddressLine2 { get; private set; }
    public string City { get; private set; } = string.Empty;
    public string State { get; private set; } = string.Empty;
    public string Pincode { get; private set; } = string.Empty;
    public string Country { get; private set; } = "India";
    public Point Location { get; private set; } = default!;
    public double Latitude { get; private set; }
    public double Longitude { get; private set; }

    public string FormattedAddress =>
        string.IsNullOrWhiteSpace(AddressLine2)
            ? $"{AddressLine1}, {City}, {State} {Pincode}, {Country}"
            : $"{AddressLine1}, {AddressLine2}, {City}, {State} {Pincode}, {Country}";

    protected ServiceLocation() { }

    public ServiceLocation(
        string addressLine1,
        string? addressLine2,
        string city,
        string state,
        string pincode,
        double latitude,
        double longitude,
        string country = "India")
    {
        ValidateCoordinates(latitude, longitude);

        AddressLine1 = addressLine1?.Trim() ?? string.Empty;
        AddressLine2 = addressLine2?.Trim();
        City = city?.Trim() ?? string.Empty;
        State = state?.Trim() ?? string.Empty;
        Pincode = pincode?.Trim() ?? string.Empty;
        Country = string.IsNullOrWhiteSpace(country) ? "India" : country.Trim();
        Latitude = latitude;
        Longitude = longitude;
        Location = new Point(longitude, latitude) { SRID = 4326 };
    }

    public void UpdateAddress(
        string addressLine1,
        string? addressLine2,
        string city,
        string state,
        string pincode,
        double latitude,
        double longitude,
        string country = "India")
    {
        ValidateCoordinates(latitude, longitude);

        AddressLine1 = addressLine1.Trim();
        AddressLine2 = addressLine2?.Trim();
        City = city.Trim();
        State = state.Trim();
        Pincode = pincode.Trim();
        Country = string.IsNullOrWhiteSpace(country) ? "India" : country.Trim();
        Latitude = latitude;
        Longitude = longitude;
        Location = new Point(longitude, latitude) { SRID = 4326 };
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public static void ValidateCoordinates(double latitude, double longitude)
    {
        if (double.IsNaN(latitude) || double.IsInfinity(latitude) || latitude < -90.0 || latitude > 90.0)
        {
            throw new ArgumentOutOfRangeException(nameof(latitude), $"Latitude '{latitude}' is invalid. Must be between -90 and +90 degrees.");
        }

        if (double.IsNaN(longitude) || double.IsInfinity(longitude) || longitude < -180.0 || longitude > 180.0)
        {
            throw new ArgumentOutOfRangeException(nameof(longitude), $"Longitude '{longitude}' is invalid. Must be between -180 and +180 degrees.");
        }
    }
}
