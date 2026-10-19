using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Constants;
using BroCoMod.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BroCoMod.Api.Controllers.v1;

[ApiController]
[Route("api/v1/admin")]
[Authorize(Roles = AppRoles.SuperAdmin)]
public class AdminController : ControllerBase
{
    private readonly IAdminPortalService _adminPortalService;
    private readonly IAdminOperationsService _adminOperationsService;
    private readonly IIdentityService _identityService;
    private readonly IServiceRequestService _serviceRequestService;
    private readonly IGarageQuoteService _garageQuoteService;
    private readonly IAdvisorQuotationService _advisorQuotationService;
    private readonly ICustomerQuotationService _customerQuotationService;
    private readonly ICustomerDecisionService _customerDecisionService;
    private readonly IServiceJobService _serviceJobService;
    private readonly ICurrentUserService _currentUserService;

    public AdminController(
        IAdminPortalService adminPortalService,
        IAdminOperationsService adminOperationsService,
        IIdentityService identityService,
        IServiceRequestService serviceRequestService,
        IGarageQuoteService garageQuoteService,
        IAdvisorQuotationService advisorQuotationService,
        ICustomerQuotationService customerQuotationService,
        ICustomerDecisionService customerDecisionService,
        IServiceJobService serviceJobService,
        ICurrentUserService currentUserService)
    {
        _adminPortalService = adminPortalService;
        _adminOperationsService = adminOperationsService;
        _identityService = identityService;
        _serviceRequestService = serviceRequestService;
        _garageQuoteService = garageQuoteService;
        _advisorQuotationService = advisorQuotationService;
        _customerQuotationService = customerQuotationService;
        _customerDecisionService = customerDecisionService;
        _serviceJobService = serviceJobService;
        _currentUserService = currentUserService;
    }

