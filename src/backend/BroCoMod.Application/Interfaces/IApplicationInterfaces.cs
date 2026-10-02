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
    DbSet<GarageQuoteLineItem> GarageQuoteLineItems { get; }
    DbSet<GarageQuoteVersion> GarageQuoteVersions { get; }
    DbSet<CustomerQuotation> CustomerQuotations { get; }
    DbSet<CustomerQuotationLineItem> CustomerQuotationLineItems { get; }
    DbSet<CustomerQuotationVersion> CustomerQuotationVersions { get; }
    DbSet<GarageAssignment> GarageAssignments { get; }
    DbSet<AdvisorRequestNote> AdvisorRequestNotes { get; }
    DbSet<CustomerQuotationDecision> CustomerQuotationDecisions { get; }

    // Identity & Authorization
    DbSet<BroCoMod.Domain.Entities.Identity.User> Users { get; }
    DbSet<BroCoMod.Domain.Entities.Identity.Role> Roles { get; }
    DbSet<BroCoMod.Domain.Entities.Identity.Permission> Permissions { get; }
    DbSet<BroCoMod.Domain.Entities.Identity.UserRole> UserRoles { get; }
    DbSet<BroCoMod.Domain.Entities.Identity.RolePermission> RolePermissions { get; }
    DbSet<BroCoMod.Domain.Entities.Identity.RefreshToken> RefreshTokens { get; }
    DbSet<BroCoMod.Domain.Entities.Identity.CustomerProfile> CustomerProfiles { get; }
    DbSet<BroCoMod.Domain.Entities.Identity.GarageUser> GarageUsers { get; }
    DbSet<BroCoMod.Domain.Entities.Identity.AdvisorProfile> AdvisorProfiles { get; }
    DbSet<BroCoMod.Domain.Entities.CustomerVehicle> CustomerVehicles { get; }
    DbSet<BroCoMod.Domain.Entities.Identity.AuditLog> AuditLogs { get; }

    // Vehicle Master Catalog
    DbSet<BroCoMod.Domain.Entities.VehicleMaster.VehicleManufacturer> VehicleManufacturers { get; }
    DbSet<BroCoMod.Domain.Entities.VehicleMaster.VehicleModel> VehicleModels { get; }
    DbSet<BroCoMod.Domain.Entities.VehicleMaster.VehicleVariant> VehicleVariants { get; }

    // Service Booking & Dispatch
    DbSet<ServiceLocation> ServiceLocations { get; }
    DbSet<GarageRequest> GarageRequests { get; }
    DbSet<Notification> Notifications { get; }

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
