using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BroCoMod.Api.Controllers.v1;

[ApiController]
[Route("api/v1/admin")]
[Authorize(Roles = AppRoles.SuperAdmin)]
public class AdminController : ControllerBase
{
    private readonly IAdminPortalService _adminPortalService;
    private readonly IIdentityService _identityService;
    private readonly IServiceRequestService _serviceRequestService;
    private readonly ICurrentUserService _currentUserService;

    public AdminController(
        IAdminPortalService adminPortalService,
        IIdentityService identityService,
        IServiceRequestService serviceRequestService,
        ICurrentUserService currentUserService)
    {
        _adminPortalService = adminPortalService;
        _identityService = identityService;
        _serviceRequestService = serviceRequestService;
        _currentUserService = currentUserService;
    }

    [HttpGet("dashboard")]
    [ProducesResponseType(typeof(ApiResponse<AdminDashboardDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDashboard(CancellationToken cancellationToken)
    {
        var dashboard = await _adminPortalService.GetDashboardAsync(cancellationToken);
        return Ok(ApiResponse<AdminDashboardDto>.Ok(dashboard));
    }

    [HttpGet("users")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<AdminUserSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetUsers(CancellationToken cancellationToken)
    {
        var users = await _adminPortalService.GetUsersAsync(cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<AdminUserSummaryDto>>.Ok(users));
    }

    [HttpPost("users/{id:guid}/status")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    public async Task<IActionResult> SetUserStatus(Guid id, [FromBody] UpdateUserStatusRequest request, CancellationToken cancellationToken)
    {
        var adminId = _currentUserService.UserId ?? Guid.Empty;
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        await _identityService.SetUserActiveStatusAsync(id, request.IsActive, adminId, ipAddress, cancellationToken);
        return Ok(ApiResponse<bool>.Ok(true, $"User status updated to {(request.IsActive ? "Active" : "Suspended")}."));
    }

    [HttpGet("garages")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<AdminGarageSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetGarages(CancellationToken cancellationToken)
    {
        var garages = await _adminPortalService.GetGaragesAsync(cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<AdminGarageSummaryDto>>.Ok(garages));
    }

    [HttpGet("advisors")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<AdminAdvisorSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAdvisors(CancellationToken cancellationToken)
    {
        var advisors = await _adminPortalService.GetAdvisorsAsync(cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<AdminAdvisorSummaryDto>>.Ok(advisors));
    }

    [HttpGet("audit")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<AdminAuditLogSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAuditLogs([FromQuery] int limit = 50, CancellationToken cancellationToken = default)
    {
        var logs = await _adminPortalService.GetAuditLogsAsync(limit, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<AdminAuditLogSummaryDto>>.Ok(logs));
    }

    [HttpGet("settings")]
    [ProducesResponseType(typeof(ApiResponse<AdminSettingsDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSettings(CancellationToken cancellationToken)
    {
        var settings = await _adminPortalService.GetSettingsAsync(cancellationToken);
        return Ok(ApiResponse<AdminSettingsDto>.Ok(settings));
    }

    [HttpGet("requests")]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<AdminServiceRequestSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetRequests(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var requests = await _serviceRequestService.GetAdminRequestsAsync(page, pageSize, cancellationToken);
        return Ok(ApiResponse<PagedResult<AdminServiceRequestSummaryDto>>.Ok(requests));
    }

    [HttpGet("requests/{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<AdminServiceRequestDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetRequestById(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var request = await _serviceRequestService.GetAdminRequestByIdAsync(id, cancellationToken);
            return Ok(ApiResponse<AdminServiceRequestDetailDto>.Ok(request));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
    }
}

public record UpdateUserStatusRequest(bool IsActive);
