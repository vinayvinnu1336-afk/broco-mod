using System.Text.Json;
using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Entities.Identity;
using BroCoMod.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BroCoMod.Infrastructure.Services;

public class ServiceRequestService : IServiceRequestService
{
    private readonly IApplicationDbContext _context;
    private readonly IGarageMatchingService _garageMatchingService;
    private readonly INotificationService _notificationService;
    private readonly IRequestNumberGenerator _requestNumberGenerator;
    private readonly IAuditService _auditService;
    private readonly ILogger<ServiceRequestService> _logger;

    private readonly IServiceAreaService? _serviceAreas;
    private readonly IGeocodingService? _geocoding;
    private readonly decimal _advancePercentage;

    public ServiceRequestService(
        IApplicationDbContext context,
        IGarageMatchingService garageMatchingService,
        INotificationService notificationService,
        IRequestNumberGenerator requestNumberGenerator,
        IAuditService auditService,
        ILogger<ServiceRequestService> logger,
        IServiceAreaService? serviceAreas = null,
        IGeocodingService? geocoding = null,
        Microsoft.Extensions.Configuration.IConfiguration? configuration = null)
    {
        _advancePercentage = configuration == null ? 10m : BookingAdvance.Percentage(configuration);
        _serviceAreas = serviceAreas;
        _geocoding = geocoding;
        _context = context;
        _garageMatchingService = garageMatchingService;
        _notificationService = notificationService;
        _requestNumberGenerator = requestNumberGenerator;
        _auditService = auditService;
        _logger = logger;
    }

    private async Task<Guid> ResolveCustomerIdAsync(Guid customerIdOrUserId, CancellationToken cancellationToken)
    {
        var profile = await _context.CustomerProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.Id == customerIdOrUserId || cp.UserId == customerIdOrUserId, cancellationToken);

