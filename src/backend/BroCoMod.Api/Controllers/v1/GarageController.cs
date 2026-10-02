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
    private readonly ICurrentUserService _currentUserService;

    public GarageController(
        IGaragePortalService garagePortalService,
        ICurrentUserService currentUserService)
    {
        _garagePortalService = garagePortalService;
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
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<GarageRequestSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetRequests(CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        var requests = await _garagePortalService.GetRequestsAsync(garageId, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<GarageRequestSummaryDto>>.Ok(requests));
    }

    [HttpGet("quotes")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<GarageQuoteSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetQuotes(CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        var quotes = await _garagePortalService.GetQuotesAsync(garageId, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<GarageQuoteSummaryDto>>.Ok(quotes));
    }
}
