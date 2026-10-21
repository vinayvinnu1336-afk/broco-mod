namespace BroCoMod.Application.Interfaces;

/// <summary>An advisor's view: requests of their city, plus any request assigned to them personally.</summary>
public sealed record AdvisorCityRestriction(Guid AdvisorProfileId, string City);

/// <summary>
/// Advisors work in one city. Every advisor-facing list and detail is limited to that city; admins, garages,
/// customers and background jobs are not limited (<see cref="GetRestrictionAsync"/> returns null for them).
/// The Can… checks return true when the record doesn't exist, so the caller's own "not found" still applies.
/// </summary>
public interface IAdvisorCityScope
{
    Task<AdvisorCityRestriction?> GetRestrictionAsync(CancellationToken ct = default);

    /// <summary>The city to filter by: the advisor's own city when restricted (whatever was asked), else <paramref name="requestedCity"/>.</summary>
    Task<string?> EffectiveCityAsync(string? requestedCity, CancellationToken ct = default);

    Task<bool> CanAccessRequestAsync(Guid serviceRequestId, CancellationToken ct = default);
    Task<bool> CanAccessCustomerQuotationAsync(Guid customerQuotationId, CancellationToken ct = default);
    Task<bool> CanAccessGarageQuoteAsync(Guid garageQuoteId, CancellationToken ct = default);
    Task<bool> CanAccessJobAsync(Guid serviceJobId, CancellationToken ct = default);
    Task<bool> CanAccessAdditionalWorkAsync(Guid additionalWorkRequestId, CancellationToken ct = default);
    Task<bool> CanAccessCommissionAsync(Guid commissionId, CancellationToken ct = default);
    Task<bool> CanAccessGarageAsync(Guid garageId, CancellationToken ct = default);
}
