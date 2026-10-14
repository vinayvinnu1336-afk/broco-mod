using BroCoMod.Domain.Entities;

namespace BroCoMod.Infrastructure.Services;

/// <summary>
/// Basic / Standard / Premium bookings have a fixed price, so they never go to garages for quotes:
/// the advisor assigns a garage and the job is created directly. Requests booked before this rule
/// may still have garage dispatch rows, so every quote path checks the request itself.
/// </summary>
public static class PackageBookingRules
{
    public static string NotForGarageQuotes(string? requestNumber) =>
        $"{(string.IsNullOrWhiteSpace(requestNumber) ? "This booking" : requestNumber)} is a fixed-price BroCo package, so garages don't quote for it. " +
        "If BroCo assigns it to your garage, it appears under Jobs.";

    public static void EnsureQuotable(ServiceRequest? request)
    {
        if (request is { IsPackageBooking: true })
        {
            throw new InvalidOperationException(NotForGarageQuotes(request.RequestNumber));
        }
    }
}
