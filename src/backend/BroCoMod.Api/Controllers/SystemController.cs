using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Application.Security;
using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Enums;
using Microsoft.AspNetCore.Mvc;

namespace BroCoMod.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SystemController : ControllerBase
{
    private readonly IGarageService _garageService;
    private readonly ILogger<SystemController> _logger;

    public SystemController(IGarageService garageService, ILogger<SystemController> logger)
    {
        _garageService = garageService;
        _logger = logger;
    }

    [HttpGet("info")]
    public IActionResult GetSystemInfo()
    {
        return Ok(new
        {
            platform = "BroCo Mod Platform",
            version = "1.0.0-foundation",
            architecture = "Modular Monolith (Stateless Core)",
            horizontalScalingReady = true,
            database = "PostgreSQL + PostGIS (Spatial 4326)",
            cache = "Redis 7",
            defaultSearchRadiusKm = 10.0,
            portals = new[]
            {
                new { name = "Customer Portal", audience = "Vehicle Owners", role = "Customer" },
                new { name = "Garage Portal", audience = "Service Centers", role = "Garage" },
                new { name = "Advisor Portal", audience = "BroCo Service Advisors", role = "Advisor" },
                new { name = "Super Admin Portal", audience = "Platform Administrators", role = "SuperAdmin" }
            },
            pricingSecurity = "Strict data isolation enforced via role-based DTO projections and policies. Garage internal pricing is permanently segregated from customers."
        });
    }

    [HttpGet("garages/eligible")]
    public async Task<IActionResult> FindEligibleGarages(
        [FromQuery] double longitude,
        [FromQuery] double latitude,
        [FromQuery] double radiusKm = 10.0,
        CancellationToken cancellationToken = default)
    {
        var garages = await _garageService.FindEligibleGaragesAsync(longitude, latitude, radiusKm, cancellationToken);
        return Ok(new
        {
            searchRadiusKm = radiusKm,
            coordinates = new { longitude, latitude },
            count = garages.Count(),
            garages
        });
    }

    /// <summary>
    /// Demonstrates the architectural pricing security guarantee:
    /// Garage internal price is never leaked to the Customer DTO projection.
    /// </summary>
    [HttpGet("quote-isolation-demo")]
    public IActionResult DemonstrateQuoteIsolation()
    {
        var dummyServiceRequestId = Guid.NewGuid();
        var dummyGarageId = Guid.NewGuid();

        // 1. Garage submits internal quote with cost breakdown
        var garageInternalQuote = new GarageQuote(
            dummyServiceRequestId,
            dummyGarageId,
            garageInternalPrice: 350.00m,
            internalCostBreakdown: "Parts: $220.00 (Wholesale), Labor: $130.00 (3 hrs @ $43.33/hr)",
            garageNotes: "Includes OEM brake pads and rotors replacement.",
            estimatedDurationHours: 3
        );

        // 2. Advisor reviews quote, applies margin, and prepares Customer quotation
        var customerFacingQuotation = new CustomerQuotation(
            dummyServiceRequestId,
            dummyGarageId,
            customerFacingPrice: 489.99m,
            advisorMarginApplied: 139.99m,
            scopeSummary: "Complete front brake pads and rotors replacement with warranty.",
            advisorNotes: "Approved standard tier markup. Dispatched to customer."
        );

        // 3. Project for Customer (Internal pricing strictly stripped)
        var customerDto = QuoteDataIsolationPolicy.ProjectToCustomerView(customerFacingQuotation);

        // 4. Project for Garage Owner
        var garageDto = QuoteDataIsolationPolicy.ProjectToGarageInternalView(garageInternalQuote, UserRole.Garage, dummyGarageId);

        return Ok(new
        {
            securityPolicy = "Pricing Data Isolation Guarantee",
            description = "Comparison of payload returned to Customer vs Garage internal view",
            customerVisiblePayload = customerDto,
            garageInternalPayload = garageDto,
            note = "Notice that customerVisiblePayload contains NO internal cost breakdown and NO garage internal price."
        });
    }
}
