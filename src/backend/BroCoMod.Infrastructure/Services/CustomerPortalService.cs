using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace BroCoMod.Infrastructure.Services;

public class CustomerPortalService : ICustomerPortalService
{
    private readonly IApplicationDbContext _context;

    public CustomerPortalService(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<CustomerDashboardDto> GetDashboardAsync(Guid customerId, CancellationToken cancellationToken = default)
    {
        var profile = await _context.CustomerProfiles
            .Include(cp => cp.User)
            .FirstOrDefaultAsync(cp => cp.Id == customerId || cp.UserId == customerId, cancellationToken);

        var customerName = profile?.User?.FullName ?? "Valued Customer";
        var resolvedCustomerId = profile?.Id ?? customerId;

        // Query customer's vehicles
        var vehiclesCount = await _context.CustomerVehicles
            .CountAsync(v => v.CustomerId == resolvedCustomerId, cancellationToken);

        // Query customer's requests
        var requests = await _context.ServiceRequests
            .AsNoTracking()
            .Where(r => r.CustomerId == resolvedCustomerId)
            .OrderByDescending(r => r.CreatedAtUtc)
            .Take(5)
            .Select(r => new CustomerRequestSummaryDto(
                r.Id,
                r.VehicleMake,
                r.VehicleModel,
                r.VehicleYear,
                r.Description,
                r.Status.ToString(),
                r.CreatedAtUtc,
                r.GarageQuotes.Count))
            .ToListAsync(cancellationToken);

        var activeRequestsCount = await _context.ServiceRequests
            .CountAsync(r => r.CustomerId == resolvedCustomerId, cancellationToken);

        // Query customer-facing quotations (strictly sanitized, no internal garage pricing)
        var quotes = await _context.CustomerQuotations
            .AsNoTracking()
            .Include(cq => cq.ServiceRequest)
            .Where(cq => cq.ServiceRequest.CustomerId == resolvedCustomerId)
            .OrderByDescending(cq => cq.CreatedAtUtc)
            .Take(5)
            .Select(cq => new CustomerQuoteSummaryDto(
                cq.Id,
                cq.ServiceRequestId,
                $"{cq.ServiceRequest.VehicleYear} {cq.ServiceRequest.VehicleMake} {cq.ServiceRequest.VehicleModel}",
                cq.CustomerFacingPrice,
                cq.ScopeSummary,
                cq.AdvisorNotes,
                cq.Status.ToString(),
                cq.CreatedAtUtc))
            .ToListAsync(cancellationToken);

        var availableQuotesCount = quotes.Count;

        return new CustomerDashboardDto(
            resolvedCustomerId,
            customerName,
            activeRequestsCount,
            availableQuotesCount,
            vehiclesCount,
            requests,
            quotes);
    }

    public async Task<CustomerProfileDto> GetProfileAsync(Guid customerId, CancellationToken cancellationToken = default)
    {
        var profile = await _context.CustomerProfiles
            .Include(cp => cp.User)
            .FirstOrDefaultAsync(cp => cp.Id == customerId || cp.UserId == customerId, cancellationToken);

        if (profile == null)
        {
            throw new KeyNotFoundException($"Customer profile not found for ID: {customerId}");
        }

        return new CustomerProfileDto(
            profile.Id,
            profile.UserId,
            profile.User.FullName,
            profile.User.Email,
            profile.User.PhoneNumber,
            profile.Address,
            profile.PreferredContactMethod);
    }

    public async Task<IReadOnlyList<CustomerVehicleDto>> GetVehiclesAsync(Guid customerId, CancellationToken cancellationToken = default)
    {
        var profile = await _context.CustomerProfiles
            .FirstOrDefaultAsync(cp => cp.Id == customerId || cp.UserId == customerId, cancellationToken);
        var resolvedCustomerId = profile?.Id ?? customerId;

        return await _context.CustomerVehicles
            .AsNoTracking()
            .Where(v => v.CustomerId == resolvedCustomerId)
            .OrderByDescending(v => v.CreatedAtUtc)
            .Select(v => new CustomerVehicleDto(
                v.Id,
                v.CustomerId,
                v.Make,
                v.Model,
                v.Year,
                v.LicensePlate,
                v.Vin,
                v.Mileage))
            .ToListAsync(cancellationToken);
    }

    public async Task<CustomerVehicleDto> AddVehicleAsync(Guid customerId, CreateVehicleDto dto, CancellationToken cancellationToken = default)
    {
        var profile = await _context.CustomerProfiles
            .FirstOrDefaultAsync(cp => cp.Id == customerId || cp.UserId == customerId, cancellationToken);
        var resolvedCustomerId = profile?.Id ?? customerId;

        var vehicle = new CustomerVehicle(
            resolvedCustomerId,
            dto.Make,
            dto.Model,
            dto.Year,
            dto.LicensePlate,
            dto.Vin,
            dto.Mileage);

        _context.CustomerVehicles.Add(vehicle);
        await _context.SaveChangesAsync(cancellationToken);

        return new CustomerVehicleDto(
            vehicle.Id,
            vehicle.CustomerId,
            vehicle.Make,
            vehicle.Model,
            vehicle.Year,
            vehicle.LicensePlate,
            vehicle.Vin,
            vehicle.Mileage);
    }

    public async Task<IReadOnlyList<CustomerRequestSummaryDto>> GetRequestsAsync(Guid customerId, CancellationToken cancellationToken = default)
    {
        var profile = await _context.CustomerProfiles
            .FirstOrDefaultAsync(cp => cp.Id == customerId || cp.UserId == customerId, cancellationToken);
        var resolvedCustomerId = profile?.Id ?? customerId;

        return await _context.ServiceRequests
            .AsNoTracking()
            .Where(r => r.CustomerId == resolvedCustomerId)
            .OrderByDescending(r => r.CreatedAtUtc)
            .Select(r => new CustomerRequestSummaryDto(
                r.Id,
                r.VehicleMake,
                r.VehicleModel,
                r.VehicleYear,
                r.Description,
                r.Status.ToString(),
                r.CreatedAtUtc,
                r.GarageQuotes.Count))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<CustomerQuoteSummaryDto>> GetQuotesAsync(Guid customerId, CancellationToken cancellationToken = default)
    {
        var profile = await _context.CustomerProfiles
            .FirstOrDefaultAsync(cp => cp.Id == customerId || cp.UserId == customerId, cancellationToken);
        var resolvedCustomerId = profile?.Id ?? customerId;

        return await _context.CustomerQuotations
            .AsNoTracking()
            .Include(cq => cq.ServiceRequest)
            .Where(cq => cq.ServiceRequest.CustomerId == resolvedCustomerId)
            .OrderByDescending(cq => cq.CreatedAtUtc)
            .Select(cq => new CustomerQuoteSummaryDto(
                cq.Id,
                cq.ServiceRequestId,
                $"{cq.ServiceRequest.VehicleYear} {cq.ServiceRequest.VehicleMake} {cq.ServiceRequest.VehicleModel}",
                cq.CustomerFacingPrice,
                cq.ScopeSummary,
                cq.AdvisorNotes,
                cq.Status.ToString(),
                cq.CreatedAtUtc))
            .ToListAsync(cancellationToken);
    }

    public async Task<CustomerQuoteSummaryDto?> GetQuoteByIdAsync(Guid customerId, Guid quoteId, CancellationToken cancellationToken = default)
    {
        var profile = await _context.CustomerProfiles
            .FirstOrDefaultAsync(cp => cp.Id == customerId || cp.UserId == customerId, cancellationToken);
        var resolvedCustomerId = profile?.Id ?? customerId;

        var quote = await _context.CustomerQuotations
            .AsNoTracking()
            .Include(cq => cq.ServiceRequest)
            .Where(cq => cq.Id == quoteId && cq.ServiceRequest.CustomerId == resolvedCustomerId)
            .Select(cq => new CustomerQuoteSummaryDto(
                cq.Id,
                cq.ServiceRequestId,
                $"{cq.ServiceRequest.VehicleYear} {cq.ServiceRequest.VehicleMake} {cq.ServiceRequest.VehicleModel}",
                cq.CustomerFacingPrice,
                cq.ScopeSummary,
                cq.AdvisorNotes,
                cq.Status.ToString(),
                cq.CreatedAtUtc))
            .FirstOrDefaultAsync(cancellationToken);

        return quote;
    }
}
