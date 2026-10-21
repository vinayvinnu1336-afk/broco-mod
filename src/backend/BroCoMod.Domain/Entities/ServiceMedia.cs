using BroCoMod.Domain.Common;

namespace BroCoMod.Domain.Entities;

public enum ServiceMediaKind
{
    Photo = 1,
    Video = 2,
    /// <summary>A PDF, e.g. the customer's old quotation or a bill.</summary>
    Document = 3
}

/// <summary>When in the service the photo or video was taken.</summary>
public enum ServiceMediaStage
{
    Before = 1,
    During = 2,
    After = 3,
    Inspection = 4,
    Other = 5,
    /// <summary>Added by the customer (a dent, a warning light, an old quotation). Only the API sets it, for customer uploads.</summary>
    CustomerUpload = 6
}

/// <summary>
/// A photo or video of the customer's car, attached to a service request (and its job once there is one).
/// The file itself lives in media storage under <see cref="StoragePath"/>; only BroCo-generated names are stored.
/// Deleting only hides the row (<see cref="IsDeleted"/>) so the audit trail still points at something.
/// </summary>
public class ServiceMedia : BaseEntity
{
    public const int MaxCaptionLength = 500;

    public Guid ServiceRequestId { get; private set; }
    public Guid? ServiceJobId { get; private set; }
    public Guid UploadedByUserId { get; private set; }
    public string UploadedByRole { get; private set; } = string.Empty;
    public string UploadedByName { get; private set; } = string.Empty;
    public ServiceMediaKind Kind { get; private set; }
    public string FileName { get; private set; } = string.Empty;
    public string ContentType { get; private set; } = string.Empty;
    public long SizeBytes { get; private set; }
    public string StoragePath { get; private set; } = string.Empty;
    public string? ThumbnailPath { get; private set; }
    public string? ThumbnailContentType { get; private set; }
    public string? Caption { get; private set; }
    public ServiceMediaStage Stage { get; private set; } = ServiceMediaStage.Other;
    public bool IsVisibleToCustomer { get; private set; } = true;
    public bool IsDeleted { get; private set; }
    public DateTime? DeletedAtUtc { get; private set; }
    public Guid? DeletedByUserId { get; private set; }

    public ServiceRequest? ServiceRequest { get; private set; }

    protected ServiceMedia() { }

    public ServiceMedia(
        Guid serviceRequestId,
        Guid? serviceJobId,
        Guid uploadedByUserId,
        string uploadedByRole,
        string uploadedByName,
        ServiceMediaKind kind,
        string fileName,
        string contentType,
        long sizeBytes,
        string storagePath,
        string? caption,
        ServiceMediaStage stage,
        bool isVisibleToCustomer = true)
    {
        if (serviceRequestId == Guid.Empty) throw new ArgumentException("ServiceRequestId cannot be empty.", nameof(serviceRequestId));
        if (uploadedByUserId == Guid.Empty) throw new ArgumentException("UploadedByUserId cannot be empty.", nameof(uploadedByUserId));
        if (string.IsNullOrWhiteSpace(storagePath)) throw new ArgumentException("StoragePath cannot be empty.", nameof(storagePath));
        if (sizeBytes <= 0) throw new ArgumentException("The file is empty.", nameof(sizeBytes));

        ServiceRequestId = serviceRequestId;
        ServiceJobId = serviceJobId;
        UploadedByUserId = uploadedByUserId;
        UploadedByRole = uploadedByRole.Trim();
        UploadedByName = string.IsNullOrWhiteSpace(uploadedByName) ? uploadedByRole : uploadedByName.Trim();
        Kind = kind;
        FileName = SafeDisplayName(fileName);
        ContentType = contentType;
        SizeBytes = sizeBytes;
        StoragePath = storagePath;
        Caption = CleanCaption(caption);
        Stage = stage;
        IsVisibleToCustomer = isVisibleToCustomer;
    }

    public void AttachThumbnail(string storagePath, string contentType)
    {
        ThumbnailPath = storagePath;
        ThumbnailContentType = contentType;
    }

    public void UpdateDetails(string? caption, ServiceMediaStage? stage, bool? isVisibleToCustomer, bool captionProvided)
    {
        if (IsDeleted) throw new InvalidOperationException("This photo or video was deleted.");
        if (captionProvided) Caption = CleanCaption(caption);
        if (stage.HasValue) Stage = stage.Value;
        if (isVisibleToCustomer.HasValue) IsVisibleToCustomer = isVisibleToCustomer.Value;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void MarkDeleted(Guid deletedByUserId)
    {
        if (IsDeleted) return;
        IsDeleted = true;
        DeletedAtUtc = DateTime.UtcNow;
        DeletedByUserId = deletedByUserId;
        UpdatedAtUtc = DeletedAtUtc;
    }

    private static string? CleanCaption(string? caption)
    {
        if (string.IsNullOrWhiteSpace(caption)) return null;
        var trimmed = caption.Trim();
        if (trimmed.Length > MaxCaptionLength)
            throw new ArgumentException($"Caption can be at most {MaxCaptionLength} characters.");
        return trimmed;
    }

    /// <summary>The original name is only ever shown, never used as a path; keep it short and printable.</summary>
    private static string SafeDisplayName(string? fileName)
    {
        var name = Path.GetFileName((fileName ?? string.Empty).Replace('\\', '/'));
        name = new string(name.Where(c => !char.IsControl(c)).ToArray()).Trim();
        if (name.Length == 0) name = "file";
        return name.Length > 200 ? name[^200..] : name;
    }
}
