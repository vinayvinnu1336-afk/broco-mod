using BroCoMod.Application.Common;
using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace BroCoMod.Api.Controllers.v1;

[ApiController]
[Route("api/v1/auth")]
[EnableRateLimiting("auth-rate-limit")]
public class AuthController : ControllerBase
{
    private readonly IIdentityService _identityService;
    private readonly ICurrentUserService _currentUserService;

    public AuthController(
        IIdentityService identityService,
        ICurrentUserService currentUserService)
    {
        _identityService = identityService;
        _currentUserService = currentUserService;
    }

    [HttpPost("register")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ApiResponse<AuthResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
            var result = await _identityService.RegisterAsync(request, ipAddress, cancellationToken);
            return Ok(ApiResponse<AuthResponse>.Ok(result, "Registration successful."));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ApiResponse<AuthResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
            var result = await _identityService.LoginAsync(request, ipAddress, cancellationToken);
            return Ok(ApiResponse<AuthResponse>.Ok(result, "Login successful."));
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(ApiResponse<object>.Fail(ex.Message));
        }
    }

    [HttpPost("refresh-token")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ApiResponse<AuthResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
            var result = await _identityService.RefreshTokenAsync(request.RefreshToken, ipAddress, cancellationToken);
            return Ok(ApiResponse<AuthResponse>.Ok(result, "Token refreshed successfully."));
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(ApiResponse<object>.Fail(ex.Message));
        }
    }

    [HttpPost("revoke-token")]
    [Authorize]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> RevokeToken([FromBody] RevokeTokenRequest request, CancellationToken cancellationToken)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        var success = await _identityService.RevokeRefreshTokenAsync(request.RefreshToken, ipAddress, cancellationToken);
        if (!success)
        {
            return BadRequest(ApiResponse<object>.Fail("Invalid or already revoked refresh token."));
        }

        return Ok(ApiResponse<bool>.Ok(true, "Refresh token revoked successfully."));
    }

    [HttpPost("logout")]
    [Authorize]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Logout([FromBody] RevokeTokenRequest? request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId;
        if (!userId.HasValue)
        {
            return Unauthorized();
        }

        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        await _identityService.LogoutAsync(userId.Value, request?.RefreshToken, ipAddress, cancellationToken);

        return Ok(ApiResponse<bool>.Ok(true, "Logged out successfully."));
    }

    /// <summary>Same answer whether or not an account exists, so the form cannot be used to find who is registered.</summary>
    public const string MobileResetSentMessage =
        "If this mobile number belongs to a BroCo account, we've sent a 6-digit code by WhatsApp or SMS. " +
        "If the number is linked to more than one account, reset your password with your email instead.";

    public const string EmailResetSentMessage = "If an account exists with this email, a reset code has been sent.";

    [HttpPost("forgot-password")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request, CancellationToken cancellationToken)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();

        try
        {
            // The reset code is delivered by WhatsApp / SMS / email only. Returning it here would let anyone reset any account.
            if (!string.IsNullOrWhiteSpace(request.MobileNumber))
            {
                if (!IndianMobile.IsValid(request.MobileNumber))
                {
                    return BadRequest(ApiResponse<object>.Fail(IndianMobile.InvalidMessage));
                }
                await _identityService.RequestPasswordResetByMobileAsync(request.MobileNumber, ipAddress, cancellationToken);
                return Ok(ApiResponse<object>.Ok(null!, MobileResetSentMessage));
            }

            if (string.IsNullOrWhiteSpace(request.Email))
            {
                return BadRequest(ApiResponse<object>.Fail("Enter your mobile number or email."));
            }

            await _identityService.RequestPasswordResetAsync(request.Email, ipAddress, cancellationToken);
            return Ok(ApiResponse<object>.Ok(null!, EmailResetSentMessage));
        }
        catch (TooManyRequestsException ex)
        {
            Response.Headers.RetryAfter = ((int)Math.Ceiling(ex.RetryAfter.TotalSeconds)).ToString();
            return StatusCode(StatusCodes.Status429TooManyRequests, ApiResponse<object>.Fail(ex.Message, new List<string> { "rate_limited" }));
        }
    }

    [HttpPost("reset-password")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request, CancellationToken cancellationToken)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();

        if (!string.IsNullOrWhiteSpace(request.MobileNumber))
        {
            var code = string.IsNullOrWhiteSpace(request.Code) ? request.Token : request.Code;
            var reset = await _identityService.ResetPasswordByMobileAsync(request.MobileNumber, code ?? string.Empty, request.NewPassword, ipAddress, cancellationToken);
            return reset
                ? Ok(ApiResponse<bool>.Ok(true, "Password has been successfully reset."))
                : BadRequest(ApiResponse<object>.Fail("That code is wrong or has expired. Check it, or request a new one."));
        }

        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Token))
        {
            return BadRequest(ApiResponse<object>.Fail("Invalid reset code or email."));
        }

        var success = await _identityService.ResetPasswordAsync(request.Email, request.Token, request.NewPassword, ipAddress, cancellationToken);

        if (!success)
        {
            return BadRequest(ApiResponse<object>.Fail("Invalid reset code or email."));
        }

        return Ok(ApiResponse<bool>.Ok(true, "Password has been successfully reset."));
    }
}
