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
    private readonly ICurrentUserService _currentUserService;

    public AdvisorController(
        IAdvisorPortalService advisorPortalService,
        ICurrentUserService currentUserService)
    {
        _advisorPortalService = advisorPortalService;
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
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<AdvisorRequestSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetRequests(CancellationToken cancellationToken)
    {
        var requests = await _advisorPortalService.GetRequestsUnderReviewAsync(cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<AdvisorRequestSummaryDto>>.Ok(requests));
    }

    [HttpGet("quotes")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<AdvisorQuoteSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetQuotes(CancellationToken cancellationToken)
    {
        var quotes = await _advisorPortalService.GetQuotesForReviewAsync(cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<AdvisorQuoteSummaryDto>>.Ok(quotes));
    }

    [HttpGet("assignments")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<AdvisorAssignmentSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAssignments(CancellationToken cancellationToken)
    {
        var assignments = await _advisorPortalService.GetRecentAssignmentsAsync(cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<AdvisorAssignmentSummaryDto>>.Ok(assignments));
    }
}
