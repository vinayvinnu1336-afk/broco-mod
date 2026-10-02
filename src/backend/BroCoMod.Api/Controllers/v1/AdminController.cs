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
    private readonly ICurrentUserService _currentUserService;

    public AdminController(
        IAdminPortalService adminPortalService,
        IIdentityService identityService,
        ICurrentUserService currentUserService)
    {
        _adminPortalService = adminPortalService;
        _identityService = identityService;
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
}

public record UpdateUserStatusRequest(bool IsActive);
