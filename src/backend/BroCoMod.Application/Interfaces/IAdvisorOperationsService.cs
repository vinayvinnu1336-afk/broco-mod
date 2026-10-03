using BroCoMod.Application.DTOs;

namespace BroCoMod.Application.Interfaces;

public interface IAdvisorOperationsService
{
    Task<AdvisorDashboardKpiDto> GetAdvisorDashboardKpisAsync(Guid advisorUserId, CancellationToken cancellationToken = default);
    Task<AdvisorWorkQueueDto> GetAdvisorWorkQueueAsync(Guid advisorUserId, CancellationToken cancellationToken = default);
}
