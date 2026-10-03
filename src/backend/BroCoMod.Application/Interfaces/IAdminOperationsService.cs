using BroCoMod.Application.DTOs;

namespace BroCoMod.Application.Interfaces;

public interface IAdminOperationsService
{
    Task<AdminDashboardKpiDto> GetDashboardKpisAsync(CancellationToken cancellationToken = default);
    
    Task<PagedResult<AdminRequestSummaryDto>> GetRequestsAsync(AdminRequestFilter filter, CancellationToken cancellationToken = default);
    
    Task<AdminRequestOperationalDetailDto?> GetRequestOperationalDetailAsync(Guid id, CancellationToken cancellationToken = default);
    
    Task<PagedResult<AdminGarageListDto>> GetGaragesAsync(AdminGarageFilter filter, CancellationToken cancellationToken = default);
    
    Task<AdminGarageDetailDto?> GetGarageDetailAsync(Guid id, CancellationToken cancellationToken = default);
    
    Task<bool> VerifyGarageAsync(Guid id, Guid adminId, CancellationToken cancellationToken = default);
    
    Task<bool> SuspendGarageAsync(Guid id, string reason, Guid adminId, CancellationToken cancellationToken = default);
    
    Task<bool> ActivateGarageAsync(Guid id, Guid adminId, CancellationToken cancellationToken = default);
    
    Task<bool> DeactivateGarageAsync(Guid id, string reason, Guid adminId, CancellationToken cancellationToken = default);
    
    Task<bool> UpdateGarageRadiusAsync(Guid id, double radiusKm, Guid adminId, CancellationToken cancellationToken = default);
    
    Task<PagedResult<AdminAdvisorListDto>> GetAdvisorsAsync(AdminAdvisorFilter filter, CancellationToken cancellationToken = default);
    
    Task<bool> ActivateAdvisorAsync(Guid id, Guid adminId, CancellationToken cancellationToken = default);
    
    Task<bool> DeactivateAdvisorAsync(Guid id, string reason, Guid adminId, CancellationToken cancellationToken = default);
    
    Task<PagedResult<AdminCustomerListDto>> GetCustomersAsync(AdminCustomerFilter filter, CancellationToken cancellationToken = default);
    
    Task<AdminCustomerDetailDto?> GetCustomerDetailAsync(Guid id, CancellationToken cancellationToken = default);
    
    Task<PagedResult<AdminJobListItemDto>> GetJobsAsync(AdminJobFilter filter, CancellationToken cancellationToken = default);
    
    Task<AdminJobDetailDto?> GetJobDetailAsync(Guid id, CancellationToken cancellationToken = default);
    
    Task<AdminAttentionQueueDto> GetAttentionQueueAsync(CancellationToken cancellationToken = default);
    
    Task<PagedResult<AdminAuditLogSummaryDto>> GetAuditLogsAsync(AdminAuditFilter filter, CancellationToken cancellationToken = default);
    
    Task<PagedResult<AdminNotificationListDto>> GetNotificationsAsync(AdminNotificationFilter filter, CancellationToken cancellationToken = default);
    
    Task<bool> RetryNotificationAsync(Guid id, Guid adminId, CancellationToken cancellationToken = default);
    
    Task<SystemHealthDto> GetSystemHealthAsync(CancellationToken cancellationToken = default);
}
