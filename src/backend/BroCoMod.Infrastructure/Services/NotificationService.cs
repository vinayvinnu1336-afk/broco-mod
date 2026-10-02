using System.Text.Json;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Constants;
using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Enums;
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

public class EmailNotificationProvider : INotificationProvider
{
    private readonly ILogger<EmailNotificationProvider> _logger;

    public EmailNotificationProvider(ILogger<EmailNotificationProvider> logger)
    {
        _logger = logger;
    }

    public NotificationChannel Channel => NotificationChannel.Email;

    public Task<bool> SendAsync(NotificationMessage message, CancellationToken cancellationToken = default)
    {
        // Provider stub - ready for SendGrid / SMTP integration without external dependencies
        _logger.LogInformation("[EmailProvider] Queued email notification to User {UserId}: {Title}", message.UserId, message.Title);
        return Task.FromResult(true);
    }
}

public class SmsNotificationProvider : INotificationProvider
{
    private readonly ILogger<SmsNotificationProvider> _logger;

    public SmsNotificationProvider(ILogger<SmsNotificationProvider> logger)
    {
        _logger = logger;
    }

    public NotificationChannel Channel => NotificationChannel.Sms;

    public Task<bool> SendAsync(NotificationMessage message, CancellationToken cancellationToken = default)
    {
        // Provider stub - ready for Twilio / Gupshup SMS integration
        _logger.LogInformation("[SmsProvider] Queued SMS notification to User {UserId}: {Title}", message.UserId, message.Title);
        return Task.FromResult(true);
    }
}

public class WhatsAppNotificationProvider : INotificationProvider
{
    private readonly ILogger<WhatsAppNotificationProvider> _logger;

    public WhatsAppNotificationProvider(ILogger<WhatsAppNotificationProvider> logger)
    {
        _logger = logger;
    }

    public NotificationChannel Channel => NotificationChannel.WhatsApp;

    public Task<bool> SendAsync(NotificationMessage message, CancellationToken cancellationToken = default)
    {
        // Provider stub - ready for Meta Cloud API integration
        _logger.LogInformation("[WhatsAppProvider] Queued WhatsApp notification to User {UserId}: {Title}", message.UserId, message.Title);
        return Task.FromResult(true);
    }
}

public class NotificationService : INotificationService
{
    private readonly IApplicationDbContext _context;
    private readonly IEnumerable<INotificationProvider> _providers;
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(
        IApplicationDbContext context,
        IEnumerable<INotificationProvider> providers,
        ILogger<NotificationService> logger)
    {
        _context = context;
        _providers = providers;
        _logger = logger;
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

        var title = $"New Service Request: {request.RequestNumber}";
        var body = $"Vehicle: {request.VehicleYear} {request.VehicleMake} {request.VehicleModel}. Problem: {request.ProblemDescription}";
        var metadata = JsonSerializer.Serialize(new
        {
            request.Id,
            request.RequestNumber,
            request.VehicleMake,
            request.VehicleModel,
            request.VehicleYear,
            request.ProblemDescription,
            request.ServiceCategory
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

    public async Task NotifyGaragesOfDispatchedRequestAsync(
        ServiceRequest request,
        IReadOnlyList<GarageRequest> garageRequests,
        CancellationToken cancellationToken = default)
    {
        if (garageRequests.Count == 0) return;

        var garageIds = garageRequests.Select(gr => gr.GarageId).Distinct().ToList();

        // Query all staff/owners of the dispatched garages
        var garageUsers = await _context.GarageUsers
            .AsNoTracking()
            .Where(gu => garageIds.Contains(gu.GarageId))
            .Select(gu => new { gu.GarageId, gu.UserId })
            .ToListAsync(cancellationToken);

        var garageRequestsByGarageId = garageRequests.ToDictionary(gr => gr.GarageId);

        foreach (var gu in garageUsers)
        {
            if (garageRequestsByGarageId.TryGetValue(gu.GarageId, out var gr))
            {
                var title = $"New Job Request: {request.RequestNumber}";
                var body = $"Vehicle: {request.VehicleYear} {request.VehicleMake} {request.VehicleModel} ({gr.DistanceKm} KM away). Problem: {request.ProblemDescription}";
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
}
