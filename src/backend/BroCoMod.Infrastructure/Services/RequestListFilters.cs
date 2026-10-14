using BroCoMod.Application.Common;
using BroCoMod.Domain.Entities;

namespace BroCoMod.Infrastructure.Services;

/// <summary>Service-type, category and city filters shared by the admin and advisor request lists.</summary>
internal static class RequestListFilters
{
    public static IQueryable<ServiceRequest> Apply(IQueryable<ServiceRequest> query, string? serviceType, string? category, string? city)
    {
        var isPackage = ListFilters.ServiceType(serviceType);
        if (isPackage == true) query = query.Where(sr => sr.ServicePackageId != null);
        else if (isPackage == false) query = query.Where(sr => sr.ServicePackageId == null);

        // Contains, so a request covering several services ("AC Service & Repair, Batteries") still matches.
        var categoryText = ListFilters.Search(category);
        if (categoryText != null)
        {
            query = query.Where(sr => sr.ServiceCategory.ToLower().Contains(categoryText) ||
                                      (sr.ServicePackageName != null && sr.ServicePackageName.ToLower().Contains(categoryText)));
        }

        var cityText = ListFilters.Search(city);
        if (cityText != null)
        {
            query = query.Where(sr => sr.ServiceLocation != null && sr.ServiceLocation.City.ToLower() == cityText);
        }

        return query;
    }
}
