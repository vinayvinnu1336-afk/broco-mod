using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Entities.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BroCoMod.Infrastructure.Services;

public class AuditService : IAuditService
{
    private readonly IApplicationDbContext _context;
    private readonly ILogger<AuditService> _logger;

    public AuditService(IApplicationDbContext context, ILogger<AuditService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task LogAsync(
        string action,
        Guid? userId = null,
        string? userEmail = null,
        string? entityName = null,
        string? entityId = null,
        string? details = null,
        string? ipAddress = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var auditLog = new AuditLog(
                action: action,
                userId: userId,
                userEmail: userEmail,
                entityName: entityName,
                entityId: entityId,
                details: details,
                ipAddress: ipAddress);

            _context.AuditLogs.Add(auditLog);
            await _context.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("[AuditLog] Action={Action}, User={UserEmail}, Entity={EntityName}, EntityId={EntityId}, IP={IpAddress}",
                action, userEmail ?? "Anonymous", entityName ?? "None", entityId ?? "None", ipAddress ?? "Unknown");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to persist audit log for Action={Action}", action);
        }
    }

    public async Task<IReadOnlyList<AdminAuditLogSummaryDto>> GetRecentAuditLogsAsync(int limit = 50, CancellationToken cancellationToken = default)
    {
        var logs = await _context.AuditLogs
            .AsNoTracking()
            .OrderByDescending(l => l.TimestampUtc)
            .Take(limit)
            .Select(l => new AdminAuditLogSummaryDto(
                l.Id,
                l.Action,
                l.UserEmail,
                l.EntityName,
                l.EntityId,
                l.Details,
                l.IpAddress,
                l.TimestampUtc))
            .ToListAsync(cancellationToken);

        return logs;
    }
}
