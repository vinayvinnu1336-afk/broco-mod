using BroCoMod.Application.DTOs;
using BroCoMod.Domain.Exceptions;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.EntityFrameworkCore;

namespace BroCoMod.Api.Infrastructure;

/// <summary>
/// Last-resort handler for exceptions that controllers do not catch themselves.
/// Maps known domain/application exceptions to the matching HTTP status and always answers with the
/// standard <see cref="ApiResponse{T}"/> envelope. Internal details are only exposed in Development.
/// </summary>
public sealed class GlobalExceptionHandler : IExceptionHandler
{
    private readonly ILogger<GlobalExceptionHandler> _logger;
    private readonly IHostEnvironment _environment;

    public GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger, IHostEnvironment environment)
    {
        _logger = logger;
        _environment = environment;
    }

    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        var (status, message) = exception switch
        {
            DataIsolationViolationException => (StatusCodes.Status403Forbidden, "You do not have access to this resource."),
            UnauthorizedAccessException => (StatusCodes.Status403Forbidden, exception.Message),
            KeyNotFoundException => (StatusCodes.Status404NotFound, exception.Message),
            DbUpdateConcurrencyException => (StatusCodes.Status409Conflict, "This record was changed by someone else. Refresh and try again."),
            InvalidOperationException => (StatusCodes.Status409Conflict, exception.Message),
            ArgumentException => (StatusCodes.Status400BadRequest, exception.Message),
            OperationCanceledException => (499, "Request was cancelled."),
            _ => (StatusCodes.Status500InternalServerError, "Something went wrong on our side. Please try again.")
        };

        if (status >= 500)
        {
            _logger.LogError(exception, "Unhandled exception for {Method} {Path}", httpContext.Request.Method, httpContext.Request.Path);
        }
        else
        {
            _logger.LogWarning("Request {Method} {Path} failed with {Status}: {Message}", httpContext.Request.Method, httpContext.Request.Path, status, exception.Message);
        }

        if (status >= 500 && _environment.IsDevelopment())
        {
            message = $"{message} ({exception.GetType().Name}: {exception.Message})";
        }

        httpContext.Response.StatusCode = status;
        await httpContext.Response.WriteAsJsonAsync(ApiResponse<object>.Fail(message), cancellationToken);
        return true;
    }
}
