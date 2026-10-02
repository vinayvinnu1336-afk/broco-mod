using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BroCoMod.Api.Controllers.v1;

[ApiController]
[Route("api/v1/customer")]
[Authorize(Roles = $"{AppRoles.Customer},{AppRoles.SuperAdmin}")]
public class CustomerController : ControllerBase
{
    private readonly ICustomerPortalService _customerPortalService;
    private readonly ICustomerVehicleService _customerVehicleService;
    private readonly IServiceRequestService _serviceRequestService;
    private readonly ICustomerQuotationService _customerQuotationService;
    private readonly ICustomerDecisionService _customerDecisionService;
    private readonly IServiceJobService _serviceJobService;
    private readonly ICurrentUserService _currentUserService;

    public CustomerController(
        ICustomerPortalService customerPortalService,
        ICustomerVehicleService customerVehicleService,
        IServiceRequestService serviceRequestService,
        ICustomerQuotationService customerQuotationService,
        ICustomerDecisionService customerDecisionService,
        IServiceJobService serviceJobService,
        ICurrentUserService currentUserService)
    {
        _customerPortalService = customerPortalService;
        _customerVehicleService = customerVehicleService;
        _serviceRequestService = serviceRequestService;
        _customerQuotationService = customerQuotationService;
        _customerDecisionService = customerDecisionService;
        _serviceJobService = serviceJobService;
        _currentUserService = currentUserService;
    }

    private Guid GetEffectiveCustomerId()
    {
        var customerId = _currentUserService.CustomerId ?? _currentUserService.UserId;
        if (!customerId.HasValue)
        {
            throw new UnauthorizedAccessException("Authenticated user has no valid customer profile.");
        }
        return customerId.Value;
    }

