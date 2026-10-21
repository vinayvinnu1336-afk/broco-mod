namespace BroCoMod.Infrastructure.Services.Media;

/// <summary>"Media" configuration section. Every value has a safe default.</summary>
public sealed class MediaOptions
{
    public const string SectionName = "Media";

    /// <summary>Folder for uploaded files. Relative paths are under the API's content root (never wwwroot).</summary>
    public string StoragePath { get; set; } = "data/media";

    /// <summary>HMAC key for signed media links. Empty: derived from Jwt:Secret.</summary>
    public string? SigningKey { get; set; }

    /// <summary>How long a signed link works. Links are rounded to 15-minute steps so browsers can cache them.</summary>
    public int UrlLifetimeMinutes { get; set; } = 60;

    public long MaxPhotoBytes { get; set; } = 10 * 1024 * 1024;
    public long MaxVideoBytes { get; set; } = 100 * 1024 * 1024;
    public long MaxThumbnailBytes { get; set; } = 1024 * 1024;
    public int MaxItemsPerRequest { get; set; } = 30;

    /// <summary>PDFs (old quotations, bills). Customers attach them; they count towards the customer's own limit.</summary>
    public long MaxDocumentBytes { get; set; } = 10 * 1024 * 1024;

    /// <summary>Photos and PDFs a customer can add to one request, on top of the garage and advisor items.</summary>
    public int MaxCustomerItemsPerRequest { get; set; } = 10;

    /// <summary>A garage can remove its own upload (e.g. a wrong photo) for this long; advisors and admins any time.</summary>
    public int GarageDeleteWindowHours { get; set; } = 24;
}
