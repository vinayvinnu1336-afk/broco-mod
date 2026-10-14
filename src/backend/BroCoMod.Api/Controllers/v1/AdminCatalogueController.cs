using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BroCoMod.Api.Controllers.v1;

/// <summary>Admin management of brands, models, logos, service packages, prices, commission dues and enquiries.</summary>
[ApiController]
[Route("api/v1/admin")]
[Authorize(Roles = AppRoles.SuperAdmin)]
public class AdminCatalogueController : ControllerBase
{
    private readonly ICatalogueService _catalogue;
    private readonly ICommissionService _commissions;
    private readonly ICommissionDuesService _dues;
    private readonly ILeadService _leads;
    private readonly ICurrentUserService _currentUser;

    public AdminCatalogueController(ICatalogueService catalogue, ICommissionService commissions, ICommissionDuesService dues, ILeadService leads, ICurrentUserService currentUser)
    {
        _catalogue = catalogue;
        _commissions = commissions;
        _dues = dues;
        _leads = leads;
        _currentUser = currentUser;
    }

    private Guid AdminId => _currentUser.UserId ?? Guid.Empty;

    // ----- Brands -----

    [HttpPost("catalogue/manufacturers")]
    public async Task<IActionResult> CreateManufacturer([FromBody] UpsertManufacturerRequest request, CancellationToken ct) =>
        StatusCode(StatusCodes.Status201Created, ApiResponse<VehicleManufacturerDto>.Ok(await _catalogue.CreateManufacturerAsync(request, ct), "Brand added."));

    [HttpPut("catalogue/manufacturers/{id:guid}")]
    public async Task<IActionResult> UpdateManufacturer(Guid id, [FromBody] UpsertManufacturerRequest request, CancellationToken ct) =>
        Ok(ApiResponse<VehicleManufacturerDto>.Ok(await _catalogue.UpdateManufacturerAsync(id, request, ct), "Brand updated."));

    [HttpPost("catalogue/manufacturers/{id:guid}/logo")]
    [RequestSizeLimit(1024 * 1024)]
    public async Task<IActionResult> UploadLogo(Guid id, IFormFile file, CancellationToken ct)
    {
        if (file == null || file.Length == 0) return BadRequest(ApiResponse<object>.Fail("Choose an image file."));
        using var stream = new MemoryStream();
        await file.CopyToAsync(stream, ct);
        return Ok(ApiResponse<VehicleManufacturerDto>.Ok(await _catalogue.SetManufacturerLogoAsync(id, stream.ToArray(), file.ContentType, ct), "Logo updated."));
    }

    [HttpDelete("catalogue/manufacturers/{id:guid}/logo")]
    public async Task<IActionResult> RemoveLogo(Guid id, CancellationToken ct) =>
        Ok(ApiResponse<VehicleManufacturerDto>.Ok(await _catalogue.RemoveManufacturerLogoAsync(id, ct), "Logo removed."));

    // ----- Models -----

    [HttpPost("catalogue/manufacturers/{id:guid}/models")]
    public async Task<IActionResult> CreateModel(Guid id, [FromBody] UpsertVehicleModelRequest request, CancellationToken ct) =>
        StatusCode(StatusCodes.Status201Created, ApiResponse<VehicleModelDto>.Ok(await _catalogue.CreateModelAsync(id, request, ct), "Model added."));

    [HttpPut("catalogue/models/{id:guid}")]
    public async Task<IActionResult> UpdateModel(Guid id, [FromBody] UpsertVehicleModelRequest request, CancellationToken ct) =>
        Ok(ApiResponse<VehicleModelDto>.Ok(await _catalogue.UpdateModelAsync(id, request, ct), "Model updated."));

    // ----- Packages & prices -----

    [HttpGet("catalogue/packages")]
    public async Task<IActionResult> GetPackages(CancellationToken ct) =>
        Ok(ApiResponse<IReadOnlyList<ServicePackageDto>>.Ok(await _catalogue.GetPackagesAsync(false, ct)));

    [HttpPut("catalogue/packages/{id:guid}")]
    public async Task<IActionResult> UpdatePackage(Guid id, [FromBody] UpdateServicePackageRequest request, CancellationToken ct) =>
        Ok(ApiResponse<ServicePackageDto>.Ok(await _catalogue.UpdatePackageAsync(id, request, ct), "Package updated."));

    [HttpGet("catalogue/models/{id:guid}/prices")]
    public async Task<IActionResult> GetModelPrices(Guid id, CancellationToken ct) =>
        Ok(ApiResponse<ModelPriceSheetDto>.Ok(await _catalogue.GetModelPriceSheetAsync(id, ct)));

    [HttpPut("catalogue/models/{id:guid}/prices")]
    public async Task<IActionResult> SetModelPrices(Guid id, [FromBody] SetModelPricesRequest request, CancellationToken ct) =>
        Ok(ApiResponse<ModelPriceSheetDto>.Ok(await _catalogue.SetModelPricesAsync(id, request, AdminId, ct), "Prices saved."));

