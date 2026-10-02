using BroCoMod.Domain.Common;

namespace BroCoMod.Domain.Entities;

public class CustomerVehicle : BaseEntity
{
    public Guid CustomerId { get; private set; }
    public string Make { get; private set; } = string.Empty;
    public string Model { get; private set; } = string.Empty;
    public int Year { get; private set; }
    public string LicensePlate { get; private set; } = string.Empty;
    public string Vin { get; private set; } = string.Empty;
    public int Mileage { get; private set; }

    protected CustomerVehicle() { }

    public CustomerVehicle(
        Guid customerId,
        string make,
        string model,
        int year,
        string licensePlate,
        string vin = "",
        int mileage = 0)
    {
        CustomerId = customerId;
        Make = make;
        Model = model;
        Year = year;
        LicensePlate = licensePlate;
        Vin = vin;
        Mileage = mileage;
    }

    public void UpdateMileage(int mileage)
    {
        Mileage = mileage;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
