using BroCoMod.Domain.Common;
using BroCoMod.Domain.Enums;
using NetTopologySuite.Geometries;

namespace BroCoMod.Domain.Entities;

public class ServiceRequest : BaseEntity
{
    public Guid CustomerId { get; private set; }
    public string VehicleMake { get; private set; } = string.Empty;
    public string VehicleModel { get; private set; } = string.Empty;
    public int VehicleYear { get; private set; }
    public string Description { get; private set; } = string.Empty;
    public Point CustomerLocation { get; private set; } = default!;
    public double RadiusKm { get; private set; } = 10.0; // Configurable 10 KM default radius
    public ServiceRequestStatus Status { get; private set; } = ServiceRequestStatus.Submitted;

    // Navigation properties
    public ICollection<GarageQuote> GarageQuotes { get; private set; } = new List<GarageQuote>();
    public CustomerQuotation? CustomerQuotation { get; private set; }

    protected ServiceRequest() { }

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
        CustomerId = customerId;
        VehicleMake = vehicleMake;
        VehicleModel = vehicleModel;
        VehicleYear = vehicleYear;
        Description = description;
        CustomerLocation = new Point(longitude, latitude) { SRID = 4326 };
        RadiusKm = radiusKm > 0 ? radiusKm : 10.0;
        Status = ServiceRequestStatus.Submitted;
    }

    public void MarkNotified()
    {
        Status = ServiceRequestStatus.NotifiedGarages;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void MarkQuotesReceived()
    {
        Status = ServiceRequestStatus.QuotesReceived;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void MarkCustomerQuotationSent()
    {
        Status = ServiceRequestStatus.CustomerQuotationSent;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void AcceptByCustomer()
    {
        Status = ServiceRequestStatus.CustomerAccepted;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void RejectByCustomer()
    {
        Status = ServiceRequestStatus.CustomerRejected;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
