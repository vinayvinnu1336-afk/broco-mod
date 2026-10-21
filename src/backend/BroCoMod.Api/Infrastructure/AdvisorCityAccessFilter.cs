using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace BroCoMod.Api.Infrastructure;

/// <summary>
/// Advisors work in one city. Before any advisor endpoint that names a record (a request, quotation, garage quote,
/// job, additional-work request, commission or garage) runs, this checks the record belongs to the advisor's city
/// (or is assigned to them) and answers 404 otherwise, exactly as if it didn't exist. Admins pass straight through.
/// Lists are limited in the services' own queries.
/// </summary>
public sealed class AdvisorCityAccessFilter : IAsyncActionFilter
{
    private readonly IAdvisorCityScope _scope;

    public AdvisorCityAccessFilter(IAdvisorCityScope scope) => _scope = scope;

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var ct = context.HttpContext.RequestAborted;
        if (await _scope.GetRestrictionAsync(ct) == null || await AllowedAsync(context, ct))
        {
            await next();
            return;
        }

        context.Result = new NotFoundObjectResult(ApiResponse<object>.Fail("Not found. It may belong to another city."));
    }

    private async Task<bool> AllowedAsync(ActionExecutingContext context, CancellationToken ct)
    {
        var template = "/" + (context.ActionDescriptor.AttributeRouteInfo?.Template ?? string.Empty).ToLowerInvariant();

        if (RouteGuid(context, "id") is { } id)
        {
            var allowed = template switch
            {
                _ when template.Contains("/requests/{id") => await _scope.CanAccessRequestAsync(id, ct),
                _ when template.Contains("/customer-quotations/{id") => await _scope.CanAccessCustomerQuotationAsync(id, ct),
                _ when template.Contains("/garage-quotes/{id") => await _scope.CanAccessGarageQuoteAsync(id, ct),
                _ when template.Contains("/jobs/{id") => await _scope.CanAccessJobAsync(id, ct),
                _ when template.Contains("/commissions/{id") => await _scope.CanAccessCommissionAsync(id, ct),
                _ => true,
            };
            if (!allowed) return false;
        }

        if (RouteGuid(context, "workRequestId") is { } workRequestId && !await _scope.CanAccessAdditionalWorkAsync(workRequestId, ct))
            return false;

        if (QueryGuid(context, "serviceRequestId") is { } requestId && !await _scope.CanAccessRequestAsync(requestId, ct))
            return false;

        if (QueryGuid(context, "garageId") is { } garageId && !await _scope.CanAccessGarageAsync(garageId, ct))
            return false;

        return true;
    }

    private static Guid? RouteGuid(ActionExecutingContext context, string name) =>
        context.RouteData.Values.TryGetValue(name, out var value) && Guid.TryParse(value?.ToString(), out var id) ? id : null;

    private static Guid? QueryGuid(ActionExecutingContext context, string name) =>
        Guid.TryParse(context.HttpContext.Request.Query[name].ToString(), out var id) ? id : null;
}
