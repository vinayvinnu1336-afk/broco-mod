using BroCoMod.Application.Common;
using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Constants;
using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Entities.Identity;
using BroCoMod.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace BroCoMod.Infrastructure.Services;

public class CustomerPortalService : ICustomerPortalService
{
    private readonly IApplicationDbContext _context;
    private readonly IAuditService _auditService;

    public CustomerPortalService(IApplicationDbContext context, IAuditService auditService)
    {
        _context = context;
        _auditService = auditService;
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

        // Active = not finished; counted in SQL over all of the customer's requests (not the 5-row preview).
        var activeRequestsCount = await _context.ServiceRequests
            .CountAsync(r => r.CustomerId == resolvedCustomerId &&
                             r.Status != ServiceRequestStatus.Completed &&
                             r.Status != ServiceRequestStatus.Cancelled &&
                             r.Status != ServiceRequestStatus.CustomerRejected, cancellationToken);

        // Query customer-facing quotations (strictly sanitized, no internal garage pricing)
        var quotes = await _context.CustomerQuotations
            .AsNoTracking()
            .Include(cq => cq.ServiceRequest)
            .Where(cq => cq.ServiceRequest != null && cq.ServiceRequest.CustomerId == resolvedCustomerId &&
                         cq.Status != CustomerQuotationStatus.Draft && cq.Status != CustomerQuotationStatus.ReadyToSend)
            .OrderByDescending(cq => cq.CreatedAtUtc)
            .Take(5)
            .Select(cq => new CustomerQuoteSummaryDto(
                cq.Id,
                cq.ServiceRequestId,
                cq.ServiceRequest != null ? $"{cq.ServiceRequest.VehicleYear} {cq.ServiceRequest.VehicleMake} {cq.ServiceRequest.VehicleModel}" : "",
                cq.CustomerFacingPrice,
                cq.ScopeSummary,
                cq.AdvisorNotes,
                cq.Status.ToString(),
                cq.CreatedAtUtc))
            .ToListAsync(cancellationToken);

        // Quotes waiting for the customer's decision, counted over all quotations (the list above is a preview).
        var availableQuotesCount = await _context.CustomerQuotations
            .CountAsync(cq => cq.ServiceRequest != null && cq.ServiceRequest.CustomerId == resolvedCustomerId &&
                              cq.Status == CustomerQuotationStatus.Sent, cancellationToken);

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

        return ToProfileDto(profile);
    }

    public async Task<CustomerProfileDto> UpdateProfileAsync(
        Guid customerId,
        UpdateCustomerProfileRequest request,
        string? ipAddress = null,
        CancellationToken cancellationToken = default)
    {
        // The id comes from the caller's token, so a customer can only ever reach their own profile.
        var profile = await _context.CustomerProfiles
            .Include(cp => cp.User)
            .FirstOrDefaultAsync(cp => cp.Id == customerId || cp.UserId == customerId, cancellationToken)
            ?? throw new KeyNotFoundException("Customer profile not found.");

        var fullName = (request.FullName ?? string.Empty).Trim();
        if (fullName.Length is < 2 or > 100)
            throw new ArgumentException("Name must be 2 to 100 characters.");
        var phone = IndianMobile.Normalize(request.PhoneNumber)
            ?? throw new ArgumentException(IndianMobile.InvalidMessage);
        var address = request.Address is null ? profile.Address : request.Address.Trim();
        if (address.Length > 500)
            throw new ArgumentException("Address must be 500 characters or fewer.");
        var contact = string.IsNullOrWhiteSpace(request.PreferredContactMethod)
            ? profile.PreferredContactMethod
            : ContactMethods.Normalize(request.PreferredContactMethod)
              ?? throw new ArgumentException($"Preferred contact must be one of: {string.Join(", ", ContactMethods.All)}.");

        var changed = new List<string>();
        if (fullName != profile.User.FullName) changed.Add("name");
        if (phone != profile.User.PhoneNumber)
        {
            // Compared as numbers: re-saving an old "9876543210" in the stored format is not a new mobile.
            var nationalNumber = IndianMobile.NationalNumber(phone)!;
            if (nationalNumber != IndianMobile.NationalNumber(profile.User.PhoneNumber)
                && await _context.Users.IsMobileTakenAsync(nationalNumber, new[] { profile.UserId }, cancellationToken))
            {
                throw new ArgumentException(IndianMobile.AlreadyRegisteredMessage);
            }
            changed.Add("mobile");
        }
        if (address != profile.Address) changed.Add("address");
        if (contact != profile.PreferredContactMethod) changed.Add("preferred contact");

        if (changed.Count > 0)
        {
            profile.User.UpdateProfile(fullName, phone);
            profile.UpdateProfile(address, contact);
            await _context.SaveChangesAsync(cancellationToken);

            // Field names only: the audit trail should not become a second copy of personal data.
            await _auditService.LogAsync(
                action: AuditActions.UserUpdated,
                userId: profile.UserId,
                userEmail: profile.User.Email,
                entityName: nameof(CustomerProfile),
                entityId: profile.Id.ToString(),
                details: $"Customer updated their profile: {string.Join(", ", changed)}",
                ipAddress: ipAddress,
                cancellationToken: cancellationToken);
        }

        return ToProfileDto(profile);
    }

    private static CustomerProfileDto ToProfileDto(CustomerProfile profile) => new(
        profile.Id,
        profile.UserId,
        profile.User.FullName,
        profile.User.Email,
        profile.User.PhoneNumber,
        profile.Address,
        profile.PreferredContactMethod);

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
            .Where(cq => cq.ServiceRequest != null && cq.ServiceRequest.CustomerId == resolvedCustomerId &&
                         cq.Status != CustomerQuotationStatus.Draft && cq.Status != CustomerQuotationStatus.ReadyToSend)
            .OrderByDescending(cq => cq.CreatedAtUtc)
            .Select(cq => new CustomerQuoteSummaryDto(
                cq.Id,
                cq.ServiceRequestId,
                cq.ServiceRequest != null ? $"{cq.ServiceRequest.VehicleYear} {cq.ServiceRequest.VehicleMake} {cq.ServiceRequest.VehicleModel}" : "",
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
            .Where(cq => cq.Id == quoteId && cq.ServiceRequest != null && cq.ServiceRequest.CustomerId == resolvedCustomerId &&
                         cq.Status != CustomerQuotationStatus.Draft && cq.Status != CustomerQuotationStatus.ReadyToSend)
            .Select(cq => new CustomerQuoteSummaryDto(
                cq.Id,
                cq.ServiceRequestId,
                cq.ServiceRequest != null ? $"{cq.ServiceRequest.VehicleYear} {cq.ServiceRequest.VehicleMake} {cq.ServiceRequest.VehicleModel}" : "",
                cq.CustomerFacingPrice,
                cq.ScopeSummary,
                cq.AdvisorNotes,
                cq.Status.ToString(),
                cq.CreatedAtUtc))
            .FirstOrDefaultAsync(cancellationToken);

        return quote;
    }
}
