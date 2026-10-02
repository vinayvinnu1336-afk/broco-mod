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
    private readonly ICurrentUserService _currentUserService;

    public CustomerController(
        ICustomerPortalService customerPortalService,
        ICurrentUserService currentUserService)
    {
        _customerPortalService = customerPortalService;
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
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<CustomerVehicleDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetVehicles(CancellationToken cancellationToken)
    {
        var customerId = GetEffectiveCustomerId();
        var vehicles = await _customerPortalService.GetVehiclesAsync(customerId, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<CustomerVehicleDto>>.Ok(vehicles));
    }

    [HttpPost("vehicles")]
    [ProducesResponseType(typeof(ApiResponse<CustomerVehicleDto>), StatusCodes.Status201Created)]
    public async Task<IActionResult> AddVehicle([FromBody] CreateVehicleDto dto, CancellationToken cancellationToken)
    {
        var customerId = GetEffectiveCustomerId();
        var created = await _customerPortalService.AddVehicleAsync(customerId, dto, cancellationToken);
        return CreatedAtAction(nameof(GetVehicles), ApiResponse<CustomerVehicleDto>.Ok(created, "Vehicle added successfully."));
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
