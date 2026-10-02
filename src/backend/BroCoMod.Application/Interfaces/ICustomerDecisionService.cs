using BroCoMod.Application.DTOs;

namespace BroCoMod.Application.Interfaces;

public interface ICustomerDecisionService
{
    Task<ApiResponse<BookingConfirmationDto>> AcceptQuotationAsync(
        Guid quotationId,
        Guid customerId,
        AcceptQuotationRequest request,
        string? clientIpAddress = null,
        string? userAgent = null,
        CancellationToken ct = default);

    Task<ApiResponse<CustomerQuotationDecisionDto>> RejectQuotationAsync(
        Guid quotationId,
        Guid customerId,
        RejectQuotationRequest request,
        string? clientIpAddress = null,
        string? userAgent = null,
        CancellationToken ct = default);

    Task<ApiResponse<CustomerQuotationDecisionDto>> GetDecisionAsync(
        Guid quotationId,
        Guid requestingUserId,
        string requestingRole,
        CancellationToken ct = default);
}
