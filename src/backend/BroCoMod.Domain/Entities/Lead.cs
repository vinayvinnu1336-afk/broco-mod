using BroCoMod.Domain.Common;
using BroCoMod.Domain.Enums;

namespace BroCoMod.Domain.Entities;

/// <summary>
/// A price enquiry from the public website (mobile number + car), for the team to call back.
/// </summary>
public class Lead : BaseEntity
{
    public string MobileNumber { get; private set; } = string.Empty;
    public string City { get; private set; } = string.Empty;
    public Guid? VehicleModelId { get; private set; }
    public string VehicleSummary { get; private set; } = string.Empty;
    public string? FuelType { get; private set; }
    public string? ServiceInterest { get; private set; }
    public string Source { get; private set; } = "website";
    public LeadStatus Status { get; private set; } = LeadStatus.New;
    public string? Notes { get; private set; }

    protected Lead() { }

    public Lead(string mobileNumber, string city, Guid? vehicleModelId, string vehicleSummary, string? fuelType, string? serviceInterest, string source = "website")
    {
        if (string.IsNullOrWhiteSpace(mobileNumber)) throw new ArgumentException("Mobile number is required.", nameof(mobileNumber));
        MobileNumber = mobileNumber.Trim();
        City = city?.Trim() ?? string.Empty;
        VehicleModelId = vehicleModelId;
        VehicleSummary = vehicleSummary?.Trim() ?? string.Empty;
        FuelType = fuelType?.Trim();
        ServiceInterest = serviceInterest?.Trim();
        Source = string.IsNullOrWhiteSpace(source) ? "website" : source.Trim();
    }

    public void Update(LeadStatus status, string? notes)
    {
        Status = status;
        Notes = notes?.Trim();
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
