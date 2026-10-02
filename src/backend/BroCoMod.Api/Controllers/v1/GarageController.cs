using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BroCoMod.Api.Controllers.v1;

[ApiController]
[Route("api/v1/garage")]
[Authorize(Roles = $"{AppRoles.GarageOwner},{AppRoles.GarageManager},{AppRoles.GarageStaff},{AppRoles.SuperAdmin}")]
public class GarageController : ControllerBase
{
    private readonly IGaragePortalService _garagePortalService;
    private readonly IServiceRequestService _serviceRequestService;
    private readonly IGarageQuoteService _garageQuoteService;
    private readonly ICurrentUserService _currentUserService;

    public GarageController(
        IGaragePortalService garagePortalService,
        IServiceRequestService serviceRequestService,
        IGarageQuoteService garageQuoteService,
        ICurrentUserService currentUserService)
    {
        _garagePortalService = garagePortalService;
        _serviceRequestService = serviceRequestService;
        _garageQuoteService = garageQuoteService;
        _currentUserService = currentUserService;
    }

    private Guid GetEffectiveGarageId()
    {
        var garageId = _currentUserService.GarageId;
        if (!garageId.HasValue)
        {
            throw new UnauthorizedAccessException("Authenticated user is not linked to any registered garage.");
        }
        return garageId.Value;
    }

    private Guid GetEffectiveUserId()
    {
        return _currentUserService.UserId ?? Guid.Empty;
    }

    [HttpGet("dashboard")]
    [ProducesResponseType(typeof(ApiResponse<GarageDashboardDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDashboard(CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        var dashboard = await _garagePortalService.GetDashboardAsync(garageId, cancellationToken);
        return Ok(ApiResponse<GarageDashboardDto>.Ok(dashboard));
    }

    [HttpGet("profile")]
    [ProducesResponseType(typeof(ApiResponse<GarageProfileDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetProfile(CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        var profile = await _garagePortalService.GetProfileAsync(garageId, cancellationToken);
        return Ok(ApiResponse<GarageProfileDto>.Ok(profile));
    }

    [HttpGet("requests")]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<GarageIncomingRequestDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetRequests(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken cancellationToken = default)
    {
        var garageId = GetEffectiveGarageId();
        var requests = await _serviceRequestService.GetGarageRequestsAsync(garageId, page, pageSize, cancellationToken);
        return Ok(ApiResponse<PagedResult<GarageIncomingRequestDto>>.Ok(requests));
    }

    [HttpGet("requests/{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<GarageIncomingRequestDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetRequestById(Guid id, CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        try
        {
            var request = await _serviceRequestService.GetGarageRequestByIdAsync(garageId, id, cancellationToken);
            return Ok(ApiResponse<GarageIncomingRequestDetailDto>.Ok(request));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
    }

    [HttpGet("quotes")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<GarageQuoteSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetQuotes(
        [FromQuery] string? status = null,
        CancellationToken cancellationToken = default)
    {
        var garageId = GetEffectiveGarageId();
        var quotes = await _garageQuoteService.GetQuotesForGarageAsync(garageId, status, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<GarageQuoteSummaryDto>>.Ok(quotes));
    }

    [HttpGet("quotes/{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<GarageQuoteDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetQuoteById(Guid id, CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        var quote = await _garageQuoteService.GetGarageQuoteDetailAsync(garageId, id, cancellationToken);
        if (quote == null)
        {
            return NotFound(ApiResponse<object>.Fail($"Quote {id} not found."));
        }
        return Ok(ApiResponse<GarageQuoteDetailDto>.Ok(quote));
    }

    [HttpGet("requests/{requestId:guid}/quotes")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<GarageQuoteSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetQuotesForRequest(Guid requestId, CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        var quotes = await _garageQuoteService.GetQuotesForGarageRequestAsync(garageId, requestId, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<GarageQuoteSummaryDto>>.Ok(quotes));
    }

    [HttpPost("quotes/draft")]
    [ProducesResponseType(typeof(ApiResponse<GarageQuoteDetailDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateDraftQuote(
        [FromBody] CreateGarageQuoteRequest request,
        CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        var userId = GetEffectiveUserId();
        try
        {
            var quote = await _garageQuoteService.CreateDraftQuoteAsync(garageId, userId, request, cancellationToken);
            return StatusCode(StatusCodes.Status201Created, ApiResponse<GarageQuoteDetailDto>.Ok(quote, "Quote draft created successfully."));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
    }

    [HttpPut("quotes/{id:guid}/draft")]
    [ProducesResponseType(typeof(ApiResponse<GarageQuoteDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateDraftQuote(
        Guid id,
        [FromBody] UpdateGarageQuoteDraftRequest request,
        CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        var userId = GetEffectiveUserId();
        try
        {
            var quote = await _garageQuoteService.UpdateDraftQuoteAsync(garageId, id, userId, request, cancellationToken);
            return Ok(ApiResponse<GarageQuoteDetailDto>.Ok(quote, "Quote draft updated successfully."));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
    }

    [HttpPost("quotes/{id:guid}/submit")]
    [ProducesResponseType(typeof(ApiResponse<GarageQuoteDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SubmitQuote(
        Guid id,
        [FromBody] SubmitGarageQuoteCommand command,
        CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        var userId = GetEffectiveUserId();
        try
        {
            var quote = await _garageQuoteService.SubmitQuoteAsync(garageId, id, userId, command, cancellationToken);
            return Ok(ApiResponse<GarageQuoteDetailDto>.Ok(quote, "Quote submitted successfully."));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
    }

    [HttpPost("quotes/{id:guid}/revision")]
    [ProducesResponseType(typeof(ApiResponse<GarageQuoteDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateRevision(
        Guid id,
        CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        var userId = GetEffectiveUserId();
        try
        {
            var quote = await _garageQuoteService.CreateRevisionAsync(garageId, id, userId, cancellationToken);
            return Ok(ApiResponse<GarageQuoteDetailDto>.Ok(quote, "Quote revision created successfully in draft mode."));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
    }

    [HttpPost("quotes/{id:guid}/withdraw")]
    [ProducesResponseType(typeof(ApiResponse<GarageQuoteDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> WithdrawQuote(
        Guid id,
        [FromBody] WithdrawGarageQuoteCommand command,
        CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        var userId = GetEffectiveUserId();
        try
        {
            var quote = await _garageQuoteService.WithdrawQuoteAsync(garageId, id, userId, command, cancellationToken);
            return Ok(ApiResponse<GarageQuoteDetailDto>.Ok(quote, "Quote withdrawn successfully."));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
    }

    [HttpGet("confirmed-bookings")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<GarageConfirmedBookingDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetConfirmedBookings(CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        var bookings = await _garagePortalService.GetConfirmedBookingsAsync(garageId, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<GarageConfirmedBookingDto>>.Ok(bookings));
    }
}
