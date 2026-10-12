namespace BroCoMod.Domain.Entities.VehicleMaster;

/// <summary>
/// Logo image uploaded by an admin for a manufacturer. Kept out of the manufacturer row so
/// catalogue queries never load image bytes.
/// </summary>
public class VehicleManufacturerLogo
{
    public Guid ManufacturerId { get; private set; }
    public byte[] Content { get; private set; } = Array.Empty<byte>();
    public string ContentType { get; private set; } = string.Empty;
    public DateTime UpdatedAtUtc { get; private set; } = DateTime.UtcNow;

    protected VehicleManufacturerLogo() { }

    public VehicleManufacturerLogo(Guid manufacturerId, byte[] content, string contentType)
    {
        ManufacturerId = manufacturerId;
        Replace(content, contentType);
    }

    public void Replace(byte[] content, string contentType)
    {
        if (content.Length == 0) throw new ArgumentException("Logo file is empty.", nameof(content));
        Content = content;
        ContentType = contentType;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
