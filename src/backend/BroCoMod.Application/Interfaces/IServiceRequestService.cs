using BroCoMod.Application.DTOs;

namespace BroCoMod.Application.Interfaces;

public interface IServiceRequestService
{
    Task<ServiceRequestDetailDto> CreateServiceRequestAsync(
        Guid customerId,
        CreateServiceBookingRequest request,
        string? idempotencyKey = null,
        CancellationToken cancellationToken = default);

    Task<PagedResult<CustomerServiceRequestSummaryDto>> GetCustomerRequestsAsync(
        Guid customerId,
        int page = 1,
        int pageSize = 10,
        CancellationToken cancellationToken = default);

    Task<ServiceRequestDetailDto> GetCustomerRequestByIdAsync(
        Guid customerId,
        Guid requestId,
        CancellationToken cancellationToken = default);

    Task<bool> CancelCustomerRequestAsync(
        Guid customerId,
        Guid requestId,
        string reason,
        CancellationToken cancellationToken = default);

    Task<PagedResult<GarageIncomingRequestDto>> GetGarageRequestsAsync(
        Guid garageId,
        int page = 1,
        int pageSize = 10,
        CancellationToken cancellationToken = default);

    Task<GarageIncomingRequestDetailDto> GetGarageRequestByIdAsync(
        Guid garageId,
        Guid garageRequestId,
        CancellationToken cancellationToken = default);

    Task<PagedResult<AdvisorServiceRequestSummaryDto>> GetAdvisorRequestsAsync(
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default);

    Task<AdvisorServiceRequestDetailDto> GetAdvisorRequestByIdAsync(
        Guid requestId,
        CancellationToken cancellationToken = default);

    Task<PagedResult<AdminServiceRequestSummaryDto>> GetAdminRequestsAsync(
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default);

    Task<AdminServiceRequestDetailDto> GetAdminRequestByIdAsync(
        Guid requestId,
        CancellationToken cancellationToken = default);
}
