using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Constants;
using Microsoft.EntityFrameworkCore;

namespace BroCoMod.Infrastructure.Services;

public class AdminPortalService : IAdminPortalService
{
    private readonly IApplicationDbContext _context;
    private readonly IAuditService _auditService;

    public AdminPortalService(IApplicationDbContext context, IAuditService auditService)
    {
        _context = context;
        _auditService = auditService;
    }

    public async Task<AdminDashboardDto> GetDashboardAsync(CancellationToken cancellationToken = default)
    {
        var totalUsers = await _context.Users.CountAsync(cancellationToken);
        var totalCustomers = await _context.CustomerProfiles.CountAsync(cancellationToken);
        var totalGarages = await _context.Garages.CountAsync(cancellationToken);
        var totalAdvisors = await _context.AdvisorProfiles.CountAsync(cancellationToken);
        var totalRequests = await _context.ServiceRequests.CountAsync(cancellationToken);

        var recentUsers = await GetUsersAsync(cancellationToken);
        var recentAuditLogs = await _auditService.GetRecentAuditLogsAsync(10, cancellationToken);

        return new AdminDashboardDto(
            totalUsers,
            totalCustomers,
            totalGarages,
            totalAdvisors,
            totalRequests,
            recentUsers.Take(5).ToList(),
            recentAuditLogs);
    }

    public async Task<IReadOnlyList<AdminUserSummaryDto>> GetUsersAsync(CancellationToken cancellationToken = default)
    {
        return await _context.Users
            .AsNoTracking()
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
            .OrderByDescending(u => u.CreatedAtUtc)
            .Take(50)
            .Select(u => new AdminUserSummaryDto(
                u.Id,
                u.Email,
                u.FullName,
                u.PhoneNumber,
                u.UserRoles.Select(ur => ur.Role.Name).ToList(),
                u.IsActive,
                u.CreatedAtUtc))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<AdminGarageSummaryDto>> GetGaragesAsync(CancellationToken cancellationToken = default)
    {
        return await _context.Garages
            .AsNoTracking()
            .OrderBy(g => g.Name)
            .Select(g => new AdminGarageSummaryDto(
                g.Id,
                g.Name,
                g.Email,
                g.PhoneNumber,
                g.Address,
                g.IsActive,
                _context.GarageUsers.Count(gu => gu.GarageId == g.Id),
                g.CreatedAtUtc))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<AdminAdvisorSummaryDto>> GetAdvisorsAsync(CancellationToken cancellationToken = default)
    {
        return await _context.AdvisorProfiles
            .AsNoTracking()
            .Include(a => a.User)
            .OrderBy(a => a.User.FullName)
            .Select(a => new AdminAdvisorSummaryDto(
                a.Id,
                a.User.FullName,
                a.User.Email,
                a.EmployeeCode,
                a.Specialization,
                a.User.IsActive,
                a.CreatedAtUtc))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<AdminAuditLogSummaryDto>> GetAuditLogsAsync(int limit = 50, CancellationToken cancellationToken = default)
    {
        return await _auditService.GetRecentAuditLogsAsync(limit, cancellationToken);
    }

    public Task<AdminSettingsDto> GetSettingsAsync(CancellationToken cancellationToken = default)
    {
        // System operational parameters
        var settings = new AdminSettingsDto(
            DefaultSearchRadiusKm: 10.0,
            MaxSearchRadiusKm: 50.0,
            MaxFailedLoginAttempts: 5,
            AccountLockoutMinutes: 15,
            JwtExpiryMinutes: 60,
            RefreshTokenExpiryDays: 7);

        return Task.FromResult(settings);
    }
}
