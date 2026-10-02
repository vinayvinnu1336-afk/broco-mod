using BroCoMod.Domain.Common;
using BroCoMod.Domain.Entities.Identity;
using BroCoMod.Domain.Enums;

namespace BroCoMod.Domain.Entities;

public class Notification : BaseEntity
{
    public Guid UserId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string Message { get; private set; } = string.Empty;
    public NotificationChannel Channel { get; private set; } = NotificationChannel.InApp;
    public string Type { get; private set; } = string.Empty;
    public Guid? ReferenceId { get; private set; }
    public string? ReferenceType { get; private set; }
    public bool IsRead { get; private set; } = false;
    public DateTime? ReadAtUtc { get; private set; }
    public DateTime SentAtUtc { get; private set; }
    public string? MetadataJson { get; private set; }

    // Navigation property
    public User User { get; private set; } = default!;

    protected Notification() { }

    public Notification(
        Guid userId,
        string title,
        string message,
        string type,
        NotificationChannel channel = NotificationChannel.InApp,
        Guid? referenceId = null,
        string? referenceType = null,
        string? metadataJson = null)
    {
        if (userId == Guid.Empty) throw new ArgumentException("UserId cannot be empty.", nameof(userId));
        if (string.IsNullOrWhiteSpace(title)) throw new ArgumentException("Title cannot be empty.", nameof(title));
        if (string.IsNullOrWhiteSpace(message)) throw new ArgumentException("Message cannot be empty.", nameof(message));

        UserId = userId;
        Title = title.Trim();
        Message = message.Trim();
        Type = type?.Trim() ?? "GENERAL";
        Channel = channel;
        ReferenceId = referenceId;
        ReferenceType = referenceType;
        MetadataJson = metadataJson;
        IsRead = false;
        SentAtUtc = DateTime.UtcNow;
    }

    public void MarkAsRead()
    {
        if (!IsRead)
        {
            IsRead = true;
            ReadAtUtc = DateTime.UtcNow;
            UpdatedAtUtc = DateTime.UtcNow;
        }
    }
}