    [HttpGet("dashboard")]
    [ProducesResponseType(typeof(ApiResponse<CustomerDashboardDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDashboard(CancellationToken cancellationToken)
    {
        var customerId = GetEffectiveCustomerId();
        var dashboard = await _customerPortalService.GetDashboardAsync(customerId, cancellationToken);
        return Ok(ApiResponse<CustomerDashboardDto>.Ok(dashboard));
    }

    [HttpGet("profile")]
    [ProducesResponseType(typeof(ApiResponse<CustomerProfileDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetProfile(CancellationToken cancellationToken)
    {
        var customerId = GetEffectiveCustomerId();
        var profile = await _customerPortalService.GetProfileAsync(customerId, cancellationToken);
        return Ok(ApiResponse<CustomerProfileDto>.Ok(profile));
    }

    [HttpGet("vehicles")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<CustomerVehicleDetailDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetVehicles(CancellationToken cancellationToken)
    {
        var customerId = GetEffectiveCustomerId();
        var vehicles = await _customerVehicleService.GetCustomerVehiclesAsync(customerId, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<CustomerVehicleDetailDto>>.Ok(vehicles));
    }

    [HttpPost("vehicles")]
    [ProducesResponseType(typeof(ApiResponse<CustomerVehicleDetailDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddVehicle([FromBody] CreateCustomerVehicleRequest request, CancellationToken cancellationToken)
    {
        var customerId = GetEffectiveCustomerId();
        try
        {
            var created = await _customerVehicleService.AddVehicleAsync(customerId, request, cancellationToken);
            return CreatedAtAction(nameof(GetVehicleById), new { id = created.Id }, ApiResponse<CustomerVehicleDetailDto>.Ok(created, "Vehicle added successfully."));
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

    [HttpGet("vehicles/{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<CustomerVehicleDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetVehicleById(Guid id, CancellationToken cancellationToken)
    {
        var customerId = GetEffectiveCustomerId();
        var vehicle = await _customerVehicleService.GetCustomerVehicleByIdAsync(customerId, id, cancellationToken);
        if (vehicle == null)
        {
            return NotFound(ApiResponse<object>.Fail("Vehicle not found or unauthorized."));
        }

        return Ok(ApiResponse<CustomerVehicleDetailDto>.Ok(vehicle));
    }

    [HttpPut("vehicles/{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<CustomerVehicleDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateVehicle(Guid id, [FromBody] UpdateCustomerVehicleRequest request, CancellationToken cancellationToken)
    {
        var customerId = GetEffectiveCustomerId();
        try
        {
            var updated = await _customerVehicleService.UpdateVehicleAsync(customerId, id, request, cancellationToken);
            return Ok(ApiResponse<CustomerVehicleDetailDto>.Ok(updated, "Vehicle updated successfully."));
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

    [HttpDelete("vehicles/{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteVehicle(Guid id, CancellationToken cancellationToken)
    {
        var customerId = GetEffectiveCustomerId();
        try
        {
            await _customerVehicleService.DeleteVehicleAsync(customerId, id, cancellationToken);
            return Ok(ApiResponse<bool>.Ok(true, "Vehicle removed successfully."));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
    }

    [HttpPost("vehicles/{id:guid}/set-primary")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SetPrimaryVehicle(Guid id, CancellationToken cancellationToken)
    {
        var customerId = GetEffectiveCustomerId();
        try
        {
            await _customerVehicleService.SetPrimaryVehicleAsync(customerId, id, cancellationToken);
            return Ok(ApiResponse<bool>.Ok(true, "Vehicle set as primary successfully."));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
    }

    [HttpPost("requests")]
    [ProducesResponseType(typeof(ApiResponse<ServiceRequestDetailDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateServiceRequest(
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey,
        [FromBody] CreateServiceBookingRequest request,
        CancellationToken cancellationToken)
    {
        var customerId = GetEffectiveCustomerId();
        try
        {
            var created = await _serviceRequestService.CreateServiceRequestAsync(customerId, request, idempotencyKey, cancellationToken);
            return CreatedAtAction(nameof(GetRequestById), new { id = created.Id }, ApiResponse<ServiceRequestDetailDto>.Ok(created, "Service request created and eligible garages notified."));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail(ex.Message));
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

    [HttpGet("requests")]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<CustomerServiceRequestSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetRequests(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken cancellationToken = default)
    {
        var customerId = GetEffectiveCustomerId();
        var requests = await _serviceRequestService.GetCustomerRequestsAsync(customerId, page, pageSize, cancellationToken);
        return Ok(ApiResponse<PagedResult<CustomerServiceRequestSummaryDto>>.Ok(requests));
    }

    [HttpGet("requests/{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<ServiceRequestDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetRequestById(Guid id, CancellationToken cancellationToken)
    {
        var customerId = GetEffectiveCustomerId();
        try
        {
            var request = await _serviceRequestService.GetCustomerRequestByIdAsync(customerId, id, cancellationToken);
            return Ok(ApiResponse<ServiceRequestDetailDto>.Ok(request));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
    }

    [HttpPost("requests/{id:guid}/cancel")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CancelRequest(Guid id, [FromBody] CancelServiceRequestCommand command, CancellationToken cancellationToken)
    {
        var customerId = GetEffectiveCustomerId();
        try
        {
            var success = await _serviceRequestService.CancelCustomerRequestAsync(customerId, id, command.Reason, cancellationToken);
            return Ok(ApiResponse<bool>.Ok(success, "Service request cancelled successfully."));
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

    [HttpGet("quotes")]
    [ProducesResponseType(typeof(ApiResponse<List<CustomerFacingQuotationDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetQuotes(CancellationToken cancellationToken)
    {
        var customerId = GetEffectiveCustomerId();
        var result = await _customerQuotationService.GetQuotationsForCustomerAsync(customerId, cancellationToken);
        return Ok(result);
    }

    [HttpGet("quotes/{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<CustomerFacingQuotationDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetQuoteById(Guid id, CancellationToken cancellationToken)
    {
        var customerId = GetEffectiveCustomerId();
        var result = await _customerQuotationService.GetCustomerQuotationForCustomerAsync(id, customerId, cancellationToken);
        if (!result.Success)
        {
            if (result.Message.Contains("permission") || result.Message.Contains("not currently available"))
            {
                return StatusCode(StatusCodes.Status403Forbidden, result);
            }
            return NotFound(result);
        }
        return Ok(result);
    }

    [HttpPost("quotes/{id:guid}/accept")]
    [ProducesResponseType(typeof(ApiResponse<BookingConfirmationDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> AcceptQuote(
        Guid id,
        [FromHeader(Name = "Idempotency-Key")] string? headerIdempotencyKey,
        [FromBody] AcceptQuotationRequest? request,
        CancellationToken cancellationToken)
    {
        var customerId = GetEffectiveCustomerId();
        var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString();
        var userAgent = Request.Headers.UserAgent.ToString();
        var effectiveRequest = request ?? new AcceptQuotationRequest();
        if (string.IsNullOrWhiteSpace(effectiveRequest.IdempotencyKey) && !string.IsNullOrWhiteSpace(headerIdempotencyKey))
        {
            effectiveRequest = effectiveRequest with { IdempotencyKey = headerIdempotencyKey };
        }

        var result = await _customerDecisionService.AcceptQuotationAsync(id, customerId, effectiveRequest, clientIp, userAgent, cancellationToken);
        if (!result.Success)
        {
            if (result.Message.Contains("not found")) return NotFound(result);
            if (result.Message.Contains("permission")) return StatusCode(StatusCodes.Status403Forbidden, result);
            if (result.Message.Contains("already") || result.Message.Contains("concurrently"))
                return StatusCode(StatusCodes.Status409Conflict, result);
            return BadRequest(result);
        }
        return Ok(result);
    }

    [HttpPost("quotes/{id:guid}/reject")]
    [ProducesResponseType(typeof(ApiResponse<CustomerQuotationDecisionDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> RejectQuote(
        Guid id,
        [FromHeader(Name = "Idempotency-Key")] string? headerIdempotencyKey,
        [FromBody] RejectQuotationRequest request,
        CancellationToken cancellationToken)
    {
        var customerId = GetEffectiveCustomerId();
        var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString();
        var userAgent = Request.Headers.UserAgent.ToString();
        var effectiveRequest = request;
        if (string.IsNullOrWhiteSpace(effectiveRequest.IdempotencyKey) && !string.IsNullOrWhiteSpace(headerIdempotencyKey))
        {
            effectiveRequest = effectiveRequest with { IdempotencyKey = headerIdempotencyKey };
        }

        var result = await _customerDecisionService.RejectQuotationAsync(id, customerId, effectiveRequest, clientIp, userAgent, cancellationToken);
        if (!result.Success)
        {
            if (result.Message.Contains("not found")) return NotFound(result);
            if (result.Message.Contains("permission")) return StatusCode(StatusCodes.Status403Forbidden, result);
            if (result.Message.Contains("already") || result.Message.Contains("concurrently"))
                return StatusCode(StatusCodes.Status409Conflict, result);
            return BadRequest(result);
        }
        return Ok(result);
    }

    [HttpGet("quotes/{id:guid}/decision")]
    [ProducesResponseType(typeof(ApiResponse<CustomerQuotationDecisionDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetQuoteDecision(Guid id, CancellationToken cancellationToken)
    {
        var customerId = GetEffectiveCustomerId();
        var result = await _customerDecisionService.GetDecisionAsync(id, customerId, AppRoles.Customer, cancellationToken);
        if (!result.Success)
        {
            if (result.Message.Contains("permission")) return StatusCode(StatusCodes.Status403Forbidden, result);
            return NotFound(result);
        }
        return Ok(result);
    }

    // Milestone 8: Customer Service Execution Tracking Endpoints

    [HttpGet("requests/{serviceRequestId:guid}/job")]
    [ProducesResponseType(typeof(ApiResponse<CustomerServiceJobDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetServiceJobForRequest(Guid serviceRequestId, CancellationToken cancellationToken)
    {
        var customerId = GetEffectiveCustomerId();
        try
        {
            var job = await _serviceJobService.GetCustomerJobDetailAsync(serviceRequestId, customerId, cancellationToken);
            return Ok(ApiResponse<CustomerServiceJobDetailDto>.Ok(job));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail(ex.Message));
        }
    }

    [HttpGet("jobs/{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<CustomerServiceJobDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetServiceJobById(Guid id, CancellationToken cancellationToken)
    {
        var customerId = GetEffectiveCustomerId();
        try
        {
            var job = await _serviceJobService.GetCustomerJobByIdAsync(id, customerId, cancellationToken);
            return Ok(ApiResponse<CustomerServiceJobDetailDto>.Ok(job));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail(ex.Message));
        }
    }
}
