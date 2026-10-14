using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BroCoMod.Api.Controllers.v1;

/// <summary>
/// Settings the website needs at runtime. The Google Maps browser key is public by design (it ends
/// up in the page anyway) and is protected by its HTTP-referrer restriction in Google Cloud.
/// </summary>
[ApiController]
[Route("api/v1/config")]
[AllowAnonymous]
public class PublicConfigController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly IAddressLookupService _addresses;

    public PublicConfigController(IConfiguration configuration, IAddressLookupService addresses)
    {
        _configuration = configuration;
        _addresses = addresses;
    }

    [HttpGet("public")]
    public IActionResult GetPublic() =>
        Ok(ApiResponse<PublicConfigDto>.Ok(new PublicConfigDto(
            GoogleMapsBrowserKey: GeocodingSettings.BrowserKey(_configuration) ?? string.Empty,
            AddressLookupProvider: _addresses.ActiveProvider ?? GeocodingSettings.None)));
}
