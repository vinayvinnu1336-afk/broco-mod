using BroCoMod.Domain.Common;

namespace BroCoMod.Domain.Entities.Identity;

public class AuditLog : BaseEntity
{
    public Guid? UserId { get; private set; }
    public string? UserEmail { get; private set; }
    public string Action { get; private set; } = string.Empty;
    public string? EntityName { get; private set; }
    public string? EntityId { get; private set; }
    public string? Details { get; private set; }
    public string? IpAddress { get; private set; }
    public DateTime TimestampUtc { get; private set; } = DateTime.UtcNow;

    protected AuditLog() { }

    public AuditLog(
        string action,
        Guid? userId = null,
        string? userEmail = null,
        string? entityName = null,
        string? entityId = null,
        string? details = null,
        string? ipAddress = null)
    {
        Action = action;
        UserId = userId;
        UserEmail = userEmail;
        EntityName = entityName;
        EntityId = entityId;
        Details = details;
        IpAddress = ipAddress;
        TimestampUtc = DateTime.UtcNow;
    }
}
