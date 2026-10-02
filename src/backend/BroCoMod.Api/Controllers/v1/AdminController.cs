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
    private readonly IGarageQuoteService _garageQuoteService;
    private readonly IAdvisorQuotationService _advisorQuotationService;
    private readonly ICustomerQuotationService _customerQuotationService;
    private readonly ICustomerDecisionService _customerDecisionService;
    private readonly ICurrentUserService _currentUserService;

    public AdminController(
        IAdminPortalService adminPortalService,
        IIdentityService identityService,
        IServiceRequestService serviceRequestService,
        IGarageQuoteService garageQuoteService,
        IAdvisorQuotationService advisorQuotationService,
        ICustomerQuotationService customerQuotationService,
        ICustomerDecisionService customerDecisionService,
        ICurrentUserService currentUserService)
    {
        _adminPortalService = adminPortalService;
        _identityService = identityService;
        _serviceRequestService = serviceRequestService;
        _garageQuoteService = garageQuoteService;
        _advisorQuotationService = advisorQuotationService;
        _customerQuotationService = customerQuotationService;
        _customerDecisionService = customerDecisionService;
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

    [HttpGet("garage-quotes")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<AdminGarageQuoteSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetGarageQuotes(
        [FromQuery] string? status = null,
        [FromQuery] Guid? garageId = null,
        [FromQuery] Guid? serviceRequestId = null,
        CancellationToken cancellationToken = default)
    {
        var quotes = await _garageQuoteService.GetAllQuotesForAdminAsync(status, garageId, serviceRequestId, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<AdminGarageQuoteSummaryDto>>.Ok(quotes));
    }

    [HttpGet("garage-quotes/{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<AdminGarageQuoteDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetGarageQuoteById(Guid id, CancellationToken cancellationToken)
    {
        var quote = await _garageQuoteService.GetAdminQuoteDetailAsync(id, cancellationToken);
        if (quote == null)
        {
            return NotFound(ApiResponse<object>.Fail($"Garage quotation {id} not found."));
        }
        return Ok(ApiResponse<AdminGarageQuoteDetailDto>.Ok(quote));
    }

    [HttpGet("assignments")]
    [ProducesResponseType(typeof(ApiResponse<List<GarageAssignmentDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAssignments(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var result = await _advisorQuotationService.GetAllAssignmentsAsync(page, pageSize, cancellationToken);
        return Ok(result);
    }

    [HttpGet("customer-quotations")]
    [ProducesResponseType(typeof(ApiResponse<List<CustomerQuotationSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCustomerQuotations(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var result = await _customerQuotationService.GetPlatformCustomerQuotationsAsync(page, pageSize, cancellationToken);
        return Ok(result);
    }

    [HttpGet("customer-quotations/{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<CustomerQuotationDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCustomerQuotationById(Guid id, CancellationToken cancellationToken)
    {
        var adminId = _currentUserService.UserId ?? Guid.Empty;
        var result = await _customerQuotationService.GetCustomerQuotationByIdAsync(id, adminId, AppRoles.SuperAdmin, cancellationToken);
        if (!result.Success) return NotFound(result);
        return Ok(result);
    }

    [HttpGet("customer-quotations/{id:guid}/decision")]
    [ProducesResponseType(typeof(ApiResponse<CustomerQuotationDecisionDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCustomerQuotationDecision(Guid id, CancellationToken cancellationToken)
    {
        var adminId = _currentUserService.UserId ?? Guid.Empty;
        var result = await _customerDecisionService.GetDecisionAsync(id, adminId, AppRoles.SuperAdmin, cancellationToken);
        if (!result.Success)
        {
            return NotFound(result);
        }
        return Ok(result);
    }
}

public record UpdateUserStatusRequest(bool IsActive);
