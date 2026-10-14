using BroCoMod.Application.Interfaces;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace BroCoMod.Infrastructure.Services.Media;

/// <summary>
/// Keeps media files in a folder on the API server (in Docker: the broco-mod-media volume).
/// Files are stored as yyyy/MM/{random}.{ext}; client file names never reach the disk.
/// </summary>
public sealed class LocalDiskMediaStorage : IMediaStorage
{
    private readonly string _root;
    private readonly ILogger<LocalDiskMediaStorage> _logger;

    public LocalDiskMediaStorage(IOptions<MediaOptions> options, IHostEnvironment environment, ILogger<LocalDiskMediaStorage> logger)
    {
        _logger = logger;
        var configured = string.IsNullOrWhiteSpace(options.Value.StoragePath) ? "data/media" : options.Value.StoragePath;
        _root = Path.GetFullPath(Path.IsPathRooted(configured) ? configured : Path.Combine(environment.ContentRootPath, configured));
    }

    public string RootPath => _root;

    public async Task<string> SaveAsync(Stream content, string extension, CancellationToken cancellationToken = default)
    {
        var ext = extension.StartsWith('.') ? extension : $".{extension}";
        if (ext.Length > 6 || ext.Skip(1).Any(c => !char.IsAsciiLetterOrDigit(c)))
            throw new ArgumentException("Invalid file extension.");

        var now = DateTime.UtcNow;
        var relative = $"{now:yyyy}/{now:MM}/{Guid.NewGuid():N}{ext.ToLowerInvariant()}";
        var fullPath = Path.Combine(_root, relative.Replace('/', Path.DirectorySeparatorChar));
        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);

        try
        {
            await using var target = new FileStream(fullPath, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, useAsync: true);
            await content.CopyToAsync(target, cancellationToken);
        }
        catch
        {
            TryDelete(fullPath);
            throw;
        }

        return relative;
    }

    public string? GetLocalPath(string storagePath)
    {
        var fullPath = Resolve(storagePath);
        return fullPath != null && File.Exists(fullPath) ? fullPath : null;
    }

    public Task DeleteAsync(string storagePath, CancellationToken cancellationToken = default)
    {
        var fullPath = Resolve(storagePath);
        if (fullPath != null) TryDelete(fullPath);
        return Task.CompletedTask;
    }

    /// <summary>Maps a stored relative path to disk, refusing anything that would land outside the root.</summary>
    private string? Resolve(string storagePath)
    {
        if (string.IsNullOrWhiteSpace(storagePath) || Path.IsPathRooted(storagePath)) return null;
        var fullPath = Path.GetFullPath(Path.Combine(_root, storagePath.Replace('/', Path.DirectorySeparatorChar)));
        var rootWithSeparator = _root.EndsWith(Path.DirectorySeparatorChar) ? _root : _root + Path.DirectorySeparatorChar;
        return fullPath.StartsWith(rootWithSeparator, StringComparison.OrdinalIgnoreCase) ? fullPath : null;
    }

    private void TryDelete(string fullPath)
    {
        try
        {
            if (File.Exists(fullPath)) File.Delete(fullPath);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not delete media file {Path}", fullPath);
        }
    }
}
