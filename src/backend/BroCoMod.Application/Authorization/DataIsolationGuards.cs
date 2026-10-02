using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Exceptions;

namespace BroCoMod.Application.Authorization;

public static class DataIsolationGuards
{
    public static void AssertCustomerAccess(ICurrentUserService currentUserService, Guid resourceCustomerId, string resourceName = "resource")
    {
        if (currentUserService.IsInRole("SUPER_ADMIN") || currentUserService.IsInRole("ADVISOR"))
        {
            return;
        }

        if (!currentUserService.CustomerId.HasValue || currentUserService.CustomerId.Value != resourceCustomerId)
        {
            throw new DataIsolationViolationException(
                $"Data Isolation Violation: You are not authorized to access this {resourceName}. Customers can only access their own data.");
        }
    }

    public static void AssertGarageAccess(ICurrentUserService currentUserService, Guid resourceGarageId, string resourceName = "garage resource")
    {
        if (currentUserService.IsInRole("SUPER_ADMIN") || currentUserService.IsInRole("ADVISOR"))
        {
            return;
        }

        if (!currentUserService.GarageId.HasValue || currentUserService.GarageId.Value != resourceGarageId)
        {
            throw new DataIsolationViolationException(
                $"Data Isolation Violation: You are not authorized to access this {resourceName}. Garages can only access their own data.");
        }
    }
}
