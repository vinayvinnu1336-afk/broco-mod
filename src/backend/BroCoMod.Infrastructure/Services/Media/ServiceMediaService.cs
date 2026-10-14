using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Constants;
using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Enums;
using BroCoMod.Domain.Exceptions;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace BroCoMod.Infrastructure.Services.Media;

/// <summary>
/// Photos and videos of the car on a service request.
/// Who can do what:
/// - Super admin and advisors: see, upload, edit (caption, stage, show to customer) and delete everything.
/// - Garage users: see and upload on requests whose job (or active assignment) is at their garage; they can
///   delete their own upload within <see cref="MediaOptions.GarageDeleteWindowHours"/> to fix a mistake.
/// - Customers: see the items on their own requests that are shown to customers. Nothing else.
/// </summary>
public sealed class ServiceMediaService : IServiceMediaService
{
    private const string AuditUploaded = "MEDIA_UPLOADED";
    private const string AuditUpdated = "MEDIA_UPDATED";
    private const string AuditDeleted = "MEDIA_DELETED";
    private const string ContentRoute = "/api/v1/media";

    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;
    private readonly IMediaStorage _storage;
    private readonly MediaUrlSigner _signer;
    private readonly IAuditService _audit;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly MediaOptions _options;
    private readonly ILogger<ServiceMediaService> _logger;

    public ServiceMediaService(
        IApplicationDbContext context,
        ICurrentUserService currentUser,
        IMediaStorage storage,
        MediaUrlSigner signer,
        IAuditService audit,
        IHttpContextAccessor httpContextAccessor,
        IOptions<MediaOptions> options,
        ILogger<ServiceMediaService> logger)
    {
        _context = context;
        _currentUser = currentUser;
        _storage = storage;
        _signer = signer;
        _audit = audit;
        _httpContextAccessor = httpContextAccessor;
        _options = options.Value;
        _logger = logger;
    }

    private enum Viewer { Admin, Advisor, Garage, Customer }

    private sealed record Caller(Viewer Viewer, Guid UserId, string Role, Guid? GarageId)
    {
        public bool IsStaff => Viewer is Viewer.Admin or Viewer.Advisor;
    }

    private sealed record RequestScope(Guid ServiceRequestId, Guid? ServiceJobId);

    #region Queries

    public async Task<ServiceMediaListDto> ListForRequestAsync(Guid serviceRequestId, CancellationToken cancellationToken = default)
    {
        var caller = GetCaller();
        var scope = await AuthorizeRequestAsync(caller, serviceRequestId, cancellationToken);
        return await BuildListAsync(caller, scope, cancellationToken);
    }

    public async Task<ServiceMediaListDto> ListForJobAsync(Guid serviceJobId, CancellationToken cancellationToken = default)
    {
        var caller = GetCaller();
        var scope = await AuthorizeJobAsync(caller, serviceJobId, cancellationToken);
        return await BuildListAsync(caller, scope, cancellationToken);
    }

    private async Task<ServiceMediaListDto> BuildListAsync(Caller caller, RequestScope scope, CancellationToken ct)
    {
        var query = _context.ServiceMediaFiles.AsNoTracking()
            .Where(m => m.ServiceRequestId == scope.ServiceRequestId && !m.IsDeleted);
        if (caller.Viewer == Viewer.Customer)
            query = query.Where(m => m.IsVisibleToCustomer);

        var items = await query.OrderBy(m => m.CreatedAtUtc).ToListAsync(ct);
        var canUpload = caller.Viewer != Viewer.Customer;

        return new ServiceMediaListDto(
            scope.ServiceRequestId,
            scope.ServiceJobId,
            items.Select(m => ToDto(m, caller)).ToList(),
            canUpload,
            caller.IsStaff,
            _options.MaxItemsPerRequest,
            canUpload ? Math.Max(0, _options.MaxItemsPerRequest - items.Count) : 0,
            new MediaLimitsDto(_options.MaxPhotoBytes, _options.MaxVideoBytes, MediaFileInspector.PhotoExtensions, MediaFileInspector.VideoExtensions));
    }

    public async Task<MediaContentResult?> ResolveSignedContentAsync(Guid mediaId, long expiresUnix, string? signature, bool thumbnail, CancellationToken cancellationToken = default)
    {
        // The audience is part of the signature; it is passed through the signature string as "aud:sig".
        var parts = (signature ?? string.Empty).Split(':', 2);
        if (parts.Length != 2 || !_signer.IsValid(mediaId, expiresUnix, parts[0], parts[1]))
            return null;

        var media = await _context.ServiceMediaFiles.AsNoTracking().FirstOrDefaultAsync(m => m.Id == mediaId, cancellationToken);
        if (media == null || media.IsDeleted) return null;
        if (parts[0] == MediaUrlSigner.CustomerAudience && !media.IsVisibleToCustomer) return null;

        var useThumbnail = thumbnail && media.ThumbnailPath != null;
        var path = _storage.GetLocalPath(useThumbnail ? media.ThumbnailPath! : media.StoragePath);
        if (path == null)
        {
            _logger.LogWarning("Media file for {MediaId} is missing from storage", mediaId);
            return null;
        }

        var contentType = useThumbnail ? media.ThumbnailContentType ?? "image/jpeg" : media.ContentType;
        return new MediaContentResult(path, contentType, media.FileName);
    }

