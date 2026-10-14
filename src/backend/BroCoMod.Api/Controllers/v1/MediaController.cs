using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Net.Http.Headers;

namespace BroCoMod.Api.Controllers.v1;

/// <summary>
/// Photos and videos of the car on a service request (garage, advisor, admin and customer screens).
/// Who may do what is decided per role in <see cref="IServiceMediaService"/>; see docs/architecture/media.md.
/// Files are streamed through short-lived signed links, so &lt;img&gt;/&lt;video&gt; tags work without the bearer token.
/// </summary>
[ApiController]
[Route("api/v1/media")]
[Authorize]
public class MediaController : ControllerBase
{
    /// <summary>One video (100 MB) plus its thumbnail and form fields. Larger bodies are cut off by Kestrel.</summary>
    private const long MaxUploadRequestBytes = 105L * 1024 * 1024;

    private readonly IServiceMediaService _mediaService;

    public MediaController(IServiceMediaService mediaService)
    {
        _mediaService = mediaService;
    }

    [HttpGet("requests/{requestId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<ServiceMediaListDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListForRequest(Guid requestId, CancellationToken cancellationToken)
    {
        var list = await _mediaService.ListForRequestAsync(requestId, cancellationToken);
        return Ok(ApiResponse<ServiceMediaListDto>.Ok(list));
    }

    [HttpGet("jobs/{jobId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<ServiceMediaListDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListForJob(Guid jobId, CancellationToken cancellationToken)
    {
        var list = await _mediaService.ListForJobAsync(jobId, cancellationToken);
        return Ok(ApiResponse<ServiceMediaListDto>.Ok(list));
    }

    /// <summary>
    /// Uploads one photo or video as multipart/form-data: <c>file</c> (required), <c>caption</c>, <c>stage</c>
    /// (Before/During/After/Inspection/Other), <c>isVisibleToCustomer</c>, and an optional small <c>thumbnail</c> image.
    /// </summary>
    [HttpPost("requests/{requestId:guid}")]
    [RequestSizeLimit(MaxUploadRequestBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxUploadRequestBytes)]
    [ProducesResponseType(typeof(ApiResponse<ServiceMediaDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public Task<IActionResult> UploadToRequest(Guid requestId, CancellationToken cancellationToken) =>
        UploadAsync(input => _mediaService.UploadToRequestAsync(requestId, input, cancellationToken), cancellationToken);

    [HttpPost("jobs/{jobId:guid}")]
    [RequestSizeLimit(MaxUploadRequestBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxUploadRequestBytes)]
    [ProducesResponseType(typeof(ApiResponse<ServiceMediaDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public Task<IActionResult> UploadToJob(Guid jobId, CancellationToken cancellationToken) =>
        UploadAsync(input => _mediaService.UploadToJobAsync(jobId, input, cancellationToken), cancellationToken);

    [HttpPatch("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<ServiceMediaDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateServiceMediaRequest request, CancellationToken cancellationToken)
    {
        var media = await _mediaService.UpdateAsync(id, request, cancellationToken);
        return Ok(ApiResponse<ServiceMediaDto>.Ok(media, "Saved."));
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        await _mediaService.DeleteAsync(id, cancellationToken);
        return Ok(ApiResponse<object>.Ok(new { id }, "Deleted."));
    }

    /// <summary>
    /// Streams the file (or its thumbnail with <c>thumb=1</c>) for a signed link from a list response.
    /// Supports HTTP range requests so videos can seek on phones. Bad or expired links get 403.
    /// </summary>
    [HttpGet("{id:guid}/content")]
    [AllowAnonymous]
    [DisableRateLimiting]
    public async Task<IActionResult> Content(
        Guid id,
        [FromQuery] long exp,
        [FromQuery] string? sig,
        [FromQuery] int thumb = 0,
        CancellationToken cancellationToken = default)
    {
        var content = await _mediaService.ResolveSignedContentAsync(id, exp, sig, thumb == 1, cancellationToken);
        if (content == null)
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<object>.Fail("This link has expired or is not valid. Reload the page to see the photo or video."));
        }

        var headers = Response.Headers;
        headers[HeaderNames.CacheControl] = "private, max-age=3600";
        headers[HeaderNames.XContentTypeOptions] = "nosniff";
        headers[HeaderNames.ContentSecurityPolicy] = "default-src 'none'; sandbox";
        headers[HeaderNames.ContentDisposition] = new ContentDispositionHeaderValue("inline") { FileNameStar = content.DownloadName }.ToString();
        return PhysicalFile(content.LocalPath, content.ContentType, enableRangeProcessing: true);
    }

    private async Task<IActionResult> UploadAsync(Func<MediaUploadInput, Task<ServiceMediaDto>> upload, CancellationToken cancellationToken)
    {
        if (!Request.HasFormContentType)
            return BadRequest(ApiResponse<object>.Fail("Send the photo or video as multipart/form-data."));

        IFormCollection form;
        try
        {
            form = await Request.ReadFormAsync(cancellationToken);
        }
        catch (Exception ex) when (ex is BadHttpRequestException or InvalidDataException or IOException)
        {
            // Body larger than the limit, or a broken multipart body.
            return BadRequest(ApiResponse<object>.Fail("The upload is too large or was interrupted. Photos can be up to 10 MB and videos up to 100 MB."));
        }

        var file = form.Files.GetFile("file");
        if (file == null || file.Length == 0)
            return BadRequest(ApiResponse<object>.Fail("Choose a photo or video to upload."));
        var thumbnail = form.Files.GetFile("thumbnail");

        await using var content = file.OpenReadStream();
        await using var thumbnailContent = thumbnail?.OpenReadStream();
        var media = await upload(new MediaUploadInput
        {
            Content = content,
            FileName = file.FileName,
            ContentType = file.ContentType,
            Length = file.Length,
            Caption = form["caption"].FirstOrDefault(),
            Stage = form["stage"].FirstOrDefault(),
            IsVisibleToCustomer = bool.TryParse(form["isVisibleToCustomer"].FirstOrDefault(), out var visible) ? visible : null,
            Thumbnail = thumbnailContent,
            ThumbnailContentType = thumbnail?.ContentType,
            ThumbnailLength = thumbnail?.Length ?? 0,
        });

        return StatusCode(StatusCodes.Status201Created, ApiResponse<ServiceMediaDto>.Ok(media, "Uploaded."));
    }
}
