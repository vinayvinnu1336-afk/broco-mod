using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Enums;

namespace BroCoMod.Application.Interfaces;

public record NotificationMessage(
    Guid UserId,
    string Title,
    string Message,
    string Type,
    NotificationChannel Channel = NotificationChannel.InApp,
    Guid? ReferenceId = null,
    string? ReferenceType = null,
    string? MetadataJson = null
);

public interface INotificationProvider
{
    NotificationChannel Channel { get; }
    Task<bool> SendAsync(NotificationMessage message, CancellationToken cancellationToken = default);
}

public interface INotificationService
{
    Task SendInAppNotificationAsync(
        Guid userId,
        string title,
        string message,
        string type,
        Guid? referenceId = null,
        string? referenceType = null,
        string? metadataJson = null,
        CancellationToken cancellationToken = default);

    Task NotifyAdvisorsOfNewRequestAsync(
        ServiceRequest request,
        CancellationToken cancellationToken = default);

    Task NotifyGaragesOfDispatchedRequestAsync(
        ServiceRequest request,
        IReadOnlyList<GarageRequest> garageRequests,
        CancellationToken cancellationToken = default);
}
