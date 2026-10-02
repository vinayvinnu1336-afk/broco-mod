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
    private readonly ICurrentUserService _currentUserService;

    public GarageController(
        IGaragePortalService garagePortalService,
        IServiceRequestService serviceRequestService,
        ICurrentUserService currentUserService)
    {
        _garagePortalService = garagePortalService;
        _serviceRequestService = serviceRequestService;
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
    public async Task<IActionResult> GetQuotes(CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        var quotes = await _garagePortalService.GetQuotesAsync(garageId, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<GarageQuoteSummaryDto>>.Ok(quotes));
    }
}