    #endregion

    #region Commands

    public async Task<ServiceMediaDto> UploadToRequestAsync(Guid serviceRequestId, MediaUploadInput input, CancellationToken cancellationToken = default)
    {
        var caller = GetCaller();
        var scope = await AuthorizeRequestAsync(caller, serviceRequestId, cancellationToken);
        return await UploadAsync(caller, scope, input, cancellationToken);
    }

    public async Task<ServiceMediaDto> UploadToJobAsync(Guid serviceJobId, MediaUploadInput input, CancellationToken cancellationToken = default)
    {
        var caller = GetCaller();
        var scope = await AuthorizeJobAsync(caller, serviceJobId, cancellationToken);
        return await UploadAsync(caller, scope, input, cancellationToken);
    }

    private async Task<ServiceMediaDto> UploadAsync(Caller caller, RequestScope scope, MediaUploadInput input, CancellationToken ct)
    {
        if (caller.Viewer == Viewer.Customer)
            throw new UnauthorizedAccessException("Customers can view photos and videos but not upload them.");

        var existing = await _context.ServiceMediaFiles.CountAsync(m => m.ServiceRequestId == scope.ServiceRequestId && !m.IsDeleted, ct);
        if (existing >= _options.MaxItemsPerRequest)
            throw new ArgumentException($"This request already has {_options.MaxItemsPerRequest} photos and videos, the most allowed. Delete one to add another.");

        var stage = ParseStage(input.Stage) ?? ServiceMediaStage.Other;
        var header = await ReadHeaderAsync(input.Content, ct);
        var (type, error) = MediaFileInspector.Validate(header, input.FileName, input.ContentType, input.Length, _options.MaxPhotoBytes, _options.MaxVideoBytes);
        if (type == null)
            throw new ArgumentException(error);

        var uploaderName = await _context.Users.AsNoTracking()
            .Where(u => u.Id == caller.UserId)
            .Select(u => u.FullName)
            .FirstOrDefaultAsync(ct) ?? caller.Role;

        var storagePath = await _storage.SaveAsync(input.Content, type.Extension, ct);
        string? thumbnailPath = null;
        try
        {
            // Anything that fails from here (e.g. a caption that is too long) removes the saved files again.
            var media = new ServiceMedia(
                scope.ServiceRequestId,
                scope.ServiceJobId,
                caller.UserId,
                caller.Role,
                uploaderName,
                type.Kind,
                input.FileName,
                type.ContentType,
                input.Length,
                storagePath,
                input.Caption,
                stage,
                input.IsVisibleToCustomer ?? true);

            var thumbnail = await SaveThumbnailAsync(input, ct);
            if (thumbnail != null)
            {
                thumbnailPath = thumbnail.Value.Path;
                media.AttachThumbnail(thumbnail.Value.Path, thumbnail.Value.ContentType);
            }

            _context.ServiceMediaFiles.Add(media);
            await _context.SaveChangesAsync(ct);

            await AuditAsync(AuditUploaded, media,
                $"{media.Kind} {media.ContentType} {media.SizeBytes} bytes on request {media.ServiceRequestId}; stage {media.Stage}; visible to customer: {media.IsVisibleToCustomer}", ct);
            return ToDto(media, caller);
        }
        catch
        {
            await _storage.DeleteAsync(storagePath, CancellationToken.None);
            if (thumbnailPath != null) await _storage.DeleteAsync(thumbnailPath, CancellationToken.None);
            throw;
        }
    }

    public async Task<ServiceMediaDto> UpdateAsync(Guid mediaId, UpdateServiceMediaRequest request, CancellationToken cancellationToken = default)
    {
        var caller = GetCaller();
        var media = await FindAuthorizedAsync(caller, mediaId, cancellationToken);
        if (!caller.IsStaff)
            throw new UnauthorizedAccessException("Only BroCo advisors and admins can edit photos and videos.");

        ServiceMediaStage? stage = null;
        if (!string.IsNullOrWhiteSpace(request.Stage))
            stage = ParseStage(request.Stage) ?? throw new ArgumentException($"Unknown stage \"{request.Stage}\". Use Before, During, After, Inspection or Other.");

        var before = $"caption \"{media.Caption}\", stage {media.Stage}, visible {media.IsVisibleToCustomer}";
        media.UpdateDetails(request.Caption, stage, request.IsVisibleToCustomer, captionProvided: request.Caption != null);
        await _context.SaveChangesAsync(cancellationToken);

        await AuditAsync(AuditUpdated, media,
            $"From {before} to caption \"{media.Caption}\", stage {media.Stage}, visible {media.IsVisibleToCustomer}", cancellationToken);
        return ToDto(media, caller);
    }

