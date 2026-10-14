using BroCoMod.Application.DTOs;

namespace BroCoMod.Application.Interfaces;

/// <summary>
/// Where photo and video files are kept. Today a folder on local disk (Media:StoragePath); an S3/R2
/// implementation can replace it without touching the rest of the media feature.
/// </summary>
public interface IMediaStorage
{
    /// <summary>Saves the stream under a new BroCo-generated name and returns its storage path (relative, forward slashes).</summary>
    Task<string> SaveAsync(Stream content, string extension, CancellationToken cancellationToken = default);

    /// <summary>Full local path of a stored file, or null when it is missing or the path is not inside the storage root.</summary>
    string? GetLocalPath(string storagePath);

    Task DeleteAsync(string storagePath, CancellationToken cancellationToken = default);
}

/// <summary>Photos and videos on service requests, with per-role access rules (see docs/architecture/media.md).</summary>
public interface IServiceMediaService
{
    Task<ServiceMediaListDto> ListForRequestAsync(Guid serviceRequestId, CancellationToken cancellationToken = default);
    Task<ServiceMediaListDto> ListForJobAsync(Guid serviceJobId, CancellationToken cancellationToken = default);
    Task<ServiceMediaDto> UploadToRequestAsync(Guid serviceRequestId, MediaUploadInput input, CancellationToken cancellationToken = default);
    Task<ServiceMediaDto> UploadToJobAsync(Guid serviceJobId, MediaUploadInput input, CancellationToken cancellationToken = default);
    Task<ServiceMediaDto> UpdateAsync(Guid mediaId, UpdateServiceMediaRequest request, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid mediaId, CancellationToken cancellationToken = default);

    /// <summary>Checks a signed link (no login needed) and returns the file to stream, or null when the link is bad or expired.</summary>
    Task<MediaContentResult?> ResolveSignedContentAsync(Guid mediaId, long expiresUnix, string? signature, bool thumbnail, CancellationToken cancellationToken = default);
}
