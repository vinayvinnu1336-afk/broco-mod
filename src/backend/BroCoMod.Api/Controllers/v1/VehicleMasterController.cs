using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace BroCoMod.Api.Controllers.v1;

[ApiController]
[Route("api/v1")]
public class VehicleMasterController : ControllerBase
{
    private readonly IVehicleMasterService _vehicleMasterService;

    public VehicleMasterController(IVehicleMasterService vehicleMasterService)
    {
        _vehicleMasterService = vehicleMasterService;
    }

    [HttpGet("vehicle-manufacturers")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<VehicleManufacturerDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetManufacturers(
        [FromQuery] string? search = null,
        [FromQuery] bool activeOnly = true,
        CancellationToken cancellationToken = default)
    {
        var manufacturers = await _vehicleMasterService.GetManufacturersAsync(search, activeOnly, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<VehicleManufacturerDto>>.Ok(manufacturers));
    }

    [HttpGet("vehicle-manufacturers/{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<VehicleManufacturerDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetManufacturerById(Guid id, CancellationToken cancellationToken)
    {
        var manufacturer = await _vehicleMasterService.GetManufacturerByIdAsync(id, cancellationToken);
        if (manufacturer == null)
        {
            return NotFound(ApiResponse<object>.Fail($"Vehicle manufacturer with ID '{id}' was not found."));
        }

        return Ok(ApiResponse<VehicleManufacturerDto>.Ok(manufacturer));
    }

    [HttpGet("vehicle-manufacturers/{id:guid}/models")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<VehicleModelDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetModelsByManufacturer(
        Guid id,
        [FromQuery] string? bodyType = null,
        [FromQuery] bool activeOnly = true,
        CancellationToken cancellationToken = default)
    {
        var manufacturer = await _vehicleMasterService.GetManufacturerByIdAsync(id, cancellationToken);
        if (manufacturer == null)
        {
            return NotFound(ApiResponse<object>.Fail($"Vehicle manufacturer with ID '{id}' was not found."));
        }

        var models = await _vehicleMasterService.GetModelsByManufacturerAsync(id, bodyType, activeOnly, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<VehicleModelDto>>.Ok(models));
    }

    [HttpGet("vehicle-models/{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<VehicleModelDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetModelById(Guid id, CancellationToken cancellationToken)
    {
        var model = await _vehicleMasterService.GetModelByIdAsync(id, cancellationToken);
        if (model == null)
        {
            return NotFound(ApiResponse<object>.Fail($"Vehicle model with ID '{id}' was not found."));
        }

        return Ok(ApiResponse<VehicleModelDto>.Ok(model));
    }

    [HttpGet("vehicle-models/{id:guid}/variants")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<VehicleVariantDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetVariantsByModel(
        Guid id,
        [FromQuery] bool activeOnly = true,
        CancellationToken cancellationToken = default)
    {
        var model = await _vehicleMasterService.GetModelByIdAsync(id, cancellationToken);
        if (model == null)
        {
            return NotFound(ApiResponse<object>.Fail($"Vehicle model with ID '{id}' was not found."));
        }

        var variants = await _vehicleMasterService.GetVariantsByModelAsync(id, activeOnly, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<VehicleVariantDto>>.Ok(variants));
    }

    [HttpGet("vehicle-master/fuel-types")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<VehicleFuelTypeDto>>), StatusCodes.Status200OK)]
    public IActionResult GetFuelTypes()
    {
        var fuelTypes = _vehicleMasterService.GetFuelTypes();
        return Ok(ApiResponse<IReadOnlyList<VehicleFuelTypeDto>>.Ok(fuelTypes));
    }
}