        return profile?.Id ?? customerIdOrUserId;
    }

    /// <summary>
    /// Bookings must be inside a live city, carry one of its pincodes, and (when Google geocoding is
    /// configured) the typed pincode must match the pin dropped on the map.
    /// </summary>
    private async Task ValidateServiceAreaAsync(CreateServiceBookingRequest request, CancellationToken cancellationToken)
    {
        if (_serviceAreas == null) return;

        var liveCities = string.Join(", ", _serviceAreas.GetAreas().Where(a => a.IsLive).Select(a => a.City));
        var area = _serviceAreas.FindLiveAreaFor(request.Latitude, request.Longitude)
            ?? throw new ArgumentException($"We currently serve only {liveCities}. Please pin a location inside {liveCities}.");

        var pincode = new string((request.Pincode ?? string.Empty).Where(char.IsDigit).ToArray());
        if (pincode.Length != 6)
            throw new ArgumentException("Enter a valid 6-digit pincode.");
        if (!_serviceAreas.IsPincodeServed(area, pincode))
            throw new ArgumentException($"Pincode {pincode} is outside our {area.City} service area. Check the address or move the pin.");

        if (_geocoding is { IsConfigured: true })
        {
            var actual = await _geocoding.ReverseGeocodeAsync(request.Latitude, request.Longitude, cancellationToken);
            if (actual?.Pincode is { Length: 6 } pinnedPincode && pinnedPincode != pincode)
            {
                var place = string.IsNullOrWhiteSpace(actual.City) ? pinnedPincode : $"{actual.City} {pinnedPincode}";
                throw new ArgumentException(
                    $"The pin on the map is in {place}, but the address says pincode {pincode}. Move the pin to your address or correct the address.");
            }
        }
    }

    public async Task<ServiceRequestDetailDto> CreateServiceRequestAsync(
        Guid customerId,
        CreateServiceBookingRequest request,
        string? idempotencyKey = null,
        CancellationToken cancellationToken = default)
    {
        var resolvedCustomerId = await ResolveCustomerIdAsync(customerId, cancellationToken);

        // 1. Idempotency Check: Return existing request if identical idempotency key is supplied
        if (!string.IsNullOrWhiteSpace(idempotencyKey))
        {
            var existingRequest = await _context.ServiceRequests
                .Include(sr => sr.ServiceLocation)
                .Include(sr => sr.CustomerProfile)
                    .ThenInclude(cp => cp!.User)
                .Include(sr => sr.AssignedAdvisor)
                    .ThenInclude(ap => ap!.User)
                .Include(sr => sr.GarageRequests)
                .FirstOrDefaultAsync(sr => sr.CustomerId == resolvedCustomerId && sr.IdempotencyKey == idempotencyKey, cancellationToken);

            if (existingRequest != null)
            {
                _logger.LogInformation("Idempotent request matched for Customer {CustomerId} with Key {Key}. Returning existing {RequestNumber}.",
                    resolvedCustomerId, idempotencyKey, existingRequest.RequestNumber);
                return MapToDetailDto(existingRequest);
            }
        }

        // 2. Validate Vehicle and Customer Ownership (Security: Customer cannot create request for another customer's vehicle)
        var vehicle = await _context.CustomerVehicles
            .AsNoTracking()
            .FirstOrDefaultAsync(v => v.Id == request.VehicleId, cancellationToken);

        if (vehicle == null)
        {
            throw new KeyNotFoundException($"Vehicle with ID '{request.VehicleId}' was not found.");
        }

        if (vehicle.CustomerId != resolvedCustomerId)
        {
            throw new UnauthorizedAccessException("Customer is not authorized to create a service request for another customer's vehicle.");
        }

        if (!vehicle.IsActive)
        {
            throw new InvalidOperationException("Selected vehicle is inactive. Please select an active vehicle.");
        }

        // 3. Location Validation
        ServiceLocation.ValidateCoordinates(request.Latitude, request.Longitude);

        if (string.IsNullOrWhiteSpace(request.AddressLine1)) throw new ArgumentException("AddressLine1 is required.", nameof(request.AddressLine1));
        if (string.IsNullOrWhiteSpace(request.City)) throw new ArgumentException("City is required.", nameof(request.City));
        if (string.IsNullOrWhiteSpace(request.State)) throw new ArgumentException("State is required.", nameof(request.State));
        if (string.IsNullOrWhiteSpace(request.Pincode)) throw new ArgumentException("Pincode is required.", nameof(request.Pincode));

        await ValidateServiceAreaAsync(request, cancellationToken);

        // Fixed-price package: the price is looked up on the server for this exact car and fuel.
        Domain.Entities.Catalogue.ServicePackage? package = null;
        decimal packagePrice = 0m;
        if (!string.IsNullOrWhiteSpace(request.PackageCode))
        {
            var code = request.PackageCode.Trim().ToUpperInvariant();
            package = await _context.ServicePackages.AsNoTracking()
                .FirstOrDefaultAsync(p => p.Code == code && p.IsActive, cancellationToken)
                ?? throw new ArgumentException($"Service package '{request.PackageCode}' is not available.");
            packagePrice = await _context.ServicePackagePrices.AsNoTracking()
                .Where(p => p.ServicePackageId == package.Id && p.VehicleModelId == vehicle.ModelId && p.FuelType == vehicle.FuelType)
                .Select(p => (decimal?)p.Price)
                .FirstOrDefaultAsync(cancellationToken)
                ?? throw new InvalidOperationException($"{package.Name} isn't priced for a {vehicle.Make} {vehicle.Model} ({vehicle.FuelType}) yet. Choose another service and our garages will quote.");
        }

        var problemDescription = request.ProblemDescription?.Trim() ?? string.Empty;
        if (package != null && problemDescription.Length < 5)
        {
            problemDescription = $"{package.Name} for {vehicle.Make} {vehicle.Model} ({vehicle.FuelType})";
        }
        if (problemDescription.Length < 5)
        {
            throw new ArgumentException("Problem description must be at least 5 characters long.", nameof(request.ProblemDescription));
        }

        var serviceLocation = new ServiceLocation(
            request.AddressLine1,
            request.AddressLine2,
            request.City,
            request.State,
            request.Pincode,
            request.Latitude,
            request.Longitude,
            request.Country);

        // 4. Generate Human-Readable Request Number (BM-XXXXXX). Sequence values are not guaranteed to be gapless.
        var requestNumber = await _requestNumberGenerator.GenerateNextRequestNumberAsync(cancellationToken);

        // 5. Create ServiceRequest Domain Entity
        var serviceRequest = new ServiceRequest(
            requestNumber: requestNumber,
            customerId: resolvedCustomerId,
            customerVehicleId: vehicle.Id,
            vehicleMake: vehicle.Make,
            vehicleModel: vehicle.Model,
            vehicleYear: vehicle.Year,
            vehicleLicensePlate: vehicle.LicensePlate,
            serviceLocationId: serviceLocation.Id,
            customerLocation: serviceLocation.Location,
            problemDescription: problemDescription,
            serviceCategory: package != null ? "Periodic Service" : request.ServiceCategory ?? "General",
            preferredServiceDate: request.PreferredServiceDate,
            radiusKm: 10.0,
            idempotencyKey: idempotencyKey);

        serviceRequest.SetVehicleFuel(vehicle.FuelType.ToString());
        if (package != null)
        {
            serviceRequest.AttachPackage(package.Id, package.Code, package.Name, packagePrice, vehicle.FuelType.ToString());
        }

        // 6. PostGIS 10 KM Matching Engine
        var eligibleGarages = await _garageMatchingService.FindEligibleGaragesAsync(
            serviceLocation.Location,
            radiusKm: 10.0,
            cancellationToken: cancellationToken);

        // 7. Create Separate GarageRequest Records for each eligible matched garage
        foreach (var match in eligibleGarages)
        {
            var garageReq = new GarageRequest(
                serviceRequestId: serviceRequest.Id,
                garageId: match.GarageId,
                distanceKm: match.DistanceKm,
                initialStatus: GarageRequestStatus.Notified);

            serviceRequest.GarageRequests.Add(garageReq);
        }

        if (eligibleGarages.Count > 0)
        {
            serviceRequest.MarkGaragesNotified();
        }

        // 7b. Give the request an owner: the active advisor with the fewest open requests.
        // Without an owner the request never appears on any advisor's dashboard or work queue.
        var responsibleAdvisorId = await _context.AdvisorProfiles
            .AsNoTracking()
            .Where(a => a.User.IsActive)
            .OrderBy(a => _context.ServiceRequests.Count(sr =>
                sr.AssignedAdvisorId == a.Id &&
                sr.Status != ServiceRequestStatus.Completed &&
                sr.Status != ServiceRequestStatus.Cancelled))
            .ThenBy(a => a.Id)
            .Select(a => (Guid?)a.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (responsibleAdvisorId.HasValue)
        {
            serviceRequest.SetResponsibleAdvisor(responsibleAdvisorId.Value);
        }

        // 8. Atomic Database Transaction
        var dbContext = _context as DbContext;
        if (dbContext != null && dbContext.Database.ProviderName != "Microsoft.EntityFrameworkCore.InMemory")
        {
            var strategy = dbContext.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
                _context.ServiceLocations.Add(serviceLocation);
                _context.ServiceRequests.Add(serviceRequest);
                await _context.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
            });
        }
        else
        {
            _context.ServiceLocations.Add(serviceLocation);
            _context.ServiceRequests.Add(serviceRequest);
            await _context.SaveChangesAsync(cancellationToken);
        }

        // 9. Persistent In-App Notifications
        try
        {
            await _notificationService.NotifyAdvisorsOfNewRequestAsync(serviceRequest, cancellationToken);
            await _notificationService.NotifyGaragesOfDispatchedRequestAsync(serviceRequest, serviceRequest.GarageRequests.ToList(), cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to deliver background notifications for request {RequestNumber}. Processing continued.", requestNumber);
        }

        // 10. Audit Logging
        await _auditService.LogAsync(
            action: "SERVICE_REQUEST_CREATED",
            entityName: nameof(ServiceRequest),
            entityId: serviceRequest.Id.ToString(),
            details: JsonSerializer.Serialize(new
            {
                serviceRequest.RequestNumber,
                serviceRequest.CustomerId,
                serviceRequest.VehicleMake,
                serviceRequest.VehicleModel,
                serviceRequest.VehicleYear,
                EligibleGaragesMatched = eligibleGarages.Count
            }),
            cancellationToken: cancellationToken);

        foreach (var gr in serviceRequest.GarageRequests)
        {
            await _auditService.LogAsync(
                action: "GARAGE_REQUEST_CREATED",
                entityName: nameof(GarageRequest),
                entityId: gr.Id.ToString(),
                details: JsonSerializer.Serialize(new
                {
                    gr.ServiceRequestId,
                    gr.GarageId,
                    gr.DistanceKm,
                    gr.Status
                }),
                cancellationToken: cancellationToken);
        }

        // Fetch customer profile details for response projection
        var customerProfile = await _context.CustomerProfiles
            .Include(cp => cp.User)
            .FirstOrDefaultAsync(cp => cp.Id == resolvedCustomerId, cancellationToken);

        return MapToDetailDto(serviceRequest, customerProfile, serviceLocation);
    }

    public async Task<PagedResult<CustomerServiceRequestSummaryDto>> GetCustomerRequestsAsync(
        Guid customerId,
        int page = 1,
        int pageSize = 10,
        CancellationToken cancellationToken = default)
    {
        var resolvedCustomerId = await ResolveCustomerIdAsync(customerId, cancellationToken);
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);

        var query = _context.ServiceRequests
            .AsNoTracking()
            .Include(sr => sr.ServiceLocation)
            .Where(sr => sr.CustomerId == resolvedCustomerId);

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(sr => sr.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var dtos = items.Select(sr => new CustomerServiceRequestSummaryDto(
            sr.Id,
            sr.RequestNumber,
            $"{sr.VehicleYear} {sr.VehicleMake} {sr.VehicleModel}",
            sr.VehicleLicensePlate,
            sr.ServiceLocation != null ? sr.ServiceLocation.City : "",
            sr.ProblemDescription,
            FormatStatus(sr.Status),
            sr.CreatedAtUtc,
            sr.SubmittedAtUtc,
            sr.GarageQuotes.Count,
            sr.ServicePackageName,
            sr.PackagePrice,
            sr.AdvancePaidAtUtc != null)).ToList();

        return new PagedResult<CustomerServiceRequestSummaryDto>(dtos, page, pageSize, totalCount);
    }

    public async Task<ServiceRequestDetailDto> GetCustomerRequestByIdAsync(
        Guid customerId,
        Guid requestId,
        CancellationToken cancellationToken = default)
    {
        var resolvedCustomerId = await ResolveCustomerIdAsync(customerId, cancellationToken);

        var request = await _context.ServiceRequests
            .AsNoTracking()
            .Include(sr => sr.ServiceLocation)
            .Include(sr => sr.CustomerProfile)
                .ThenInclude(cp => cp!.User)
            .Include(sr => sr.AssignedAdvisor)
                .ThenInclude(ap => ap!.User)
            .Include(sr => sr.GarageRequests)
            .FirstOrDefaultAsync(sr => sr.Id == requestId && sr.CustomerId == resolvedCustomerId, cancellationToken);

        if (request == null)
        {
            throw new KeyNotFoundException($"Service request with ID '{requestId}' was not found or is unauthorized.");
        }

        return MapToDetailDto(request);
    }

    public async Task<bool> CancelCustomerRequestAsync(
        Guid customerId,
        Guid requestId,
        string reason,
        CancellationToken cancellationToken = default)
    {
        var resolvedCustomerId = await ResolveCustomerIdAsync(customerId, cancellationToken);

        var request = await _context.ServiceRequests
            .FirstOrDefaultAsync(sr => sr.Id == requestId && sr.CustomerId == resolvedCustomerId, cancellationToken);

        if (request == null)
        {
            throw new KeyNotFoundException($"Service request with ID '{requestId}' was not found or is unauthorized.");
        }

        request.Cancel(reason);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: "SERVICE_REQUEST_STATUS_CHANGED",
            entityName: nameof(ServiceRequest),
            entityId: request.Id.ToString(),
            details: $"Status changed to Cancelled. Reason: {reason}",
            cancellationToken: cancellationToken);

        return true;
    }

    public async Task<PagedResult<GarageIncomingRequestDto>> GetGarageRequestsAsync(
        Guid garageId,
        int page = 1,
        int pageSize = 10,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);

        var query = _context.GarageRequests
            .AsNoTracking()
            .Include(gr => gr.ServiceRequest)
                .ThenInclude(sr => sr.ServiceLocation)
            .Where(gr => gr.GarageId == garageId);

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(gr => gr.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var dtos = items.Select(gr => new GarageIncomingRequestDto(
            gr.Id,
            gr.ServiceRequestId,
            gr.ServiceRequest.RequestNumber,
            $"{gr.ServiceRequest.VehicleYear} {gr.ServiceRequest.VehicleMake} {gr.ServiceRequest.VehicleModel}",
            gr.ServiceRequest.ProblemDescription,
            gr.ServiceRequest.ServiceLocation != null ? $"{gr.ServiceRequest.ServiceLocation.City}, {gr.ServiceRequest.ServiceLocation.State}" : "Service Area",
            gr.DistanceKm,
            FormatStatus(gr.Status),
            gr.SentAtUtc)).ToList();

        return new PagedResult<GarageIncomingRequestDto>(dtos, page, pageSize, totalCount);
    }

    public async Task<GarageIncomingRequestDetailDto> GetGarageRequestByIdAsync(
        Guid garageId,
        Guid garageRequestId,
        CancellationToken cancellationToken = default)
    {
        var gr = await _context.GarageRequests
            .Include(r => r.ServiceRequest)
                .ThenInclude(sr => sr.ServiceLocation)
            .FirstOrDefaultAsync(r => r.Id == garageRequestId && r.GarageId == garageId, cancellationToken);

        if (gr == null)
        {
            throw new KeyNotFoundException($"Garage request with ID '{garageRequestId}' was not found or is unauthorized.");
        }

        // Mark as viewed on access
        gr.MarkViewed();
        await _context.SaveChangesAsync(cancellationToken);

        return new GarageIncomingRequestDetailDto(
            gr.Id,
            gr.ServiceRequestId,
            gr.ServiceRequest.RequestNumber,
            gr.ServiceRequest.VehicleMake,
            gr.ServiceRequest.VehicleModel,
            gr.ServiceRequest.VehicleYear,
            gr.ServiceRequest.VehicleLicensePlate,
            gr.ServiceRequest.ProblemDescription,
            gr.ServiceRequest.ServiceCategory,
            gr.ServiceRequest.PreferredServiceDate,
            gr.ServiceRequest.ServiceLocation != null ? $"{gr.ServiceRequest.ServiceLocation.City}, {gr.ServiceRequest.ServiceLocation.State}" : "Service Area",
            gr.DistanceKm,
            FormatStatus(gr.Status),
            gr.SentAtUtc,
            gr.ViewedAtUtc,
            gr.RespondedAtUtc);
    }

    public async Task<PagedResult<AdvisorServiceRequestSummaryDto>> GetAdvisorRequestsAsync(
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);

        var query = _context.ServiceRequests
            .AsNoTracking()
            .Include(sr => sr.ServiceLocation)
            .Include(sr => sr.CustomerProfile)
                .ThenInclude(cp => cp!.User)
            .Include(sr => sr.GarageRequests);

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(sr => sr.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var dtos = items.Select(sr => new AdvisorServiceRequestSummaryDto(
            sr.Id,
            sr.RequestNumber,
            sr.CustomerId,
            sr.CustomerProfile != null ? sr.CustomerProfile.User.FullName : "Customer",
            sr.CustomerProfile != null ? sr.CustomerProfile.User.Email : "",
            sr.CustomerProfile != null ? sr.CustomerProfile.User.PhoneNumber : "",
            $"{sr.VehicleYear} {sr.VehicleMake} {sr.VehicleModel}",
            sr.ServiceLocation != null ? sr.ServiceLocation.City : "",
            sr.ProblemDescription,
            sr.ServiceCategory,
            FormatStatus(sr.Status),
            sr.GarageRequests.Count,
            sr.GarageRequests.Count,
            sr.SubmittedAtUtc,
            sr.ServicePackageName,
            sr.PackagePrice,
            sr.AdvancePaidAtUtc != null)).ToList();

        return new PagedResult<AdvisorServiceRequestSummaryDto>(dtos, page, pageSize, totalCount);
    }

    public async Task<AdvisorServiceRequestDetailDto> GetAdvisorRequestByIdAsync(
        Guid requestId,
        CancellationToken cancellationToken = default)
    {
        var request = await _context.ServiceRequests
            .AsNoTracking()
            .Include(sr => sr.ServiceLocation)
            .Include(sr => sr.CustomerProfile)
                .ThenInclude(cp => cp!.User)
            .Include(sr => sr.GarageRequests)
                .ThenInclude(gr => gr.Garage!)
            .FirstOrDefaultAsync(sr => sr.Id == requestId, cancellationToken);

        if (request == null)
        {
            throw new KeyNotFoundException($"Service request with ID '{requestId}' was not found.");
        }

        var dispatchedGarages = request.GarageRequests.Select(gr => new DispatchedGarageSummaryDto(
            gr.Id,
            gr.GarageId,
            gr.Garage != null ? gr.Garage.Name : "Partner Garage",
            gr.Garage != null ? gr.Garage.PhoneNumber : "",
            gr.DistanceKm,
            FormatStatus(gr.Status),
            gr.SentAtUtc
        )).ToList();

        var locationDto = request.ServiceLocation != null
            ? new ServiceLocationDto(
                request.ServiceLocation.Id,
                request.ServiceLocation.AddressLine1,
                request.ServiceLocation.AddressLine2,
                request.ServiceLocation.City,
                request.ServiceLocation.State,
                request.ServiceLocation.Pincode,
                request.ServiceLocation.Country,
                request.ServiceLocation.Latitude,
                request.ServiceLocation.Longitude,
                request.ServiceLocation.FormattedAddress)
            : new ServiceLocationDto(Guid.Empty, "", null, "", "", "", "", 0, 0, "");

        return new AdvisorServiceRequestDetailDto(
            request.Id,
            request.RequestNumber,
            request.CustomerId,
            request.CustomerProfile?.User?.FullName ?? "Customer",
            request.CustomerProfile?.User?.Email ?? "",
            request.CustomerProfile?.User?.PhoneNumber ?? "",
            $"{request.VehicleYear} {request.VehicleMake} {request.VehicleModel}",
            request.VehicleLicensePlate,
            locationDto,
            request.ProblemDescription,
            request.ServiceCategory,
            request.PreferredServiceDate,
            FormatStatus(request.Status),
            request.AssignedAdvisorId,
            dispatchedGarages,
            request.SubmittedAtUtc,
            request.ServicePackageCode,
            request.ServicePackageName,
            request.PackagePrice,
            request.PackagePrice.HasValue ? BookingAdvance.Amount(request.PackagePrice.Value, _advancePercentage) : null,
            request.AdvancePaidAmount,
            request.AdvancePaidAtUtc,
            request.VehicleFuel);
    }

    public async Task<PagedResult<AdminServiceRequestSummaryDto>> GetAdminRequestsAsync(
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);

        var query = _context.ServiceRequests
            .AsNoTracking()
            .Include(sr => sr.ServiceLocation)
            .Include(sr => sr.CustomerProfile)
                .ThenInclude(cp => cp!.User)
            .Include(sr => sr.AssignedAdvisor)
                .ThenInclude(ap => ap!.User)
            .Include(sr => sr.GarageRequests);

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(sr => sr.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var dtos = items.Select(sr => new AdminServiceRequestSummaryDto(
            sr.Id,
            sr.RequestNumber,
            sr.CustomerId,
            sr.CustomerProfile != null ? sr.CustomerProfile.User.FullName : "Customer",
            $"{sr.VehicleYear} {sr.VehicleMake} {sr.VehicleModel}",
            sr.ServiceLocation != null ? sr.ServiceLocation.City : "",
            FormatStatus(sr.Status),
            sr.AssignedAdvisor != null ? sr.AssignedAdvisor.User.FullName : null,
            sr.GarageRequests.Count,
            sr.GarageRequests.Count,
            sr.SubmittedAtUtc)).ToList();

        return new PagedResult<AdminServiceRequestSummaryDto>(dtos, page, pageSize, totalCount);
    }

    public async Task<AdminServiceRequestDetailDto> GetAdminRequestByIdAsync(
        Guid requestId,
        CancellationToken cancellationToken = default)
    {
        var request = await _context.ServiceRequests
            .AsNoTracking()
            .Include(sr => sr.ServiceLocation)
            .Include(sr => sr.CustomerProfile)
                .ThenInclude(cp => cp!.User)
            .Include(sr => sr.AssignedAdvisor)
                .ThenInclude(ap => ap!.User)
            .Include(sr => sr.GarageRequests)
                .ThenInclude(gr => gr.Garage!)
            .FirstOrDefaultAsync(sr => sr.Id == requestId, cancellationToken);

        if (request == null)
        {
            throw new KeyNotFoundException($"Service request with ID '{requestId}' was not found.");
        }

        var dispatchedGarages = request.GarageRequests.Select(gr => new DispatchedGarageSummaryDto(
            gr.Id,
            gr.GarageId,
            gr.Garage != null ? gr.Garage.Name : "Partner Garage",
            gr.Garage != null ? gr.Garage.PhoneNumber : "",
            gr.DistanceKm,
            FormatStatus(gr.Status),
            gr.SentAtUtc
        )).ToList();

        var locationDto = request.ServiceLocation != null
            ? new ServiceLocationDto(
                request.ServiceLocation.Id,
                request.ServiceLocation.AddressLine1,
                request.ServiceLocation.AddressLine2,
                request.ServiceLocation.City,
                request.ServiceLocation.State,
                request.ServiceLocation.Pincode,
                request.ServiceLocation.Country,
                request.ServiceLocation.Latitude,
                request.ServiceLocation.Longitude,
                request.ServiceLocation.FormattedAddress)
            : new ServiceLocationDto(Guid.Empty, "", null, "", "", "", "", 0, 0, "");

        return new AdminServiceRequestDetailDto(
            request.Id,
            request.RequestNumber,
            request.CustomerId,
            request.CustomerProfile?.User?.FullName ?? "Customer",
            request.CustomerProfile?.User?.Email ?? "",
            request.CustomerProfile?.User?.PhoneNumber ?? "",
            $"{request.VehicleYear} {request.VehicleMake} {request.VehicleModel}",
            request.VehicleLicensePlate,
            locationDto,
            request.ProblemDescription,
            request.ServiceCategory,
            request.PreferredServiceDate,
            FormatStatus(request.Status),
            request.AssignedAdvisorId,
            request.AssignedAdvisor?.User?.FullName,
            dispatchedGarages,
            request.SubmittedAtUtc,
            request.CancelledAtUtc,
            request.CancellationReason);
    }

    private ServiceRequestDetailDto MapToDetailDto(
        ServiceRequest sr,
        CustomerProfile? customerProfile = null,
        ServiceLocation? serviceLocation = null)
    {
        var location = serviceLocation ?? sr.ServiceLocation;
        var profile = customerProfile ?? sr.CustomerProfile;

        var locationDto = location != null
            ? new ServiceLocationDto(
                location.Id,
                location.AddressLine1,
                location.AddressLine2,
                location.City,
                location.State,
                location.Pincode,
                location.Country,
                location.Latitude,
                location.Longitude,
                location.FormattedAddress)
            : new ServiceLocationDto(Guid.Empty, "", null, "", "", "", "", 0, 0, "");

        return new ServiceRequestDetailDto(
            sr.Id,
            sr.RequestNumber,
            sr.CustomerId,
            profile?.User?.FullName ?? "Customer",
            sr.CustomerVehicleId,
            $"{sr.VehicleYear} {sr.VehicleMake} {sr.VehicleModel}",
            sr.VehicleLicensePlate,
            locationDto,
            sr.ProblemDescription,
            sr.ServiceCategory,
            sr.PreferredServiceDate,
            FormatStatus(sr.Status),
            sr.AssignedAdvisorId,
            sr.AssignedAdvisor?.User?.FullName,
            sr.GarageRequests.Count,
            sr.SubmittedAtUtc,
            sr.CancelledAtUtc,
            sr.CancellationReason,
            sr.ServicePackageCode,
            sr.ServicePackageName,
            sr.PackagePrice,
            sr.PackagePrice.HasValue ? BookingAdvance.Amount(sr.PackagePrice.Value, _advancePercentage) : null,
            sr.AdvancePaidAmount,
            sr.AdvancePaidAtUtc,
            sr.VehicleFuel);
    }

    private static string FormatStatus(ServiceRequestStatus status) => status switch
    {
        ServiceRequestStatus.New => "NEW",
        ServiceRequestStatus.AssignedToAdvisor => "ASSIGNED_TO_ADVISOR",
        ServiceRequestStatus.UnderReview => "UNDER_REVIEW",
        ServiceRequestStatus.GarageMatching => "GARAGE_MATCHING",
        ServiceRequestStatus.GaragesNotified => "GARAGES_NOTIFIED",
        ServiceRequestStatus.QuotesReceived => "QUOTES_RECEIVED",
        ServiceRequestStatus.CustomerQuotationSent => "CUSTOMER_QUOTATION_SENT",
        ServiceRequestStatus.CustomerAccepted => "CUSTOMER_ACCEPTED",
        ServiceRequestStatus.BookingConfirmed => "BOOKING_CONFIRMED",
        ServiceRequestStatus.CustomerRejected => "CUSTOMER_REJECTED",
        ServiceRequestStatus.InProgress => "IN_PROGRESS",
        ServiceRequestStatus.Completed => "COMPLETED",
        ServiceRequestStatus.Cancelled => "CANCELLED",
        ServiceRequestStatus.AdvisorReview => "ADVISOR_REVIEW",
        ServiceRequestStatus.GarageSelected => "GARAGE_SELECTED",
        _ => System.Text.RegularExpressions.Regex.Replace(status.ToString(), "([a-z0-9])([A-Z])", "$1_$2").ToUpperInvariant()
    };

    private static string FormatStatus(GarageRequestStatus status) => status switch
    {
        GarageRequestStatus.Pending => "PENDING",
        GarageRequestStatus.Notified => "NOTIFIED",
        GarageRequestStatus.Viewed => "VIEWED",
        GarageRequestStatus.Accepted => "ACCEPTED",
        GarageRequestStatus.Declined => "DECLINED",
        GarageRequestStatus.Expired => "EXPIRED",
        _ => status.ToString().ToUpperInvariant()
    };
}