    /// <summary>Set one package price for every model in a segment and fuel (e.g. all petrol hatchbacks).</summary>
    [HttpPost("catalogue/prices/segment")]
    public async Task<IActionResult> ApplySegmentPrice([FromBody] ApplySegmentPriceRequest request, CancellationToken ct) =>
        Ok(ApiResponse<ApplySegmentPriceResult>.Ok(await _catalogue.ApplySegmentPriceAsync(request, AdminId, ct)));

    // ----- Garage commission dues -----

    /// <summary>Commission dues with search, status (Due / Overdue / Paid / Waived; all when omitted), garage and due-date filters.</summary>
    [HttpGet("commissions")]
    public async Task<IActionResult> GetCommissions(
        [FromQuery] string? status, [FromQuery] Guid? garageId, [FromQuery] string? search,
        [FromQuery] DateTime? dueFrom, [FromQuery] DateTime? dueTo, [FromQuery] string? sort,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default) =>
        Ok(ApiResponse<PagedResult<GarageCommissionDto>>.Ok(await _dues.GetDuesAsync(
            new CommissionDuesQuery(search, string.IsNullOrWhiteSpace(status) ? "All" : status, garageId, dueFrom, dueTo, sort, page, pageSize), ct)));

    [HttpGet("commissions/overview")]
    public async Task<IActionResult> GetCommissionOverview(CancellationToken ct) =>
        Ok(ApiResponse<AdminCommissionOverviewDto>.Ok(await _commissions.GetAdminOverviewAsync(ct)));

    /// <summary>Every garage with unpaid commission, most overdue first.</summary>
    [HttpGet("commissions/garages")]
    public async Task<IActionResult> GetGarageDues(CancellationToken ct) =>
        Ok(ApiResponse<IReadOnlyList<GarageDuesSummaryDto>>.Ok(await _dues.GetGarageDuesAsync(ct)));

    /// <summary>Reminds the garage about one due now (429 if staff already reminded it in the last hour).</summary>
    [HttpPost("commissions/{id:guid}/remind")]
    public async Task<IActionResult> RemindCommission(Guid id, CancellationToken ct) =>
        CommissionReminderResponse.From(this, await _dues.SendManualReminderAsync(id, AdminId, ct));

    [HttpPost("commissions/remind-overdue")]
    public async Task<IActionResult> RemindOverdueCommissions([FromBody] RemindOverdueCommissionsRequest? request, CancellationToken ct) =>
        Ok(CommissionReminderResponse.Bulk(await _dues.RemindOverdueAsync(request?.GarageId, AdminId, ct)));

    [HttpPost("commissions/{id:guid}/mark-received")]
    public async Task<IActionResult> MarkReceived(Guid id, [FromBody] MarkCommissionReceivedRequest request, CancellationToken ct) =>
        Ok(ApiResponse<GarageCommissionDto>.Ok(await _commissions.MarkReceivedAsync(id, request, AdminId, ct), "Marked as received."));

    [HttpPost("commissions/{id:guid}/waive")]
    public async Task<IActionResult> Waive(Guid id, [FromBody] WaiveCommissionRequest request, CancellationToken ct) =>
        Ok(ApiResponse<GarageCommissionDto>.Ok(await _commissions.WaiveAsync(id, request, AdminId, ct), "Commission waived."));

    // ----- Commission terms -----

    [HttpGet("settings/commission")]
    public async Task<IActionResult> GetCommissionTerms(CancellationToken ct) =>
        Ok(ApiResponse<CommissionTermsDto>.Ok(await _commissions.GetTermsAsync(ct)));

    [HttpPut("settings/commission")]
    public async Task<IActionResult> UpdateCommissionTerms([FromBody] UpdateCommissionTermsRequest request, CancellationToken ct) =>
        Ok(ApiResponse<CommissionTermsDto>.Ok(await _commissions.UpdateTermsAsync(request, AdminId, ct), "Commission terms saved."));

    // ----- Website enquiries -----

    [HttpGet("leads")]
    public async Task<IActionResult> GetLeads([FromQuery] string? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null, [FromQuery] string? city = null,
        [FromQuery] DateTime? fromDateUtc = null, [FromQuery] DateTime? toDateUtc = null, CancellationToken ct = default) =>
        Ok(ApiResponse<PagedResult<LeadDto>>.Ok(await _leads.GetLeadsAsync(status, page, pageSize, ct,
            new ListFilter(search, null, fromDateUtc, toDateUtc), city)));

    [HttpPut("leads/{id:guid}")]
    public async Task<IActionResult> UpdateLead(Guid id, [FromBody] UpdateLeadRequest request, CancellationToken ct) =>
        Ok(ApiResponse<LeadDto>.Ok(await _leads.UpdateAsync(id, request, ct)));
}
