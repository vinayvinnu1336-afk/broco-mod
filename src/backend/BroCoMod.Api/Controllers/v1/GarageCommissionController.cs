using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BroCoMod.Api.Controllers.v1;

/// <summary>The garage's BroCo commission dues and online payment of them.</summary>
[ApiController]
[Route("api/v1/garage/commission")]
[Authorize(Roles = $"{AppRoles.GarageOwner},{AppRoles.GarageManager},{AppRoles.GarageStaff}")]
public class GarageCommissionController : ControllerBase
{
    private readonly ICommissionService _commissions;
    private readonly IPaymentService _payments;
    private readonly ICurrentUserService _currentUser;

    public GarageCommissionController(ICommissionService commissions, IPaymentService payments, ICurrentUserService currentUser)
    {
        _commissions = commissions;
        _payments = payments;
        _currentUser = currentUser;
    }

    private Guid GarageId => _currentUser.GarageId ?? throw new UnauthorizedAccessException("Your account isn't linked to a garage.");
    private Guid UserId => _currentUser.UserId ?? throw new UnauthorizedAccessException("Not signed in.");

    [HttpGet]
    public async Task<IActionResult> GetDues([FromQuery] string? status, CancellationToken ct) =>
        Ok(ApiResponse<IReadOnlyList<GarageCommissionDto>>.Ok(await _commissions.GetGarageCommissionsAsync(GarageId, status, ct)));

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct) =>
        Ok(ApiResponse<GarageCommissionSummaryDto>.Ok(await _commissions.GetGarageSummaryAsync(GarageId, ct)));

    /// <summary>Starts one online payment for the selected dues (all outstanding dues when none are given).</summary>
    [HttpPost("pay")]
    public async Task<IActionResult> Pay([FromBody] PayCommissionsRequest request, CancellationToken ct) =>
        Ok(ApiResponse<InitiatePaymentResponseDto>.Ok(await _commissions.InitiateCommissionPaymentAsync(GarageId, UserId, request, ct)));

    [HttpPost("verify")]
    public async Task<IActionResult> Verify([FromBody] VerifyPaymentRequestDto request, CancellationToken ct) =>
        Ok(ApiResponse<PaymentDto>.Ok(await _payments.VerifyAndCompletePaymentAsync(request, UserId, ct), "Payment received. Thank you!"));
}
