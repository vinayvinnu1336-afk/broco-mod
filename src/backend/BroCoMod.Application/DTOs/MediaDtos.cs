namespace BroCoMod.Application.DTOs;

/// <summary>
/// A photo or video on a service request. <see cref="Url"/> and <see cref="ThumbnailUrl"/> are short-lived
/// signed links (relative to the API base, e.g. /api/v1/media/{id}/content?exp=..&amp;sig=..) that work in
/// &lt;img&gt; and &lt;video&gt; tags without the bearer token.
/// </summary>
public record ServiceMediaDto(
    Guid Id,
    Guid ServiceRequestId,
    Guid? ServiceJobId,
    string Kind,
    string Stage,
    string? Caption,
    string FileName,
    string ContentType,
    long SizeBytes,
    bool IsVisibleToCustomer,
    string UploadedByRole,
    string UploadedByName,
    DateTime CreatedAtUtc,
    DateTime? UpdatedAtUtc,
    string Url,
    string? ThumbnailUrl,
    DateTime UrlExpiresAtUtc,
    bool CanEdit,
    bool CanDelete);

/// <summary>
/// <see cref="MaxItems"/> and <see cref="RemainingSlots"/> are the caller's own allowance: a customer's photos
/// and PDFs have their own limit, separate from the garage and advisor items.
/// </summary>
public record ServiceMediaListDto(
    Guid ServiceRequestId,
    Guid? ServiceJobId,
    IReadOnlyList<ServiceMediaDto> Items,
    bool CanUpload,
    bool CanEdit,
    int MaxItems,
    int RemainingSlots,
    MediaLimitsDto Limits);

public record MediaLimitsDto(
    long MaxPhotoBytes,
    long MaxVideoBytes,
    IReadOnlyList<string> PhotoExtensions,
    IReadOnlyList<string> VideoExtensions,
    long MaxDocumentBytes,
    IReadOnlyList<string> DocumentExtensions);

/// <summary>Only the fields that are sent are changed.</summary>
public record UpdateServiceMediaRequest(
    string? Caption,
    string? Stage,
    bool? IsVisibleToCustomer);

/// <summary>One uploaded file, already buffered by the API (never trusted: type is re-checked from its bytes).</summary>
public sealed class MediaUploadInput
{
    public required Stream Content { get; init; }
    public required string FileName { get; init; }
    public string? ContentType { get; init; }
    public long Length { get; init; }
    public string? Caption { get; init; }
    public string? Stage { get; init; }
    public bool? IsVisibleToCustomer { get; init; }

    /// <summary>Optional small preview made by the browser (JPEG/PNG/WebP), e.g. a video's first frame.</summary>
    public Stream? Thumbnail { get; init; }
    public string? ThumbnailContentType { get; init; }
    public long ThumbnailLength { get; init; }
}

/// <summary>Where the stream endpoint finds the bytes to send.</summary>
public record MediaContentResult(string LocalPath, string ContentType, string DownloadName);
