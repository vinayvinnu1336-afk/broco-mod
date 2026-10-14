using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BroCoMod.Api.Controllers.v1;

/// <summary>
/// Advisors follow up on commission garages still owe BroCo: every garage's unpaid dues and on-demand reminders.
/// Recording payments and waiving stay with admins.
/// </summary>
[ApiController]
[Route("api/v1/advisor/commissions")]
[Authorize(Roles = $"{AppRoles.Advisor},{AppRoles.SuperAdmin}")]
public class AdvisorCommissionController : ControllerBase
{
    private readonly ICommissionDuesService _dues;
    private readonly ICurrentUserService _currentUser;

    public AdvisorCommissionController(ICommissionDuesService dues, ICurrentUserService currentUser)
    {
        _dues = dues;
        _currentUser = currentUser;
    }

    private Guid StaffId => _currentUser.UserId ?? Guid.Empty;

    /// <summary>Commission dues; status Due (default), Overdue, Paid, Waived or All.</summary>
    [HttpGet]
    public async Task<IActionResult> GetDues(
        [FromQuery] string? status, [FromQuery] Guid? garageId, [FromQuery] string? search,
        [FromQuery] DateTime? dueFrom, [FromQuery] DateTime? dueTo, [FromQuery] string? sort,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default) =>
        Ok(ApiResponse<PagedResult<GarageCommissionDto>>.Ok(await _dues.GetDuesAsync(
            new CommissionDuesQuery(search, status, garageId, dueFrom, dueTo, sort, page, pageSize), ct)));

    [HttpGet("overview")]
    public async Task<IActionResult> GetOverview(CancellationToken ct) =>
        Ok(ApiResponse<GarageDuesOverviewDto>.Ok(await _dues.GetDuesOverviewAsync(ct)));

    [HttpGet("garages")]
    public async Task<IActionResult> GetGarages(CancellationToken ct) =>
        Ok(ApiResponse<IReadOnlyList<GarageDuesSummaryDto>>.Ok(await _dues.GetGarageDuesAsync(ct)));

    [HttpPost("{id:guid}/remind")]
    public async Task<IActionResult> Remind(Guid id, CancellationToken ct) =>
        CommissionReminderResponse.From(this, await _dues.SendManualReminderAsync(id, StaffId, ct));

    [HttpPost("remind-overdue")]
    public async Task<IActionResult> RemindOverdue([FromBody] RemindOverdueCommissionsRequest? request, CancellationToken ct) =>
        Ok(CommissionReminderResponse.Bulk(await _dues.RemindOverdueAsync(request?.GarageId, StaffId, ct)));
}

/// <summary>Shared by the admin and advisor reminder endpoints.</summary>
internal static class CommissionReminderResponse
{
    public static IActionResult From(ControllerBase controller, CommissionReminderResultDto result)
    {
        if (result.Sent) return controller.Ok(ApiResponse<CommissionReminderResultDto>.Ok(result, result.Message));
        var status = result.NotSentReason == ReminderNotSent.TooSoon ? StatusCodes.Status429TooManyRequests : StatusCodes.Status409Conflict;
        return controller.StatusCode(status, new ApiResponse<CommissionReminderResultDto>(false, result.Message, result, new[] { result.Message }));
    }

    public static ApiResponse<BulkCommissionReminderResultDto> Bulk(BulkCommissionReminderResultDto result)
    {
        var message = result.DuesReminded == 0
            ? result.SkippedRecentlyReminded > 0
                ? "Every overdue garage was already reminded in the last hour."
                : "No overdue dues to remind."
            : $"Reminded {result.GaragesReminded} garage{(result.GaragesReminded == 1 ? "" : "s")} about {result.DuesReminded} overdue due{(result.DuesReminded == 1 ? "" : "s")}." +
              (result.SkippedRecentlyReminded > 0 ? $" {result.SkippedRecentlyReminded} reminded in the last hour were skipped." : "");
        return ApiResponse<BulkCommissionReminderResultDto>.Ok(result, message);
    }
}
