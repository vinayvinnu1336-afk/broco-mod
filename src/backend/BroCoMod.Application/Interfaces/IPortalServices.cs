using BroCoMod.Application.DTOs;

namespace BroCoMod.Application.Interfaces;

public interface ICustomerPortalService
{
    Task<CustomerDashboardDto> GetDashboardAsync(Guid customerId, CancellationToken cancellationToken = default);
    Task<CustomerProfileDto> GetProfileAsync(Guid customerId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<CustomerVehicleDto>> GetVehiclesAsync(Guid customerId, CancellationToken cancellationToken = default);
    Task<CustomerVehicleDto> AddVehicleAsync(Guid customerId, CreateVehicleDto dto, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<CustomerRequestSummaryDto>> GetRequestsAsync(Guid customerId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<CustomerQuoteSummaryDto>> GetQuotesAsync(Guid customerId, CancellationToken cancellationToken = default);
    Task<CustomerQuoteSummaryDto?> GetQuoteByIdAsync(Guid customerId, Guid quoteId, CancellationToken cancellationToken = default);
}

public interface IGaragePortalService
{
    Task<GarageDashboardDto> GetDashboardAsync(Guid garageId, CancellationToken cancellationToken = default);
    Task<GarageProfileDto> GetProfileAsync(Guid garageId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<GarageRequestSummaryDto>> GetRequestsAsync(Guid garageId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<GarageQuoteSummaryDto>> GetQuotesAsync(Guid garageId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<GarageConfirmedBookingDto>> GetConfirmedBookingsAsync(Guid garageId, CancellationToken cancellationToken = default);
}

public interface IAdvisorPortalService
{
    Task<AdvisorDashboardDto> GetDashboardAsync(Guid advisorId, CancellationToken cancellationToken = default);
    Task<AdvisorProfileDto> GetProfileAsync(Guid advisorId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AdvisorRequestSummaryDto>> GetRequestsUnderReviewAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AdvisorQuoteSummaryDto>> GetQuotesForReviewAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AdvisorAssignmentSummaryDto>> GetRecentAssignmentsAsync(CancellationToken cancellationToken = default);
}

public interface IAdminPortalService
{
    Task<AdminDashboardDto> GetDashboardAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AdminUserSummaryDto>> GetUsersAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AdminGarageSummaryDto>> GetGaragesAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AdminAdvisorSummaryDto>> GetAdvisorsAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AdminAuditLogSummaryDto>> GetAuditLogsAsync(int limit = 50, CancellationToken cancellationToken = default);
    Task<AdminSettingsDto> GetSettingsAsync(CancellationToken cancellationToken = default);
}
