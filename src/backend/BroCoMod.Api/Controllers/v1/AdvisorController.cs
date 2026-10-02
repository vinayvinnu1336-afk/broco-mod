using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BroCoMod.Api.Controllers.v1;

[ApiController]
[Route("api/v1/advisor")]
[Authorize(Roles = $"{AppRoles.Advisor},{AppRoles.SuperAdmin}")]
public class AdvisorController : ControllerBase
{
    private readonly IAdvisorPortalService _advisorPortalService;
    private readonly IServiceRequestService _serviceRequestService;
    private readonly IGarageQuoteService _garageQuoteService;
    private readonly ICurrentUserService _currentUserService;

    public AdvisorController(
        IAdvisorPortalService advisorPortalService,
        IServiceRequestService serviceRequestService,
        IGarageQuoteService garageQuoteService,
        ICurrentUserService currentUserService)
    {
        _advisorPortalService = advisorPortalService;
        _serviceRequestService = serviceRequestService;
        _garageQuoteService = garageQuoteService;
        _currentUserService = currentUserService;
    }

    private Guid GetEffectiveAdvisorId()
    {
        var advisorId = _currentUserService.UserId;
        if (!advisorId.HasValue)
        {
            throw new UnauthorizedAccessException("Authenticated user has no valid advisor profile.");
        }
        return advisorId.Value;
    }

    [HttpGet("dashboard")]
    [ProducesResponseType(typeof(ApiResponse<AdvisorDashboardDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDashboard(CancellationToken cancellationToken)
    {
        var advisorId = GetEffectiveAdvisorId();
        var dashboard = await _advisorPortalService.GetDashboardAsync(advisorId, cancellationToken);
        return Ok(ApiResponse<AdvisorDashboardDto>.Ok(dashboard));
    }

    [HttpGet("profile")]
    [ProducesResponseType(typeof(ApiResponse<AdvisorProfileDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetProfile(CancellationToken cancellationToken)
    {
        var advisorId = GetEffectiveAdvisorId();
        var profile = await _advisorPortalService.GetProfileAsync(advisorId, cancellationToken);
        return Ok(ApiResponse<AdvisorProfileDto>.Ok(profile));
    }

    [HttpGet("requests")]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<AdvisorServiceRequestSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetRequests(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var requests = await _serviceRequestService.GetAdvisorRequestsAsync(page, pageSize, cancellationToken);
        return Ok(ApiResponse<PagedResult<AdvisorServiceRequestSummaryDto>>.Ok(requests));
    }

    [HttpGet("requests/{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<AdvisorServiceRequestDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetRequestById(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var request = await _serviceRequestService.GetAdvisorRequestByIdAsync(id, cancellationToken);
            return Ok(ApiResponse<AdvisorServiceRequestDetailDto>.Ok(request));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
    }

    [HttpGet("quotes")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<AdvisorQuoteSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetQuotes(CancellationToken cancellationToken)
    {
        var quotes = await _advisorPortalService.GetQuotesForReviewAsync(cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<AdvisorQuoteSummaryDto>>.Ok(quotes));
    }

    [HttpGet("garage-quotes")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<AdvisorGarageQuoteSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetGarageQuotes(
        [FromQuery] string? status = null,
        [FromQuery] Guid? serviceRequestId = null,
        CancellationToken cancellationToken = default)
    {
        var quotes = await _garageQuoteService.GetQuotesForAdvisorAsync(status, serviceRequestId, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<AdvisorGarageQuoteSummaryDto>>.Ok(quotes));
    }

    [HttpGet("garage-quotes/{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<AdvisorGarageQuoteDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetGarageQuoteById(Guid id, CancellationToken cancellationToken)
    {
        var quote = await _garageQuoteService.GetAdvisorQuoteDetailAsync(id, cancellationToken);
        if (quote == null)
        {
            return NotFound(ApiResponse<object>.Fail($"Garage quotation {id} not found."));
        }
        return Ok(ApiResponse<AdvisorGarageQuoteDetailDto>.Ok(quote));
    }

    [HttpGet("assignments")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<AdvisorAssignmentSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAssignments(CancellationToken cancellationToken)
    {
        var assignments = await _advisorPortalService.GetRecentAssignmentsAsync(cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<AdvisorAssignmentSummaryDto>>.Ok(assignments));
    }
}