    public async Task DeleteAsync(Guid mediaId, CancellationToken cancellationToken = default)
    {
        var caller = GetCaller();
        var media = await FindAuthorizedAsync(caller, mediaId, cancellationToken);
        if (!CanDelete(media, caller))
        {
            throw new UnauthorizedAccessException(caller.Viewer == Viewer.Garage
                ? $"You can remove your own uploads for {_options.GarageDeleteWindowHours} hours. Ask your BroCo advisor to remove this one."
                : "You cannot delete this photo or video.");
        }

        media.MarkDeleted(caller.UserId);
        await _context.SaveChangesAsync(cancellationToken);
        await AuditAsync(AuditDeleted, media, $"{media.Kind} \"{media.FileName}\" on request {media.ServiceRequestId}", cancellationToken);
    }

    #endregion

    #region Access

    private Caller GetCaller()
    {
        var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Please sign in again.");
        if (_currentUser.IsInRole(AppRoles.SuperAdmin)) return new Caller(Viewer.Admin, userId, AppRoles.SuperAdmin, null);
        if (_currentUser.IsInRole(AppRoles.Advisor)) return new Caller(Viewer.Advisor, userId, AppRoles.Advisor, null);

        var garageRole = _currentUser.Roles.FirstOrDefault(AppRoles.IsGarageRole);
        if (garageRole != null)
        {
            var garageId = _currentUser.GarageId ?? throw new UnauthorizedAccessException("Your account is not linked to a garage.");
            return new Caller(Viewer.Garage, userId, garageRole, garageId);
        }

        if (_currentUser.IsInRole(AppRoles.Customer)) return new Caller(Viewer.Customer, userId, AppRoles.Customer, null);
        throw new UnauthorizedAccessException("You do not have access to photos and videos.");
    }

    private async Task<RequestScope> AuthorizeRequestAsync(Caller caller, Guid serviceRequestId, CancellationToken ct)
    {
        var request = await _context.ServiceRequests.AsNoTracking()
            .Where(sr => sr.Id == serviceRequestId)
            .Select(sr => new
            {
                sr.Id,
                sr.CustomerId,
                JobId = sr.ServiceJob != null ? (Guid?)sr.ServiceJob.Id : null,
                JobGarageId = sr.ServiceJob != null ? (Guid?)sr.ServiceJob.GarageId : null,
                AssignedGarageIds = sr.GarageAssignments
                    .Where(ga => ga.Status == GarageAssignmentStatus.Assigned || ga.Status == GarageAssignmentStatus.Confirmed)
                    .Select(ga => ga.GarageId)
                    .ToList()
            })
            .FirstOrDefaultAsync(ct)
            ?? throw new KeyNotFoundException("Service request not found.");

        switch (caller.Viewer)
        {
            case Viewer.Admin:
            case Viewer.Advisor:
                break;
            case Viewer.Garage:
                var atThisGarage = request.JobGarageId.HasValue
                    ? request.JobGarageId == caller.GarageId
                    : request.AssignedGarageIds.Contains(caller.GarageId!.Value);
                if (!atThisGarage)
                    throw new DataIsolationViolationException("Garages can only see photos and videos of their own jobs.");
                break;
            case Viewer.Customer:
                var profileId = await CurrentCustomerProfileIdAsync(caller, ct);
                if (profileId != request.CustomerId)
                    throw new DataIsolationViolationException("Customers can only see photos and videos of their own requests.");
                break;
        }

        return new RequestScope(request.Id, request.JobId);
    }

    private async Task<RequestScope> AuthorizeJobAsync(Caller caller, Guid serviceJobId, CancellationToken ct)
    {
        var requestId = await _context.ServiceJobs.AsNoTracking()
            .Where(j => j.Id == serviceJobId)
            .Select(j => (Guid?)j.ServiceRequestId)
            .FirstOrDefaultAsync(ct)
            ?? throw new KeyNotFoundException("Service job not found.");
        return await AuthorizeRequestAsync(caller, requestId, ct);
    }

