using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace BroCoMod.Api.Controllers.v1;

/// <summary>
/// Admin → System health → Integrations. Status shows only whether each key is set; the test sends go to the
/// admin's own email or a mobile they type, and are rate-limited because each one can cost money.
/// </summary>
[ApiController]
[Route("api/v1/admin/integrations")]
[Authorize(Roles = AppRoles.SuperAdmin)]
public class AdminIntegrationsController : ControllerBase
{
    private readonly IIntegrationsService _integrations;
    private readonly ICurrentUserService _currentUser;

    public AdminIntegrationsController(IIntegrationsService integrations, ICurrentUserService currentUser)
    {
        _integrations = integrations;
        _currentUser = currentUser;
    }

    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<IntegrationsStatusDto>), StatusCodes.Status200OK)]
    public IActionResult GetStatus() => Ok(ApiResponse<IntegrationsStatusDto>.Ok(_integrations.GetStatus()));

    [HttpPost("test-email")]
    [EnableRateLimiting("integration-test-rate-limit")]
    [ProducesResponseType(typeof(ApiResponse<TestMessageResultDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> SendTestEmail(CancellationToken cancellationToken)
    {
        if (_currentUser.UserId is not { } adminId) return Unauthorized();
        var result = await _integrations.SendTestEmailAsync(adminId, cancellationToken);
        return Ok(ApiResponse<TestMessageResultDto>.Ok(result, result.Success ? "Test email accepted by ZeptoMail." : "Test email was not sent."));
    }

    /// <summary>Body: { mobileNumber, channel: "Sms" | "WhatsApp" }.</summary>
    [HttpPost("test-mobile")]
    [EnableRateLimiting("integration-test-rate-limit")]
    [ProducesResponseType(typeof(ApiResponse<TestMessageResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> SendTestMobileMessage([FromBody] SendTestMessageRequest request, CancellationToken cancellationToken)
    {
        if (_currentUser.UserId is not { } adminId) return Unauthorized();
        try
        {
            var result = await _integrations.SendTestMobileMessageAsync(adminId, request.MobileNumber ?? string.Empty, request.Channel ?? "Sms", cancellationToken);
            var label = result.Channel == "WhatsApp" ? "WhatsApp message" : "SMS";
            return Ok(ApiResponse<TestMessageResultDto>.Ok(result, result.Success ? $"Test {label} accepted by Gupshup." : $"Test {label} was not sent."));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
    }
}
