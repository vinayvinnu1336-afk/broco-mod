using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BroCoMod.Api.Controllers.v1;

[ApiController]
[Route("api/v1/garage/finance")]
[Authorize(Roles = $"{AppRoles.GarageOwner},{AppRoles.GarageManager},{AppRoles.GarageStaff},{AppRoles.SuperAdmin}")]
public class GarageFinanceController : ControllerBase
{
    private readonly ISettlementService _settlementService;
    private readonly ICurrentUserService _currentUserService;

    public GarageFinanceController(
        ISettlementService settlementService,
        ICurrentUserService currentUserService)
    {
        _settlementService = settlementService;
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

    [HttpGet("settlements")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<GarageSettlementDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSettlements(CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        var settlements = await _settlementService.GetGarageSettlementsAsync(garageId, cancellationToken);
        return Ok(ApiResponse<IEnumerable<GarageSettlementDto>>.Ok(settlements));
    }

    [HttpGet("settlements/{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<GarageSettlementDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSettlementById(Guid id, CancellationToken cancellationToken)
    {
        var garageId = GetEffectiveGarageId();
        var settlement = await _settlementService.GetSettlementByIdAsync(id, garageId, cancellationToken);
        if (settlement == null)
            return NotFound(ApiResponse<object>.Fail("Settlement not found or does not belong to your garage."));

        return Ok(ApiResponse<GarageSettlementDto>.Ok(settlement));
    }
}
