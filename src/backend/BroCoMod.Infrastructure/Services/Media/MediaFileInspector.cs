using System.Text;
using BroCoMod.Domain.Entities;

namespace BroCoMod.Infrastructure.Services.Media;

/// <summary>A file type recognised from its first bytes.</summary>
public sealed record DetectedMediaType(ServiceMediaKind Kind, string ContentType, string Extension);

/// <summary>
/// Recognises the allowed photo and video formats from their magic bytes, and checks the name and
/// declared content type the browser sent agree with them. The client's values are never trusted alone.
/// </summary>
public static class MediaFileInspector
{
    /// <summary>Enough bytes for every signature below.</summary>
    public const int HeaderLength = 64;

    public static readonly IReadOnlyList<string> PhotoExtensions = new[] { "jpg", "jpeg", "png", "webp", "heic", "heif" };
    public static readonly IReadOnlyList<string> VideoExtensions = new[] { "mp4", "mov", "webm", "m4v" };

    private static readonly HashSet<string> HeifBrands = new(StringComparer.Ordinal)
    {
        "heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"
    };

    // Which file-name extensions are accepted for each detected type.
    private static readonly Dictionary<string, string[]> ExtensionsByType = new(StringComparer.Ordinal)
    {
        ["image/jpeg"] = new[] { "jpg", "jpeg" },
        ["image/png"] = new[] { "png" },
        ["image/webp"] = new[] { "webp" },
        ["image/heic"] = new[] { "heic", "heif" },
        // MP4 and QuickTime share one container; phones label them loosely, so either name is fine.
        ["video/mp4"] = new[] { "mp4", "m4v", "mov" },
        ["video/quicktime"] = new[] { "mov", "mp4", "m4v" },
        ["video/webm"] = new[] { "webm" },
    };

    private static readonly Dictionary<string, string[]> DeclaredTypesByType = new(StringComparer.Ordinal)
    {
        ["image/jpeg"] = new[] { "image/jpeg", "image/jpg", "image/pjpeg" },
        ["image/png"] = new[] { "image/png" },
        ["image/webp"] = new[] { "image/webp" },
        ["image/heic"] = new[] { "image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence" },
        ["video/mp4"] = new[] { "video/mp4", "video/quicktime", "video/x-m4v" },
        ["video/quicktime"] = new[] { "video/quicktime", "video/mp4", "video/x-m4v" },
        ["video/webm"] = new[] { "video/webm" },
    };

    /// <summary>Recognises the file from its header, or returns null for anything not allowed.</summary>
    public static DetectedMediaType? Detect(ReadOnlySpan<byte> header)
    {
        if (header.Length >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF)
            return new(ServiceMediaKind.Photo, "image/jpeg", ".jpg");

        if (header.Length >= 8 && header[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }))
            return new(ServiceMediaKind.Photo, "image/png", ".png");

        if (header.Length >= 12 && Ascii(header, 0, 4) == "RIFF" && Ascii(header, 8, 4) == "WEBP")
            return new(ServiceMediaKind.Photo, "image/webp", ".webp");

        if (header.Length >= 4 && header[0] == 0x1A && header[1] == 0x45 && header[2] == 0xDF && header[3] == 0xA3)
        {
            // EBML (Matroska family): only the WebM doc type is allowed.
            return Encoding.ASCII.GetString(header).Contains("webm", StringComparison.Ordinal)
                ? new(ServiceMediaKind.Video, "video/webm", ".webm")
                : null;
        }

        if (header.Length >= 12 && Ascii(header, 4, 4) == "ftyp")
        {
            var brand = Ascii(header, 8, 4);
            if (HeifBrands.Contains(brand))
                return new(ServiceMediaKind.Photo, "image/heic", ".heic");
            if (brand.StartsWith("avi", StringComparison.Ordinal))
                return null; // AVIF still images are not on the allowed list
            return brand == "qt  "
                ? new(ServiceMediaKind.Video, "video/quicktime", ".mov")
                : new(ServiceMediaKind.Video, "video/mp4", ".mp4");
        }

        // Older QuickTime files start straight with an atom instead of "ftyp".
        if (header.Length >= 8 && Ascii(header, 4, 4) is "moov" or "mdat" or "wide" or "free" or "skip")
            return new(ServiceMediaKind.Video, "video/quicktime", ".mov");

        return null;
    }

    /// <summary>
    /// Checks a file against the allowed types and limits. Returns the detected type, or an error message
    /// that can be shown to the uploader as is.
    /// </summary>
    public static (DetectedMediaType? Type, string? Error) Validate(
        ReadOnlySpan<byte> header,
        string? fileName,
        string? declaredContentType,
        long length,
        long maxPhotoBytes,
        long maxVideoBytes)
    {
        var displayName = string.IsNullOrWhiteSpace(fileName) ? "This file" : $"\"{Path.GetFileName(fileName)}\"";
        if (length <= 0)
            return (null, $"{displayName} is empty.");

        var extension = Path.GetExtension(fileName ?? string.Empty).TrimStart('.').ToLowerInvariant();
        var allowedList = $"Photos: {string.Join(", ", PhotoExtensions.Where(e => e != "heif"))}. Videos: {string.Join(", ", VideoExtensions.Where(e => e != "m4v"))}.";
        if (!PhotoExtensions.Contains(extension) && !VideoExtensions.Contains(extension))
            return (null, $"{displayName} is not a supported photo or video. {allowedList}");

        var detected = Detect(header);
        if (detected == null || !ExtensionsByType[detected.ContentType].Contains(extension))
            return (null, $"{displayName} is not a real {extension.ToUpperInvariant()} file, or it is damaged. {allowedList}");

        var declared = (declaredContentType ?? string.Empty).Split(';')[0].Trim().ToLowerInvariant();
        // Some browsers send no type (or a generic one) for HEIC and MOV; the bytes and the name decide then.
        var declaredIsGeneric = declared is "" or "application/octet-stream" or "binary/octet-stream";
        if (!declaredIsGeneric && !DeclaredTypesByType[detected.ContentType].Contains(declared))
            return (null, $"{displayName} says it is {declared} but its contents are {detected.ContentType}.");

        var max = detected.Kind == ServiceMediaKind.Photo ? maxPhotoBytes : maxVideoBytes;
        if (length > max)
        {
            var what = detected.Kind == ServiceMediaKind.Photo ? "Photos" : "Videos";
            return (null, $"{displayName} is {FormatSize(length)}. {what} can be up to {FormatSize(max)}.");
        }

        return (detected, null);
    }

    /// <summary>Thumbnails are made by our own web app: small JPEG, PNG or WebP only.</summary>
    public static DetectedMediaType? DetectThumbnail(ReadOnlySpan<byte> header)
    {
        var detected = Detect(header);
        return detected is { Kind: ServiceMediaKind.Photo } && detected.ContentType != "image/heic" ? detected : null;
    }

    public static string FormatSize(long bytes) =>
        bytes >= 1024 * 1024
            ? $"{bytes / (1024d * 1024d):0.#} MB"
            : $"{Math.Max(1, bytes / 1024)} KB";

    private static string Ascii(ReadOnlySpan<byte> bytes, int start, int length) =>
        bytes.Length >= start + length ? Encoding.ASCII.GetString(bytes.Slice(start, length)) : string.Empty;
}
