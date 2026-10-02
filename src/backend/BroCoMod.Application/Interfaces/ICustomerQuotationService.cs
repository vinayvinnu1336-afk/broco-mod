using BroCoMod.Application.DTOs;

namespace BroCoMod.Application.Interfaces;

public interface ICustomerQuotationService
{
    Task<ApiResponse<CustomerQuotationDto>> CreateCustomerQuotationDraftAsync(Guid serviceRequestId, CreateCustomerQuotationRequest request, Guid advisorId, CancellationToken ct = default);
    Task<ApiResponse<CustomerQuotationDto>> GetCustomerQuotationByIdAsync(Guid quotationId, Guid requestingUserId, string requestingRole, CancellationToken ct = default);
    Task<ApiResponse<CustomerQuotationDto>> UpdateCustomerQuotationDraftAsync(Guid quotationId, UpdateCustomerQuotationDraftRequest request, Guid advisorId, CancellationToken ct = default);
    Task<ApiResponse<CustomerQuotationDto>> MarkCustomerQuotationReadyAsync(Guid quotationId, Guid advisorId, CancellationToken ct = default);
    Task<ApiResponse<CustomerQuotationDto>> SendCustomerQuotationAsync(Guid quotationId, Guid advisorId, CancellationToken ct = default);
    Task<ApiResponse<List<CustomerFacingQuotationDto>>> GetQuotationsForCustomerAsync(Guid customerId, CancellationToken ct = default);
    Task<ApiResponse<CustomerFacingQuotationDto>> GetCustomerQuotationForCustomerAsync(Guid quotationId, Guid customerId, CancellationToken ct = default);
    Task<ApiResponse<List<CustomerQuotationSummaryDto>>> GetPlatformCustomerQuotationsAsync(int page = 1, int pageSize = 50, CancellationToken ct = default);
}
