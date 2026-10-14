using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace BroCoMod.Api.Controllers.v1;

/// <summary>Address autofill for the booking location step ("Use my current location", map pins).</summary>
[ApiController]
[Route("api/v1/geo")]
[Authorize]
public class GeoController : ControllerBase
{
    private readonly IAddressLookupService _addresses;

    public GeoController(IAddressLookupService addresses)
    {
        _addresses = addresses;
    }

    /// <summary>
    /// Address fields for a pin. <c>data</c> is null when no provider is configured or none found an
    /// address; the customer then types it. <c>provider</c> tells the website which attribution to show.
    /// </summary>
    [HttpGet("reverse")]
    [EnableRateLimiting("geo-rate-limit")]
    public async Task<IActionResult> Reverse([FromQuery] double? lat, [FromQuery] double? lng, CancellationToken ct)
    {
        if (lat is not { } latitude || lng is not { } longitude)
            return BadRequest(ApiResponse<object>.Fail("Send the pin as lat and lng."));
        if (!double.IsFinite(latitude) || latitude is < -90 or > 90 || !double.IsFinite(longitude) || longitude is < -180 or > 180)
            return BadRequest(ApiResponse<object>.Fail("Latitude must be between -90 and 90, and longitude between -180 and 180."));

        var address = await _addresses.ReverseAsync(latitude, longitude, ct);
        return Ok(address == null
            ? ApiResponse<AddressLookupDto?>.Ok(null, "We could not find an address for this spot. Please type it.")
            : ApiResponse<AddressLookupDto?>.Ok(address));
    }
}
