using BroCoMod.Application.DTOs;
using BroCoMod.Domain.Entities;

namespace BroCoMod.Application.Interfaces;

public interface IPaymentService
{
    Task<InitiatePaymentResponseDto> InitiateQuotationPaymentAsync(
        InitiatePaymentRequestDto request,
        Guid customerId,
        CancellationToken cancellationToken = default);

    Task<InitiatePaymentResponseDto> InitiateAdditionalWorkPaymentAsync(
        InitiateAdditionalWorkPaymentRequestDto request,
        Guid customerId,
        CancellationToken cancellationToken = default);

    Task<PaymentDto> VerifyAndCompletePaymentAsync(
        VerifyPaymentRequestDto request,
        Guid customerId,
        CancellationToken cancellationToken = default);

    Task<bool> ProcessWebhookAsync(
        string provider,
        string payload,
        string signature,
        CancellationToken cancellationToken = default);

    Task<PaymentDto?> GetPaymentByIdAsync(
        Guid paymentId,
        Guid requestingUserId,
        string role,
        CancellationToken cancellationToken = default);

    Task<IEnumerable<PaymentDto>> GetCustomerPaymentsAsync(
        Guid customerId,
        CancellationToken cancellationToken = default);

    Task<PaymentDto> ProcessRefundAsync(
        Guid paymentId,
        decimal amount,
        string reason,
        Guid adminId,
        CancellationToken cancellationToken = default);
}

public interface IInvoiceService
{
    Task<InvoiceDto> GenerateInvoiceForPaymentAsync(
        Guid paymentId,
        CancellationToken cancellationToken = default);

    Task<InvoiceDto?> GetInvoiceByIdAsync(
        Guid invoiceId,
        Guid requestingUserId,
        string role,
        CancellationToken cancellationToken = default);

    Task<InvoiceDto?> GetInvoiceByPaymentIdAsync(
        Guid paymentId,
        Guid requestingUserId,
        string role,
        CancellationToken cancellationToken = default);

    Task<IEnumerable<InvoiceDto>> GetCustomerInvoicesAsync(
        Guid customerId,
        CancellationToken cancellationToken = default);

    Task<InvoiceDto> VoidInvoiceAsync(
        Guid invoiceId,
        string reason,
        Guid adminId,
        CancellationToken cancellationToken = default);
}

public interface ISettlementService
{
    Task<GarageSettlementDto> CreateSettlementForPaymentAsync(
        Guid paymentId,
        CancellationToken cancellationToken = default);

    Task<IEnumerable<GarageSettlementDto>> GetGarageSettlementsAsync(
        Guid garageId,
        CancellationToken cancellationToken = default);

    Task<GarageSettlementDto?> GetSettlementByIdAsync(
        Guid settlementId,
        Guid garageId,
        CancellationToken cancellationToken = default);

    Task<GarageSettlementDto> MarkSettlementCompletedAsync(
        Guid settlementId,
        string payoutTransactionRef,
        string? referenceNotes,
        Guid adminId,
        CancellationToken cancellationToken = default);
}

public interface IFinancialLedgerService
{
    Task RecordPaymentEntriesAsync(
        Payment payment,
        CancellationToken cancellationToken = default);

    Task RecordSettlementEntriesAsync(
        GarageSettlement settlement,
        CancellationToken cancellationToken = default);

    Task RecordRefundEntriesAsync(
        Payment payment,
        decimal refundAmount,
        string reason,
        CancellationToken cancellationToken = default);

    Task<IEnumerable<FinancialLedgerEntryDto>> GetLedgerEntriesAsync(
        Guid? accountId = null,
        string? accountType = null,
        CancellationToken cancellationToken = default);
}

public interface IAdminFinanceService
{
    Task<FinanceOverviewDto> GetFinanceOverviewAsync(
        DateTime? fromUtc = null,
        DateTime? toUtc = null,
        CancellationToken cancellationToken = default);

    Task<PagedResult<PaymentDto>> GetAdminPaymentsAsync(
        PaymentFilterDto filter,
        CancellationToken cancellationToken = default);

    Task<PagedResult<GarageSettlementDto>> GetAdminSettlementsAsync(
        SettlementFilterDto filter,
        CancellationToken cancellationToken = default);
}
