using BroCoMod.Application.DTOs;
using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace BroCoMod.Application.Interfaces;

public interface IApplicationDbContext
{
    DbSet<Garage> Garages { get; }
    DbSet<ServiceRequest> ServiceRequests { get; }
    DbSet<GarageQuote> GarageQuotes { get; }
    DbSet<CustomerQuotation> CustomerQuotations { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

public interface IGarageService
{
    Task<IEnumerable<GarageDto>> FindEligibleGaragesAsync(
        double longitude,
        double latitude,
        double radiusKm = 10.0,
        CancellationToken cancellationToken = default);

    Task<GarageDto> RegisterGarageAsync(
        CreateGarageDto dto,
        CancellationToken cancellationToken = default);
}

public interface IQuoteService
{
    Task<GarageInternalQuoteDto> SubmitGarageQuoteAsync(
        SubmitGarageQuoteRequest request,
        CancellationToken cancellationToken = default);

    Task<CustomerQuoteViewDto> AssignCustomerQuotationAsync(
        AssignCustomerQuotationRequest request,
        CancellationToken cancellationToken = default);

    Task<CustomerQuoteViewDto?> GetCustomerQuotationAsync(
        Guid serviceRequestId,
        UserRole requestingRole,
        CancellationToken cancellationToken = default);

    Task<IEnumerable<GarageInternalQuoteDto>> GetGarageQuotesForAdvisorAsync(
        Guid serviceRequestId,
        UserRole requestingRole,
        CancellationToken cancellationToken = default);
}

public interface ICacheService
{
    Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken = default);
    Task SetAsync<T>(string key, T value, TimeSpan? expiry = null, CancellationToken cancellationToken = default);
    Task RemoveAsync(string key, CancellationToken cancellationToken = default);
}
