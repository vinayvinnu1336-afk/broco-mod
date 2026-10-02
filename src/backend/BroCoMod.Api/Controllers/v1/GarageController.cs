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
    private readonly IGarageQuoteService _garageQuoteService;
    private readonly IServiceJobService _serviceJobService;
    private readonly ICurrentUserService _currentUserService;

    public GarageController(
        IGaragePortalService garagePortalService,
        IServiceRequestService serviceRequestService,
        IGarageQuoteService garageQuoteService,
        IServiceJobService serviceJobService,
        ICurrentUserService currentUserService)
    {
        _garagePortalService = garagePortalService;
        _serviceRequestService = serviceRequestService;
        _garageQuoteService = garageQuoteService;
        _serviceJobService = serviceJobService;
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

    private Guid GetEffectiveUserId()
    {
        return _currentUserService.UserId ?? Guid.Empty;
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
    public async Task<IActionResult> GetQuotes(
        [FromQuery] string? status = null,
        CancellationToken cancellationToken = default)
    {
        var garageId = GetEffectiveGarageId();
        var quotes = await _garageQuoteService.GetQuotesForGarageAsync(garageId, status, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<GarageQuoteSummaryDto>>.Ok(quotes));
    }

    [HttpGet("quotes/{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<GarageQuoteDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetQuoteById(Guid id, CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        var quote = await _garageQuoteService.GetGarageQuoteDetailAsync(garageId, id, cancellationToken);
        if (quote == null)
        {
            return NotFound(ApiResponse<object>.Fail($"Quote {id} not found."));
        }
        return Ok(ApiResponse<GarageQuoteDetailDto>.Ok(quote));
    }

    [HttpGet("requests/{requestId:guid}/quotes")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<GarageQuoteSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetQuotesForRequest(Guid requestId, CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        var quotes = await _garageQuoteService.GetQuotesForGarageRequestAsync(garageId, requestId, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<GarageQuoteSummaryDto>>.Ok(quotes));
    }

    [HttpPost("quotes/draft")]
    [ProducesResponseType(typeof(ApiResponse<GarageQuoteDetailDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateDraftQuote(
        [FromBody] CreateGarageQuoteRequest request,
        CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        var userId = GetEffectiveUserId();
        try
        {
            var quote = await _garageQuoteService.CreateDraftQuoteAsync(garageId, userId, request, cancellationToken);
            return StatusCode(StatusCodes.Status201Created, ApiResponse<GarageQuoteDetailDto>.Ok(quote, "Quote draft created successfully."));
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

    [HttpPut("quotes/{id:guid}/draft")]
    [ProducesResponseType(typeof(ApiResponse<GarageQuoteDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateDraftQuote(
        Guid id,
        [FromBody] UpdateGarageQuoteDraftRequest request,
        CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        var userId = GetEffectiveUserId();
        try
        {
            var quote = await _garageQuoteService.UpdateDraftQuoteAsync(garageId, id, userId, request, cancellationToken);
            return Ok(ApiResponse<GarageQuoteDetailDto>.Ok(quote, "Quote draft updated successfully."));
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

    [HttpPost("quotes/{id:guid}/submit")]
    [ProducesResponseType(typeof(ApiResponse<GarageQuoteDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SubmitQuote(
        Guid id,
        [FromBody] SubmitGarageQuoteCommand command,
        CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        var userId = GetEffectiveUserId();
        try
        {
            var quote = await _garageQuoteService.SubmitQuoteAsync(garageId, id, userId, command, cancellationToken);
            return Ok(ApiResponse<GarageQuoteDetailDto>.Ok(quote, "Quote submitted successfully."));
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

    [HttpPost("quotes/{id:guid}/revision")]
    [ProducesResponseType(typeof(ApiResponse<GarageQuoteDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateRevision(
        Guid id,
        CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        var userId = GetEffectiveUserId();
        try
        {
            var quote = await _garageQuoteService.CreateRevisionAsync(garageId, id, userId, cancellationToken);
            return Ok(ApiResponse<GarageQuoteDetailDto>.Ok(quote, "Quote revision created successfully in draft mode."));
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

    [HttpPost("quotes/{id:guid}/withdraw")]
    [ProducesResponseType(typeof(ApiResponse<GarageQuoteDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> WithdrawQuote(
        Guid id,
        [FromBody] WithdrawGarageQuoteCommand command,
        CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        var userId = GetEffectiveUserId();
        try
        {
            var quote = await _garageQuoteService.WithdrawQuoteAsync(garageId, id, userId, command, cancellationToken);
            return Ok(ApiResponse<GarageQuoteDetailDto>.Ok(quote, "Quote withdrawn successfully."));
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

    [HttpGet("confirmed-bookings")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<GarageConfirmedBookingDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetConfirmedBookings(CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        var bookings = await _garagePortalService.GetConfirmedBookingsAsync(garageId, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<GarageConfirmedBookingDto>>.Ok(bookings));
    }

    // Milestone 8: Service Execution & Garage Job Lifecycle Endpoints

    [HttpGet("jobs")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<ServiceJobSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetJobs([FromQuery] string? status, CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        var jobs = await _serviceJobService.GetGarageJobsAsync(garageId, status, cancellationToken);
        return Ok(ApiResponse<IEnumerable<ServiceJobSummaryDto>>.Ok(jobs));
    }

    [HttpGet("jobs/{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<GarageServiceJobDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetJobDetail(Guid id, CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        try
        {
            var job = await _serviceJobService.GetGarageJobDetailAsync(id, garageId, cancellationToken);
            return Ok(ApiResponse<GarageServiceJobDetailDto>.Ok(job));
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

    [HttpPost("jobs/{id:guid}/schedule")]
    [ProducesResponseType(typeof(ApiResponse<GarageServiceJobDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ScheduleJob(
        Guid id,
        [FromBody] ScheduleJobRequest request,
        CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        var userId = GetEffectiveUserId();
        try
        {
            var job = await _serviceJobService.ScheduleJobAsync(id, garageId, userId, request, cancellationToken);
            return Ok(ApiResponse<GarageServiceJobDetailDto>.Ok(job, "Job scheduled successfully."));
        }
        catch (KeyNotFoundException ex) { return NotFound(ApiResponse<object>.Fail(ex.Message)); }
        catch (UnauthorizedAccessException ex) { return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail(ex.Message)); }
        catch (InvalidOperationException ex) { return BadRequest(ApiResponse<object>.Fail(ex.Message)); }
        catch (ArgumentException ex) { return BadRequest(ApiResponse<object>.Fail(ex.Message)); }
    }

    [HttpPost("jobs/{id:guid}/receive")]
    [ProducesResponseType(typeof(ApiResponse<GarageServiceJobDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ReceiveVehicle(
        Guid id,
        [FromBody] ReceiveVehicleRequest request,
        CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        var userId = GetEffectiveUserId();
        try
        {
            var job = await _serviceJobService.ReceiveVehicleAsync(id, garageId, userId, request, cancellationToken);
            return Ok(ApiResponse<GarageServiceJobDetailDto>.Ok(job, "Vehicle received at workshop."));
        }
        catch (KeyNotFoundException ex) { return NotFound(ApiResponse<object>.Fail(ex.Message)); }
        catch (UnauthorizedAccessException ex) { return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail(ex.Message)); }
        catch (InvalidOperationException ex) { return BadRequest(ApiResponse<object>.Fail(ex.Message)); }
        catch (ArgumentException ex) { return BadRequest(ApiResponse<object>.Fail(ex.Message)); }
    }

    [HttpPost("jobs/{id:guid}/inspection/start")]
    [ProducesResponseType(typeof(ApiResponse<GarageServiceJobDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> StartInspection(
        Guid id,
        [FromBody] StartInspectionRequest request,
        CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        var userId = GetEffectiveUserId();
        try
        {
            var job = await _serviceJobService.StartInspectionAsync(id, garageId, userId, request, cancellationToken);
            return Ok(ApiResponse<GarageServiceJobDetailDto>.Ok(job, "Inspection started."));
        }
        catch (KeyNotFoundException ex) { return NotFound(ApiResponse<object>.Fail(ex.Message)); }
        catch (UnauthorizedAccessException ex) { return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail(ex.Message)); }
        catch (InvalidOperationException ex) { return BadRequest(ApiResponse<object>.Fail(ex.Message)); }
    }

    [HttpPost("jobs/{id:guid}/inspection/complete")]
    [ProducesResponseType(typeof(ApiResponse<GarageServiceJobDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CompleteInspection(
        Guid id,
        [FromBody] CompleteInspectionRequest request,
        CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        var userId = GetEffectiveUserId();
        try
        {
            var job = await _serviceJobService.CompleteInspectionAsync(id, garageId, userId, request, cancellationToken);
            return Ok(ApiResponse<GarageServiceJobDetailDto>.Ok(job, "Inspection completed."));
        }
        catch (KeyNotFoundException ex) { return NotFound(ApiResponse<object>.Fail(ex.Message)); }
        catch (UnauthorizedAccessException ex) { return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail(ex.Message)); }
        catch (InvalidOperationException ex) { return BadRequest(ApiResponse<object>.Fail(ex.Message)); }
    }

    [HttpPost("jobs/{id:guid}/work/start")]
    [ProducesResponseType(typeof(ApiResponse<GarageServiceJobDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> StartWork(
        Guid id,
        [FromBody] StartWorkRequest request,
        CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        var userId = GetEffectiveUserId();
        try
        {
            var job = await _serviceJobService.StartWorkAsync(id, garageId, userId, request, cancellationToken);
            return Ok(ApiResponse<GarageServiceJobDetailDto>.Ok(job, "Work commenced."));
        }
        catch (KeyNotFoundException ex) { return NotFound(ApiResponse<object>.Fail(ex.Message)); }
        catch (UnauthorizedAccessException ex) { return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail(ex.Message)); }
        catch (InvalidOperationException ex) { return BadRequest(ApiResponse<object>.Fail(ex.Message)); }
    }

    [HttpPost("jobs/{id:guid}/work/progress")]
    [ProducesResponseType(typeof(ApiResponse<GarageServiceJobDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateProgress(
        Guid id,
        [FromBody] UpdateJobProgressRequest request,
        CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        var userId = GetEffectiveUserId();
        try
        {
            var job = await _serviceJobService.UpdateJobProgressAsync(id, garageId, userId, request, cancellationToken);
            return Ok(ApiResponse<GarageServiceJobDetailDto>.Ok(job, "Progress updated."));
        }
        catch (KeyNotFoundException ex) { return NotFound(ApiResponse<object>.Fail(ex.Message)); }
        catch (UnauthorizedAccessException ex) { return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail(ex.Message)); }
        catch (InvalidOperationException ex) { return BadRequest(ApiResponse<object>.Fail(ex.Message)); }
    }

    [HttpPost("jobs/{id:guid}/work/complete")]
    [ProducesResponseType(typeof(ApiResponse<GarageServiceJobDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CompleteWork(
        Guid id,
        [FromBody] CompleteWorkRequest request,
        CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        var userId = GetEffectiveUserId();
        try
        {
            var job = await _serviceJobService.CompleteWorkAsync(id, garageId, userId, request, cancellationToken);
            return Ok(ApiResponse<GarageServiceJobDetailDto>.Ok(job, "Work completed."));
        }
        catch (KeyNotFoundException ex) { return NotFound(ApiResponse<object>.Fail(ex.Message)); }
        catch (UnauthorizedAccessException ex) { return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail(ex.Message)); }
        catch (InvalidOperationException ex) { return BadRequest(ApiResponse<object>.Fail(ex.Message)); }
    }

    [HttpPost("jobs/{id:guid}/vehicle-ready")]
    [ProducesResponseType(typeof(ApiResponse<GarageServiceJobDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> MarkVehicleReady(
        Guid id,
        [FromBody] VehicleReadyRequest request,
        CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        var userId = GetEffectiveUserId();
        try
        {
            var job = await _serviceJobService.MarkVehicleReadyAsync(id, garageId, userId, request, cancellationToken);
            return Ok(ApiResponse<GarageServiceJobDetailDto>.Ok(job, "Vehicle marked ready for customer pickup."));
        }
        catch (KeyNotFoundException ex) { return NotFound(ApiResponse<object>.Fail(ex.Message)); }
        catch (UnauthorizedAccessException ex) { return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail(ex.Message)); }
        catch (InvalidOperationException ex) { return BadRequest(ApiResponse<object>.Fail(ex.Message)); }
    }

    [HttpPost("jobs/{id:guid}/handover")]
    [ProducesResponseType(typeof(ApiResponse<GarageServiceJobDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> HandOverVehicle(
        Guid id,
        [FromBody] HandOverVehicleRequest request,
        CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        var userId = GetEffectiveUserId();
        try
        {
            var job = await _serviceJobService.HandOverVehicleAsync(id, garageId, userId, request, cancellationToken);
            return Ok(ApiResponse<GarageServiceJobDetailDto>.Ok(job, "Vehicle handed over to customer."));
        }
        catch (KeyNotFoundException ex) { return NotFound(ApiResponse<object>.Fail(ex.Message)); }
        catch (UnauthorizedAccessException ex) { return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail(ex.Message)); }
        catch (InvalidOperationException ex) { return BadRequest(ApiResponse<object>.Fail(ex.Message)); }
    }

    [HttpPost("jobs/{id:guid}/close")]
    [ProducesResponseType(typeof(ApiResponse<GarageServiceJobDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CloseJob(
        Guid id,
        [FromBody] CloseJobRequest request,
        CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        var userId = GetEffectiveUserId();
        try
        {
            var job = await _serviceJobService.CloseJobAsync(id, garageId, userId, request, cancellationToken);
            return Ok(ApiResponse<GarageServiceJobDetailDto>.Ok(job, "Job closed and finalized."));
        }
        catch (KeyNotFoundException ex) { return NotFound(ApiResponse<object>.Fail(ex.Message)); }
        catch (UnauthorizedAccessException ex) { return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail(ex.Message)); }
        catch (InvalidOperationException ex) { return BadRequest(ApiResponse<object>.Fail(ex.Message)); }
    }

    [HttpPost("jobs/{id:guid}/cancel")]
    [ProducesResponseType(typeof(ApiResponse<GarageServiceJobDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CancelJob(
        Guid id,
        [FromBody] CancelJobRequest request,
        CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        var userId = GetEffectiveUserId();
        try
        {
            var job = await _serviceJobService.CancelJobAsync(id, garageId, userId, request, cancellationToken);
            return Ok(ApiResponse<GarageServiceJobDetailDto>.Ok(job, "Job cancelled."));
        }
        catch (KeyNotFoundException ex) { return NotFound(ApiResponse<object>.Fail(ex.Message)); }
        catch (UnauthorizedAccessException ex) { return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail(ex.Message)); }
        catch (InvalidOperationException ex) { return BadRequest(ApiResponse<object>.Fail(ex.Message)); }
        catch (ArgumentException ex) { return BadRequest(ApiResponse<object>.Fail(ex.Message)); }
    }

    [HttpPost("jobs/{id:guid}/additional-work")]
    [ProducesResponseType(typeof(ApiResponse<AdditionalWorkRequestDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateAdditionalWork(
        Guid id,
        [FromBody] CreateAdditionalWorkRequest request,
        CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        var userId = GetEffectiveUserId();
        try
        {
            var workReq = await _serviceJobService.CreateAdditionalWorkRequestAsync(id, garageId, userId, request, cancellationToken);
            return Ok(ApiResponse<AdditionalWorkRequestDto>.Ok(workReq, "Additional work request submitted for advisor review."));
        }
        catch (KeyNotFoundException ex) { return NotFound(ApiResponse<object>.Fail(ex.Message)); }
        catch (UnauthorizedAccessException ex) { return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail(ex.Message)); }
        catch (InvalidOperationException ex) { return BadRequest(ApiResponse<object>.Fail(ex.Message)); }
        catch (ArgumentException ex) { return BadRequest(ApiResponse<object>.Fail(ex.Message)); }
    }
}
