using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Net.Http.Headers;

namespace BroCoMod.Api.Controllers.v1;

/// <summary>Public data for the website: cities, service packages with prices, brand logos and enquiries.</summary>
[ApiController]
[Route("api/v1")]
[AllowAnonymous]
public class CatalogueController : ControllerBase
{
    private readonly ICatalogueService _catalogue;
    private readonly IServiceAreaService _serviceAreas;
    private readonly ILeadService _leads;

    public CatalogueController(ICatalogueService catalogue, IServiceAreaService serviceAreas, ILeadService leads)
    {
        _catalogue = catalogue;
        _serviceAreas = serviceAreas;
        _leads = leads;
    }

    [HttpGet("service-areas")]
    public IActionResult GetServiceAreas() =>
        Ok(ApiResponse<IReadOnlyList<ServiceAreaDto>>.Ok(_serviceAreas.GetAreas()));

    [HttpGet("service-packages")]
    public async Task<IActionResult> GetPackages(CancellationToken ct) =>
        Ok(ApiResponse<IReadOnlyList<ServicePackageDto>>.Ok(await _catalogue.GetPackagesAsync(true, ct)));

    /// <summary>Basic / Standard / Premium prices for one car model and fuel.</summary>
    [HttpGet("service-packages/offers")]
    public async Task<IActionResult> GetOffers([FromQuery] Guid modelId, [FromQuery] string fuelType, CancellationToken ct) =>
        Ok(ApiResponse<PackageOffersResponse>.Ok(await _catalogue.GetPackageOffersAsync(modelId, fuelType, ct)));

    [HttpGet("vehicle-manufacturers/{id:guid}/logo")]
    [ResponseCache(Duration = 86400, Location = ResponseCacheLocation.Any)]
    public async Task<IActionResult> GetLogo(Guid id, CancellationToken ct)
    {
        var logo = await _catalogue.GetManufacturerLogoAsync(id, ct);
        if (logo == null) return NotFound();

        Response.Headers[HeaderNames.XContentTypeOptions] = "nosniff";
        // Uploaded SVGs are screened on upload; the sandbox stops anything that slipped through from running.
        Response.Headers[HeaderNames.ContentSecurityPolicy] = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
        return File(logo.Content, logo.ContentType, lastModified: logo.UpdatedAtUtc, entityTag: null);
    }

    /// <summary>"Check prices" form on the home page: stores the mobile number for a call-back.</summary>
    [HttpPost("leads")]
    [EnableRateLimiting("auth-rate-limit")]
    public async Task<IActionResult> CreateLead([FromBody] CreateLeadRequest request, CancellationToken ct) =>
        Ok(ApiResponse<LeadDto>.Ok(await _leads.CreateAsync(request, ct), "Thanks! We'll call you shortly."));
}