    [HttpGet("dashboard")]
    [ProducesResponseType(typeof(ApiResponse<AdminDashboardKpiDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDashboard(CancellationToken cancellationToken)
    {
        var dashboard = await _adminOperationsService.GetDashboardKpisAsync(cancellationToken);
        return Ok(ApiResponse<AdminDashboardKpiDto>.Ok(dashboard));
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

    // ==========================================
    // Request Management & Operational Timeline
    // ==========================================
    [HttpGet("requests")]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<AdminRequestSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetRequests(
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] Guid? assignedAdvisorId,
        [FromQuery] DateTime? fromDateUtc,
        [FromQuery] DateTime? toDateUtc,
        [FromQuery] string? serviceType = null,
        [FromQuery] string? category = null,
        [FromQuery] string? city = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken cancellationToken = default)
    {
        var filter = new AdminRequestFilter(status, search, assignedAdvisorId, fromDateUtc, toDateUtc, page, pageSize,
            ServiceType: serviceType, Category: category, City: city);
        var requests = await _adminOperationsService.GetRequestsAsync(filter, cancellationToken);
        return Ok(ApiResponse<PagedResult<AdminRequestSummaryDto>>.Ok(requests));
    }

    [HttpGet("requests/{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<AdminRequestOperationalDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetRequestById(Guid id, CancellationToken cancellationToken)
    {
        var detail = await _adminOperationsService.GetRequestOperationalDetailAsync(id, cancellationToken);
        if (detail == null)
        {
            return NotFound(ApiResponse<object>.Fail($"Service request {id} not found."));
        }
        return Ok(ApiResponse<AdminRequestOperationalDetailDto>.Ok(detail));
    }

    // ==========================================
    // Garage Management
    // ==========================================
    [HttpGet("garages")]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<AdminGarageListDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetGarages(
        [FromQuery] GarageStatus? status,
        [FromQuery] string? search,
        [FromQuery] string? city = null,
        [FromQuery] string? dues = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken cancellationToken = default)
    {
        var filter = new AdminGarageFilter(status, search, page, pageSize, City: city, Dues: dues);
        var result = await _adminOperationsService.GetGaragesAsync(filter, cancellationToken);
        return Ok(ApiResponse<PagedResult<AdminGarageListDto>>.Ok(result));
    }

    [HttpGet("garages/{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<AdminGarageDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetGarageById(Guid id, CancellationToken cancellationToken)
    {
        var garage = await _adminOperationsService.GetGarageDetailAsync(id, cancellationToken);
        if (garage == null)
        {
            return NotFound(ApiResponse<object>.Fail($"Garage {id} not found."));
        }
        return Ok(ApiResponse<AdminGarageDetailDto>.Ok(garage));
    }

    [HttpPost("garages/{id:guid}/verify")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> VerifyGarage(Guid id, CancellationToken cancellationToken)
    {
        var adminId = _currentUserService.UserId ?? Guid.Empty;
        try
        {
            await _adminOperationsService.VerifyGarageAsync(id, adminId, cancellationToken);
            return Ok(ApiResponse<bool>.Ok(true, "Garage successfully verified."));
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

    [HttpPost("garages/{id:guid}/suspend")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SuspendGarage(Guid id, [FromBody] SuspendGarageRequest request, CancellationToken cancellationToken)
    {
        var adminId = _currentUserService.UserId ?? Guid.Empty;
        try
        {
            await _adminOperationsService.SuspendGarageAsync(id, request.Reason, adminId, cancellationToken);
            return Ok(ApiResponse<bool>.Ok(true, "Garage suspended successfully."));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
    }

    [HttpPost("garages/{id:guid}/activate")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ActivateGarage(Guid id, CancellationToken cancellationToken)
    {
        var adminId = _currentUserService.UserId ?? Guid.Empty;
        try
        {
            await _adminOperationsService.ActivateGarageAsync(id, adminId, cancellationToken);
            return Ok(ApiResponse<bool>.Ok(true, "Garage activated successfully."));
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

    [HttpPost("garages/{id:guid}/deactivate")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeactivateGarage(Guid id, [FromBody] DeactivateGarageRequest request, CancellationToken cancellationToken)
    {
        var adminId = _currentUserService.UserId ?? Guid.Empty;
        try
        {
            await _adminOperationsService.DeactivateGarageAsync(id, request.Reason, adminId, cancellationToken);
            return Ok(ApiResponse<bool>.Ok(true, "Garage deactivated successfully."));
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

    [HttpPut("garages/{id:guid}/radius")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateGarageRadius(Guid id, [FromBody] UpdateGarageRadiusRequest request, CancellationToken cancellationToken)
    {
        var adminId = _currentUserService.UserId ?? Guid.Empty;
        try
        {
            await _adminOperationsService.UpdateGarageRadiusAsync(id, request.RadiusKm, adminId, cancellationToken);
            return Ok(ApiResponse<bool>.Ok(true, $"Garage service radius updated to {request.RadiusKm} KM."));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
        catch (ArgumentOutOfRangeException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
    }

    // ==========================================
    // Advisor Management
    // ==========================================
    [HttpGet("advisors")]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<AdminAdvisorListDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAdvisors(
        [FromQuery] string? search,
        [FromQuery] bool? isActive,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken cancellationToken = default)
    {
        var filter = new AdminAdvisorFilter(search, isActive, page, pageSize);
        var advisors = await _adminOperationsService.GetAdvisorsAsync(filter, cancellationToken);
        return Ok(ApiResponse<PagedResult<AdminAdvisorListDto>>.Ok(advisors));
    }

    /// <summary>
    /// Creates an advisor account. A 409 with error code EXISTING_CUSTOMER_ACCOUNT (and the account in Data)
    /// means the email or mobile belongs to a customer account, which can be promoted instead.
    /// </summary>
    [HttpPost("advisors")]
    [ProducesResponseType(typeof(ApiResponse<CreatedAdvisorDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<ExistingCustomerAccountDto>), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateAdvisor(
        [FromBody] CreateAdvisorRequest request,
        [FromServices] IAdminAdvisorAccountService advisorAccounts,
        CancellationToken cancellationToken)
    {
        try
        {
            var created = await advisorAccounts.CreateAdvisorAsync(request, _currentUserService.UserId ?? Guid.Empty,
                HttpContext.Connection.RemoteIpAddress?.ToString(), cancellationToken);
            // The temporary password is only in this response; make sure nothing caches it.
            Response.Headers.CacheControl = "no-store";
            return StatusCode(StatusCodes.Status201Created, ApiResponse<CreatedAdvisorDto>.Ok(created, "Advisor account created."));
        }
        catch (AdvisorAccountException ex)
        {
            return AdvisorAccountError(ex);
        }
    }

    /// <summary>Turns an existing customer account (by email or mobile) into an advisor. Safe to repeat.</summary>
    [HttpPost("advisors/promote")]
    [ProducesResponseType(typeof(ApiResponse<PromotedAdvisorDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> PromoteToAdvisor(
        [FromBody] PromoteToAdvisorRequest request,
        [FromServices] IAdminAdvisorAccountService advisorAccounts,
        CancellationToken cancellationToken)
    {
        try
        {
            var promoted = await advisorAccounts.PromoteToAdvisorAsync(request, _currentUserService.UserId ?? Guid.Empty,
                HttpContext.Connection.RemoteIpAddress?.ToString(), cancellationToken);
            return Ok(ApiResponse<PromotedAdvisorDto>.Ok(promoted,
                promoted.AlreadyAdvisor ? "This account is already an advisor." : "Account changed to advisor."));
        }
        catch (AdvisorAccountException ex)
        {
            return AdvisorAccountError(ex);
        }
    }

    [HttpPut("advisors/{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<AdminAdvisorListDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateAdvisor(
        Guid id,
        [FromBody] UpdateAdvisorRequest request,
        [FromServices] IAdminAdvisorAccountService advisorAccounts,
        CancellationToken cancellationToken)
    {
        try
        {
            var advisor = await advisorAccounts.UpdateAdvisorAsync(id, request, _currentUserService.UserId ?? Guid.Empty,
                HttpContext.Connection.RemoteIpAddress?.ToString(), cancellationToken);
            return Ok(ApiResponse<AdminAdvisorListDto>.Ok(advisor, "Advisor updated."));
        }
        catch (AdvisorAccountException ex)
        {
            return AdvisorAccountError(ex);
        }
    }

    // The error code goes first in Errors so the admin UI can tell an existing customer account from other conflicts.
    private ObjectResult AdvisorAccountError(AdvisorAccountException ex) =>
        StatusCode(ex.StatusCode, ex.ExistingCustomer is { } existing
            ? (object)new ApiResponse<ExistingCustomerAccountDto>(false, ex.Message, existing, new[] { ex.Code, ex.Message })
            : new ApiResponse<object>(false, ex.Message, null, new[] { ex.Code, ex.Message }));

    [HttpPost("advisors/{id:guid}/activate")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ActivateAdvisor(Guid id, CancellationToken cancellationToken)
    {
        var adminId = _currentUserService.UserId ?? Guid.Empty;
        try
        {
            await _adminOperationsService.ActivateAdvisorAsync(id, adminId, cancellationToken);
            return Ok(ApiResponse<bool>.Ok(true, "Advisor account activated successfully."));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
    }

    [HttpPost("advisors/{id:guid}/deactivate")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeactivateAdvisor(Guid id, [FromBody] DeactivateAdvisorRequest request, CancellationToken cancellationToken)
    {
        var adminId = _currentUserService.UserId ?? Guid.Empty;
        try
        {
            await _adminOperationsService.DeactivateAdvisorAsync(id, request.Reason, adminId, cancellationToken);
            return Ok(ApiResponse<bool>.Ok(true, "Advisor account deactivated successfully."));
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

    // ==========================================
    // Customer Management
    // ==========================================
    [HttpGet("customers")]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<AdminCustomerListDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCustomers(
        [FromQuery] string? search,
        [FromQuery] bool? hasBookings = null,
        [FromQuery] DateTime? fromDateUtc = null,
        [FromQuery] DateTime? toDateUtc = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken cancellationToken = default)
    {
        var filter = new AdminCustomerFilter(search, page, pageSize, hasBookings, fromDateUtc, toDateUtc);
        var customers = await _adminOperationsService.GetCustomersAsync(filter, cancellationToken);
        return Ok(ApiResponse<PagedResult<AdminCustomerListDto>>.Ok(customers));
    }

    [HttpGet("customers/{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<AdminCustomerDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCustomerById(Guid id, CancellationToken cancellationToken)
    {
        var customer = await _adminOperationsService.GetCustomerDetailAsync(id, cancellationToken);
        if (customer == null)
        {
            return NotFound(ApiResponse<object>.Fail($"Customer {id} not found."));
        }
        return Ok(ApiResponse<AdminCustomerDetailDto>.Ok(customer));
    }

    // ==========================================
    // Operational Attention Queue
    // ==========================================
    [HttpGet("attention")]
    [ProducesResponseType(typeof(ApiResponse<AdminAttentionQueueDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAttentionQueue(CancellationToken cancellationToken)
    {
        var queue = await _adminOperationsService.GetAttentionQueueAsync(cancellationToken);
        return Ok(ApiResponse<AdminAttentionQueueDto>.Ok(queue));
    }

    // ==========================================
    // Notification Monitoring & Retry
    // ==========================================
    [HttpGet("notifications")]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<AdminNotificationListDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetNotifications(
        [FromQuery] NotificationStatus? status,
        [FromQuery] Guid? userId,
        [FromQuery] string? search,
        [FromQuery] DateTime? fromDateUtc = null,
        [FromQuery] DateTime? toDateUtc = null,
        [FromQuery] string? type = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken cancellationToken = default)
    {
        var filter = new AdminNotificationFilter(status, userId, search, page, pageSize, fromDateUtc, toDateUtc, type);
        var notifications = await _adminOperationsService.GetNotificationsAsync(filter, cancellationToken);
        return Ok(ApiResponse<PagedResult<AdminNotificationListDto>>.Ok(notifications));
    }

    [HttpPost("notifications/{id:guid}/retry")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RetryNotification(Guid id, CancellationToken cancellationToken)
    {
        var adminId = _currentUserService.UserId ?? Guid.Empty;
        try
        {
            await _adminOperationsService.RetryNotificationAsync(id, adminId, cancellationToken);
            return Ok(ApiResponse<bool>.Ok(true, "Notification retry initiated successfully."));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
    }

    // ==========================================
    // System Health Monitor
    // ==========================================
    [HttpGet("system-health")]
    [ProducesResponseType(typeof(ApiResponse<SystemHealthDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSystemHealth(CancellationToken cancellationToken)
    {
        var health = await _adminOperationsService.GetSystemHealthAsync(cancellationToken);
        return Ok(ApiResponse<SystemHealthDto>.Ok(health));
    }

    // ==========================================
    // Audit Log Explorer
    // ==========================================
    [HttpGet("audit")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAuditLogs(
        [FromQuery] int? limit,
        [FromQuery] string? entityName,
        [FromQuery] string? entityId,
        [FromQuery] string? action,
        [FromQuery] Guid? userId,
        [FromQuery] DateTime? fromDateUtc,
        [FromQuery] DateTime? toDateUtc,
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken cancellationToken = default)
    {
        if (limit.HasValue)
        {
            var logs = await _adminPortalService.GetAuditLogsAsync(limit.Value, cancellationToken);
            return Ok(ApiResponse<IReadOnlyList<AdminAuditLogSummaryDto>>.Ok(logs));
        }

        var filter = new AdminAuditFilter(entityName, entityId, action, userId, fromDateUtc, toDateUtc, page, pageSize, search);
        var pagedLogs = await _adminOperationsService.GetAuditLogsAsync(filter, cancellationToken);
        return Ok(ApiResponse<PagedResult<AdminAuditLogSummaryDto>>.Ok(pagedLogs));
    }

    [HttpGet("settings")]
    [ProducesResponseType(typeof(ApiResponse<AdminSettingsDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSettings(CancellationToken cancellationToken)
    {
        var settings = await _adminPortalService.GetSettingsAsync(cancellationToken);
        return Ok(ApiResponse<AdminSettingsDto>.Ok(settings));
    }

    // ==========================================
    // Service Jobs Operations
    // ==========================================
    [HttpGet("jobs")]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<AdminJobListItemDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetJobs(
        [FromQuery] ServiceJobStatus? status,
        [FromQuery] Guid? garageId,
        [FromQuery] string? search,
        [FromQuery] DateTime? fromDateUtc = null,
        [FromQuery] DateTime? toDateUtc = null,
        [FromQuery] string? serviceType = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken cancellationToken = default)
    {
        var filter = new AdminJobFilter(status, garageId, search, page, pageSize, fromDateUtc, toDateUtc, serviceType);
        var jobs = await _adminOperationsService.GetJobsAsync(filter, cancellationToken);
        return Ok(ApiResponse<PagedResult<AdminJobListItemDto>>.Ok(jobs));
    }

    [HttpGet("jobs/{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<AdminJobDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetJobDetail(Guid id, CancellationToken cancellationToken)
    {
        var job = await _adminOperationsService.GetJobDetailAsync(id, cancellationToken);
        if (job == null)
        {
            return NotFound(ApiResponse<object>.Fail($"Service job {id} not found."));
        }
        return Ok(ApiResponse<AdminJobDetailDto>.Ok(job));
    }

    // Retain previous existing routes for Garage Quotes, Assignments, Customer Quotations
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
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] DateTime? fromDateUtc = null,
        [FromQuery] DateTime? toDateUtc = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var result = await _advisorQuotationService.GetAllAssignmentsAsync(page, pageSize, cancellationToken,
            new ListFilter(search, status, fromDateUtc, toDateUtc));
        return Ok(result);
    }

    [HttpGet("customer-quotations")]
    [ProducesResponseType(typeof(ApiResponse<List<CustomerQuotationSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCustomerQuotations(
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] DateTime? fromDateUtc = null,
        [FromQuery] DateTime? toDateUtc = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var result = await _customerQuotationService.GetPlatformCustomerQuotationsAsync(page, pageSize, cancellationToken,
            new ListFilter(search, status, fromDateUtc, toDateUtc));
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