    /// <summary>Loads a media item the caller is allowed to see; anything else reads as "not found".</summary>
    private async Task<ServiceMedia> FindAuthorizedAsync(Caller caller, Guid mediaId, CancellationToken ct)
    {
        var media = await _context.ServiceMediaFiles.FirstOrDefaultAsync(m => m.Id == mediaId && !m.IsDeleted, ct)
            ?? throw new KeyNotFoundException("Photo or video not found.");
        await AuthorizeRequestAsync(caller, media.ServiceRequestId, ct);
        if (caller.Viewer == Viewer.Customer)
        {
            if (!media.IsVisibleToCustomer) throw new KeyNotFoundException("Photo or video not found.");
            throw new UnauthorizedAccessException("Customers can view photos and videos but not change them.");
        }
        return media;
    }

    private async Task<Guid?> CurrentCustomerProfileIdAsync(Caller caller, CancellationToken ct)
    {
        var fromClaim = _currentUser.CustomerId;
        var profileId = await _context.CustomerProfiles.AsNoTracking()
            .Where(cp => cp.UserId == caller.UserId)
            .Select(cp => (Guid?)cp.Id)
            .FirstOrDefaultAsync(ct);
        return profileId ?? fromClaim;
    }

    private bool CanDelete(ServiceMedia media, Caller caller) =>
        caller.IsStaff
        || (caller.Viewer == Viewer.Garage
            && media.UploadedByUserId == caller.UserId
            && media.CreatedAtUtc >= DateTime.UtcNow.AddHours(-_options.GarageDeleteWindowHours));

    #endregion

    #region Helpers

    private ServiceMediaDto ToDto(ServiceMedia media, Caller caller)
    {
        var expires = _signer.NextExpiry();
        var exp = expires.ToUnixTimeSeconds();
        var audience = caller.Viewer == Viewer.Customer ? MediaUrlSigner.CustomerAudience : MediaUrlSigner.StaffAudience;
        var sig = $"{audience}:{_signer.Sign(media.Id, exp, audience)}";
        var url = $"{ContentRoute}/{media.Id}/content?exp={exp}&sig={Uri.EscapeDataString(sig)}";

        return new ServiceMediaDto(
            media.Id,
            media.ServiceRequestId,
            media.ServiceJobId,
            media.Kind.ToString(),
            media.Stage.ToString(),
            media.Caption,
            media.FileName,
            media.ContentType,
            media.SizeBytes,
            media.IsVisibleToCustomer,
            RoleLabel(media.UploadedByRole),
            caller.Viewer == Viewer.Customer ? RoleLabel(media.UploadedByRole) : media.UploadedByName,
            media.CreatedAtUtc,
            media.UpdatedAtUtc,
            url,
            media.ThumbnailPath != null ? $"{url}&thumb=1" : null,
            expires.UtcDateTime,
            caller.IsStaff,
            CanDelete(media, caller));
    }

    private static string RoleLabel(string role) => role switch
    {
        AppRoles.SuperAdmin => "BroCo team",
        AppRoles.Advisor => "BroCo advisor",
        _ when AppRoles.IsGarageRole(role) => "Garage",
        _ => "BroCo",
    };

    private static ServiceMediaStage? ParseStage(string? value) =>
        Enum.TryParse<ServiceMediaStage>(value?.Trim(), ignoreCase: true, out var stage) && Enum.IsDefined(stage) ? stage : null;

    private static async Task<byte[]> ReadHeaderAsync(Stream stream, CancellationToken ct)
    {
        if (!stream.CanSeek) throw new InvalidOperationException("Upload stream must be seekable.");
        stream.Position = 0;
        var buffer = new byte[MediaFileInspector.HeaderLength];
        var read = 0;
        while (read < buffer.Length)
        {
            var n = await stream.ReadAsync(buffer.AsMemory(read), ct);
            if (n == 0) break;
            read += n;
        }
        stream.Position = 0;
        return buffer[..read];
    }

    private async Task<(string Path, string ContentType)?> SaveThumbnailAsync(MediaUploadInput input, CancellationToken ct)
    {
        if (input.Thumbnail == null || input.ThumbnailLength <= 0) return null;
        if (input.ThumbnailLength > _options.MaxThumbnailBytes)
        {
            _logger.LogInformation("Ignored a {Size} byte media thumbnail (too big)", input.ThumbnailLength);
            return null;
        }

        var header = await ReadHeaderAsync(input.Thumbnail, ct);
        var type = MediaFileInspector.DetectThumbnail(header);
        if (type == null)
        {
            _logger.LogInformation("Ignored a media thumbnail that is not JPEG, PNG or WebP");
            return null;
        }

        return (await _storage.SaveAsync(input.Thumbnail, type.Extension, ct), type.ContentType);
    }

    private Task AuditAsync(string action, ServiceMedia media, string details, CancellationToken ct) =>
        _audit.LogAsync(
            action,
            _currentUser.UserId,
            _currentUser.Email,
            nameof(ServiceMedia),
            media.Id.ToString(),
            details,
            _httpContextAccessor.HttpContext?.Connection.RemoteIpAddress?.ToString(),
            ct);

    #endregion
}
