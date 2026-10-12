using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BroCoMod.Api.Controllers.v1;

/// <summary>Customer pays the 10% booking advance for a fixed-price package request.</summary>
[ApiController]
[Route("api/v1/customer")]
[Authorize(Roles = $"{AppRoles.Customer},{AppRoles.SuperAdmin}")]
public class CustomerAdvanceController : ControllerBase
{
    private readonly IPaymentService _payments;
    private readonly ICurrentUserService _currentUser;

    public CustomerAdvanceController(IPaymentService payments, ICurrentUserService currentUser)
    {
        _payments = payments;
        _currentUser = currentUser;
    }

    [HttpPost("requests/{id:guid}/advance/pay")]
    public async Task<IActionResult> PayAdvance(
        Guid id,
        [FromBody] InitiateAdvancePaymentRequest? request,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKeyHeader,
        CancellationToken ct)
    {
        var customerId = _currentUser.CustomerId ?? _currentUser.UserId
            ?? throw new UnauthorizedAccessException("Authenticated user has no valid customer profile.");
        var key = !string.IsNullOrWhiteSpace(request?.IdempotencyKey) ? request!.IdempotencyKey : idempotencyKeyHeader;
        var result = await _payments.InitiateRequestAdvanceAsync(id, customerId, key, ct);
        return Ok(ApiResponse<InitiatePaymentResponseDto>.Ok(result, "Booking advance checkout created."));
    }
}

/// <summary>Advisor assigns a garage to a paid package booking (no garage bidding needed).</summary>
[ApiController]
[Route("api/v1/advisor")]
[Authorize(Roles = $"{AppRoles.Advisor},{AppRoles.SuperAdmin}")]
public class AdvisorPackageController : ControllerBase
{
    private readonly IPackageBookingService _packages;
    private readonly ICurrentUserService _currentUser;

    public AdvisorPackageController(IPackageBookingService packages, ICurrentUserService currentUser)
    {
        _packages = packages;
        _currentUser = currentUser;
    }

    [HttpGet("requests/{id:guid}/package-garages")]
    public async Task<IActionResult> GetCandidates(Guid id, CancellationToken ct) =>
        Ok(ApiResponse<IReadOnlyList<PackageGarageCandidateDto>>.Ok(await _packages.GetCandidateGaragesAsync(id, ct)));

    [HttpPost("requests/{id:guid}/package-assignment")]
    public async Task<IActionResult> Assign(Guid id, [FromBody] AssignPackageGarageRequest request, CancellationToken ct)
    {
        var advisorId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Not signed in.");
        var result = await _packages.AssignGarageAsync(id, request.GarageId, advisorId, request.Reason, ct);
        return Ok(ApiResponse<PackageAssignmentResultDto>.Ok(result, $"Booking confirmed with {result.GarageName}."));
    }
}
