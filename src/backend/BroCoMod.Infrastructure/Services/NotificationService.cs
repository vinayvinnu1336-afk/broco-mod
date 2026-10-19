using System.Text.Json;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Constants;
using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Enums;
using BroCoMod.Infrastructure.Services.Messaging;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BroCoMod.Infrastructure.Services;

public class InAppNotificationProvider : INotificationProvider
{
    private readonly IApplicationDbContext _context;

    public InAppNotificationProvider(IApplicationDbContext context)
    {
        _context = context;
    }

    public NotificationChannel Channel => NotificationChannel.InApp;

    public async Task<bool> SendAsync(NotificationMessage message, CancellationToken cancellationToken = default)
    {
        var notification = new Notification(
            message.UserId,
            message.Title,
            message.Message,
            message.Type,
            message.Channel,
            message.ReferenceId,
            message.ReferenceType,
            message.MetadataJson);

        _context.Notifications.Add(notification);
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

// Email, SMS and WhatsApp providers: Messaging/NotificationProviders.cs

public class NotificationService : INotificationService
{
    private readonly IApplicationDbContext _context;
    private readonly IEnumerable<INotificationProvider> _providers;
    private readonly ILogger<NotificationService> _logger;
    private readonly ExternalNotificationQueue? _externalQueue;

    public NotificationService(
        IApplicationDbContext context,
        IEnumerable<INotificationProvider> providers,
        ILogger<NotificationService> logger,
        ExternalNotificationQueue? externalQueue = null)
    {
        _context = context;
        _providers = providers;
        _logger = logger;
        _externalQueue = externalQueue;
    }

    public async Task SendInAppNotificationAsync(
        Guid userId,
        string title,
        string message,
        string type,
        Guid? referenceId = null,
        string? referenceType = null,
        string? metadataJson = null,
        CancellationToken cancellationToken = default)
    {
        var notification = new Notification(
            userId,
            title,
            message,
            type,
            NotificationChannel.InApp,
            referenceId,
            referenceType,
            metadataJson);

        _context.Notifications.Add(notification);
        await _context.SaveChangesAsync(cancellationToken);

        // Booking confirmations, quotations and receipts also go out by email / SMS, in the background.
        _externalQueue?.TryEnqueue(new ExternalNotificationJob(userId, title, message, type, referenceId, referenceType));
    }

    public async Task NotifyAdvisorsOfNewRequestAsync(
        ServiceRequest request,
        CancellationToken cancellationToken = default)
    {
        // Query users with Advisor or SuperAdmin roles
        var advisorUsers = await _context.Users
            .AsNoTracking()
            .Where(u => u.IsActive && u.UserRoles.Any(ur => ur.Role.Name == AppRoles.Advisor || ur.Role.Name == AppRoles.SuperAdmin))
            .Select(u => u.Id)
            .ToListAsync(cancellationToken);

        // Packages have a fixed price and are never sent to garages for quotes.
        var title = request.IsPackageBooking
            ? $"New package booking: {request.RequestNumber}"
            : $"New Service Request: {request.RequestNumber}";
        var body = request.IsPackageBooking
            ? $"{request.ServicePackageName} for {request.VehicleYear} {request.VehicleMake} {request.VehicleModel}{FuelSuffix(request)} at a fixed ₹{request.PackagePrice:N0}. " +
              $"Pick-up & drop: {request.PickupSummary}. Assign a nearby garage once the customer pays the 10% advance."
            : $"Vehicle: {request.VehicleYear} {request.VehicleMake} {request.VehicleModel}. Services: {request.ServiceCategory}. Pick-up & drop: {request.PickupSummary}. Problem: {request.ProblemDescription}";
        var metadata = JsonSerializer.Serialize(new
        {
            request.Id,
            request.RequestNumber,
            request.VehicleMake,
            request.VehicleModel,
            request.VehicleYear,
            request.ProblemDescription,
            request.ServiceCategory,
            request.ServicePackageCode,
            request.PackagePrice
        });

        foreach (var userId in advisorUsers)
        {
            var notification = new Notification(
                userId,
                title,
                body,
                "SERVICE_REQUEST_CREATED",
                NotificationChannel.InApp,
                request.Id,
                "ServiceRequest",
                metadata);

            _context.Notifications.Add(notification);
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task NotifyAdvisorOfPaidPackageBookingAsync(
        ServiceRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!request.IsPackageBooking) return;

        // The advisor who owns the request; if nobody owns it yet, every active advisor.
        var advisorUsers = request.AssignedAdvisorId.HasValue
            ? await _context.AdvisorProfiles
                .AsNoTracking()
                .Where(a => a.Id == request.AssignedAdvisorId.Value && a.User.IsActive)
                .Select(a => a.UserId)
                .ToListAsync(cancellationToken)
            : new List<Guid>();

        if (advisorUsers.Count == 0)
        {
            advisorUsers = await _context.Users
                .AsNoTracking()
                .Where(u => u.IsActive && u.UserRoles.Any(ur => ur.Role.Name == AppRoles.Advisor))
                .Select(u => u.Id)
                .ToListAsync(cancellationToken);
        }

        var title = $"Assign a garage: {request.RequestNumber}";
        var body = $"The customer paid the ₹{request.AdvancePaidAmount:N0} advance for {request.ServicePackageName} on a " +
                   $"{request.VehicleMake} {request.VehicleModel}{FuelSuffix(request)}. Pick a nearby garage to confirm the booking.";

        foreach (var userId in advisorUsers)
        {
            _context.Notifications.Add(new Notification(
                userId,
                title,
                body,
                "PACKAGE_ADVANCE_PAID",
                NotificationChannel.InApp,
                request.Id,
                "ServiceRequest"));
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    private static string FuelSuffix(ServiceRequest request) =>
        string.IsNullOrWhiteSpace(request.VehicleFuel) ? string.Empty : $" ({request.VehicleFuel})";

    public async Task NotifyGaragesOfDispatchedRequestAsync(
        ServiceRequest request,
        IReadOnlyList<GarageRequest> garageRequests,
        CancellationToken cancellationToken = default)
    {
        // Package bookings are assigned to one garage by the advisor, never sent out for quotes.
        if (garageRequests.Count == 0 || request.IsPackageBooking) return;

        var garageIds = garageRequests.Select(gr => gr.GarageId).Distinct().ToList();

        // Query all staff/owners of the dispatched garages
        var garageUsers = await _context.GarageUsers
            .AsNoTracking()
            .Where(gu => garageIds.Contains(gu.GarageId) && gu.User.IsActive)
            .Select(gu => new { gu.GarageId, gu.UserId })
            .ToListAsync(cancellationToken);

        var garageRequestsByGarageId = garageRequests.ToDictionary(gr => gr.GarageId);

        foreach (var gu in garageUsers)
        {
            if (garageRequestsByGarageId.TryGetValue(gu.GarageId, out var gr))
            {
                var title = $"New Job Request: {request.RequestNumber}";
                var body = $"Vehicle: {request.VehicleYear} {request.VehicleMake} {request.VehicleModel} ({gr.DistanceKm} KM away). Services: {request.ServiceCategory}. Pick-up & drop: {request.PickupSummary}. Problem: {request.ProblemDescription}";
                var metadata = JsonSerializer.Serialize(new
                {
                    GarageRequestId = gr.Id,
                    ServiceRequestId = request.Id,
                    request.RequestNumber,
                    request.VehicleMake,
                    request.VehicleModel,
                    gr.DistanceKm
                });

                var notification = new Notification(
                    gu.UserId,
                    title,
                    body,
                    "GARAGE_REQUEST_DISPATCHED",
                    NotificationChannel.InApp,
                    gr.Id,
                    "GarageRequest",
                    metadata);

                _context.Notifications.Add(notification);
            }
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task NotifyAdvisorsOfGarageQuoteAsync(
        GarageQuote quote,
        CancellationToken cancellationToken = default)
    {
        var advisorUsers = await _context.Users
            .AsNoTracking()
            .Where(u => u.IsActive && u.UserRoles.Any(ur => ur.Role.Name == AppRoles.Advisor || ur.Role.Name == AppRoles.SuperAdmin))
            .Select(u => u.Id)
            .ToListAsync(cancellationToken);

        var title = $"New Quote Received: {quote.QuoteNumber}";
        var body = $"A quote of {quote.Currency} {quote.TotalAmount:N2} was submitted for request {quote.ServiceRequest?.RequestNumber ?? quote.ServiceRequestId.ToString()}.";
        var metadata = JsonSerializer.Serialize(new
        {
            quote.Id,
            quote.QuoteNumber,
            quote.ServiceRequestId,
            quote.GarageId,
            quote.TotalAmount,
            quote.Currency,
            quote.VersionNumber
        });

        foreach (var userId in advisorUsers)
        {
            var notification = new Notification(
                userId,
                title,
                body,
                "GARAGE_QUOTE_SUBMITTED",
                NotificationChannel.InApp,
                quote.Id,
                "GarageQuote",
                metadata);

            _context.Notifications.Add(notification);
        }

        await _context.SaveChangesAsync(cancellationToken);
    }
}
