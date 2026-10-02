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
    private readonly ICurrentUserService _currentUserService;

    public CustomerController(
        ICustomerPortalService customerPortalService,
        ICustomerVehicleService customerVehicleService,
        ICurrentUserService currentUserService)
    {
        _customerPortalService = customerPortalService;
        _customerVehicleService = customerVehicleService;
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

    [HttpGet("requests")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<CustomerRequestSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetRequests(CancellationToken cancellationToken)
    {
        var customerId = GetEffectiveCustomerId();
        var requests = await _customerPortalService.GetRequestsAsync(customerId, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<CustomerRequestSummaryDto>>.Ok(requests));
    }

    [HttpGet("quotes")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<CustomerQuoteSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetQuotes(CancellationToken cancellationToken)
    {
        var customerId = GetEffectiveCustomerId();
        var quotes = await _customerPortalService.GetQuotesAsync(customerId, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<CustomerQuoteSummaryDto>>.Ok(quotes));
    }

    [HttpGet("quotes/{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<CustomerQuoteSummaryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetQuoteById(Guid id, CancellationToken cancellationToken)
    {
        var customerId = GetEffectiveCustomerId();
        var quote = await _customerPortalService.GetQuoteByIdAsync(customerId, id, cancellationToken);
        if (quote == null)
        {
            return NotFound(ApiResponse<object>.Fail("Quotation not found or unauthorized."));
        }

        return Ok(ApiResponse<CustomerQuoteSummaryDto>.Ok(quote));
    }
}
