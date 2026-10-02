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
    private readonly IServiceRequestService _serviceRequestService;
    private readonly IGarageQuoteService _garageQuoteService;
    private readonly IAdvisorQuotationService _advisorQuotationService;
    private readonly ICustomerQuotationService _customerQuotationService;
    private readonly ICurrentUserService _currentUserService;

    public AdvisorController(
        IAdvisorPortalService advisorPortalService,
        IServiceRequestService serviceRequestService,
        IGarageQuoteService garageQuoteService,
        IAdvisorQuotationService advisorQuotationService,
        ICustomerQuotationService customerQuotationService,
        ICurrentUserService currentUserService)
    {
        _advisorPortalService = advisorPortalService;
        _serviceRequestService = serviceRequestService;
        _garageQuoteService = garageQuoteService;
        _advisorQuotationService = advisorQuotationService;
        _customerQuotationService = customerQuotationService;
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
    [ProducesResponseType(typeof(ApiResponse<PagedResult<AdvisorServiceRequestSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetRequests(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var requests = await _serviceRequestService.GetAdvisorRequestsAsync(page, pageSize, cancellationToken);
        return Ok(ApiResponse<PagedResult<AdvisorServiceRequestSummaryDto>>.Ok(requests));
    }

    [HttpGet("requests/{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<AdvisorServiceRequestDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetRequestById(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var request = await _serviceRequestService.GetAdvisorRequestByIdAsync(id, cancellationToken);
            return Ok(ApiResponse<AdvisorServiceRequestDetailDto>.Ok(request));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
    }

    [HttpGet("requests/{id:guid}/quotes")]
    [ProducesResponseType(typeof(ApiResponse<QuoteComparisonDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetQuoteComparison(Guid id, CancellationToken cancellationToken)
    {
        var advisorId = GetEffectiveAdvisorId();
        var result = await _advisorQuotationService.GetQuoteComparisonAsync(id, advisorId, cancellationToken);
        if (!result.Success) return NotFound(result);
        return Ok(result);
    }

    [HttpPost("requests/{id:guid}/notes")]
    [ProducesResponseType(typeof(ApiResponse<AdvisorRequestNoteDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AddInternalNote(Guid id, [FromBody] CreateAdvisorNoteRequest request, CancellationToken cancellationToken)
    {
        var advisorId = GetEffectiveAdvisorId();
        var advisorName = _currentUserService.Email ?? "Advisor";
        var result = await _advisorQuotationService.AddInternalNoteAsync(id, request, advisorId, advisorName, cancellationToken);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }

    [HttpGet("requests/{id:guid}/notes")]
    [ProducesResponseType(typeof(ApiResponse<List<AdvisorRequestNoteDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetInternalNotes(Guid id, CancellationToken cancellationToken)
    {
        var advisorId = GetEffectiveAdvisorId();
        var result = await _advisorQuotationService.GetInternalNotesAsync(id, advisorId, cancellationToken);
        return Ok(result);
    }

    [HttpPut("requests/{id:guid}/notes/{noteId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<AdvisorRequestNoteDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateInternalNote(Guid id, Guid noteId, [FromBody] UpdateAdvisorNoteRequest request, CancellationToken cancellationToken)
    {
        var advisorId = GetEffectiveAdvisorId();
        var isAdmin = User.IsInRole(AppRoles.SuperAdmin);
        var result = await _advisorQuotationService.UpdateInternalNoteAsync(noteId, request, advisorId, isAdmin, cancellationToken);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }

    [HttpDelete("requests/{id:guid}/notes/{noteId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> DeleteInternalNote(Guid id, Guid noteId, CancellationToken cancellationToken)
    {
        var advisorId = GetEffectiveAdvisorId();
        var isAdmin = User.IsInRole(AppRoles.SuperAdmin);
        var result = await _advisorQuotationService.DeleteInternalNoteAsync(noteId, advisorId, isAdmin, cancellationToken);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }

    [HttpPost("requests/{id:guid}/assignment")]
    [ProducesResponseType(typeof(ApiResponse<GarageAssignmentDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> AssignGarage(Guid id, [FromBody] AssignGarageRequest request, CancellationToken cancellationToken)
    {
        var advisorId = GetEffectiveAdvisorId();
        var advisorName = _currentUserService.Email ?? "Advisor";
        var result = await _advisorQuotationService.AssignGarageAsync(id, request, advisorId, advisorName, cancellationToken);
        if (!result.Success)
        {
            if (result.Message.Contains("already exists")) return Conflict(result);
            if (result.Message.Contains("not found")) return NotFound(result);
            return BadRequest(result);
        }
        return Ok(result);
    }

    [HttpGet("requests/{id:guid}/assignment")]
    [ProducesResponseType(typeof(ApiResponse<GarageAssignmentDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetActiveAssignment(Guid id, CancellationToken cancellationToken)
    {
        var result = await _advisorQuotationService.GetActiveAssignmentAsync(id, cancellationToken);
        return Ok(result);
    }

    [HttpPost("requests/{id:guid}/customer-quotation")]
    [ProducesResponseType(typeof(ApiResponse<CustomerQuotationDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateCustomerQuotation(Guid id, [FromBody] CreateCustomerQuotationRequest request, CancellationToken cancellationToken)
    {
        var advisorId = GetEffectiveAdvisorId();
        var result = await _customerQuotationService.CreateCustomerQuotationDraftAsync(id, request, advisorId, cancellationToken);
        if (!result.Success)
        {
            if (result.Message.Contains("not found")) return NotFound(result);
            return BadRequest(result);
        }
        return Ok(result);
    }

    [HttpGet("customer-quotations/{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<CustomerQuotationDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCustomerQuotationById(Guid id, CancellationToken cancellationToken)
    {
        var advisorId = GetEffectiveAdvisorId();
        var role = User.IsInRole(AppRoles.SuperAdmin) ? AppRoles.SuperAdmin : AppRoles.Advisor;
        var result = await _customerQuotationService.GetCustomerQuotationByIdAsync(id, advisorId, role, cancellationToken);
        if (!result.Success) return NotFound(result);
        return Ok(result);
    }

    [HttpPut("customer-quotations/{id:guid}/draft")]
    [ProducesResponseType(typeof(ApiResponse<CustomerQuotationDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateCustomerQuotationDraft(Guid id, [FromBody] UpdateCustomerQuotationDraftRequest request, CancellationToken cancellationToken)
    {
        var advisorId = GetEffectiveAdvisorId();
        var result = await _customerQuotationService.UpdateCustomerQuotationDraftAsync(id, request, advisorId, cancellationToken);
        if (!result.Success)
        {
            if (result.Message.Contains("not found")) return NotFound(result);
            return BadRequest(result);
        }
        return Ok(result);
    }

    [HttpPost("customer-quotations/{id:guid}/ready")]
    [ProducesResponseType(typeof(ApiResponse<CustomerQuotationDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> MarkCustomerQuotationReady(Guid id, CancellationToken cancellationToken)
    {
        var advisorId = GetEffectiveAdvisorId();
        var result = await _customerQuotationService.MarkCustomerQuotationReadyAsync(id, advisorId, cancellationToken);
        if (!result.Success)
        {
            if (result.Message.Contains("not found")) return NotFound(result);
            return BadRequest(result);
        }
        return Ok(result);
    }

    [HttpPost("customer-quotations/{id:guid}/send")]
    [ProducesResponseType(typeof(ApiResponse<CustomerQuotationDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> SendCustomerQuotation(Guid id, CancellationToken cancellationToken)
    {
        var advisorId = GetEffectiveAdvisorId();
        var result = await _customerQuotationService.SendCustomerQuotationAsync(id, advisorId, cancellationToken);
        if (!result.Success)
        {
            if (result.Message.Contains("not found")) return NotFound(result);
            return BadRequest(result);
        }
        return Ok(result);
    }

    [HttpGet("quotes")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<AdvisorQuoteSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetQuotes(CancellationToken cancellationToken)
    {
        var quotes = await _advisorPortalService.GetQuotesForReviewAsync(cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<AdvisorQuoteSummaryDto>>.Ok(quotes));
    }

    [HttpGet("garage-quotes")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<AdvisorGarageQuoteSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetGarageQuotes(
        [FromQuery] string? status = null,
        [FromQuery] Guid? serviceRequestId = null,
        CancellationToken cancellationToken = default)
    {
        var quotes = await _garageQuoteService.GetQuotesForAdvisorAsync(status, serviceRequestId, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<AdvisorGarageQuoteSummaryDto>>.Ok(quotes));
    }

    [HttpGet("garage-quotes/{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<AdvisorGarageQuoteDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetGarageQuoteById(Guid id, CancellationToken cancellationToken)
    {
        var quote = await _garageQuoteService.GetAdvisorQuoteDetailAsync(id, cancellationToken);
        if (quote == null)
        {
            return NotFound(ApiResponse<object>.Fail($"Garage quotation {id} not found."));
        }
        return Ok(ApiResponse<AdvisorGarageQuoteDetailDto>.Ok(quote));
    }

    [HttpGet("assignments")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<AdvisorAssignmentSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAssignments(CancellationToken cancellationToken)
    {
        var assignments = await _advisorPortalService.GetRecentAssignmentsAsync(cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<AdvisorAssignmentSummaryDto>>.Ok(assignments));
    }
}
