namespace BroCoMod.Application.DTOs;

public record InitiatePaymentRequestDto(
    Guid QuotationId,
    string? IdempotencyKey = null
);

public record InitiateAdditionalWorkPaymentRequestDto(
    Guid AdditionalWorkQuotationId,
    string? IdempotencyKey = null
);

public record InitiatePaymentResponseDto(
    Guid PaymentId,
    string PaymentNumber,
    decimal Amount,
    string Currency,
    string GatewayProvider,
    string? GatewayOrderId,
    string? CheckoutUrl,
    Dictionary<string, string>? ProviderData
);

public record VerifyPaymentRequestDto(
    Guid PaymentId,
    string GatewayPaymentId,
    string? GatewaySignature = null,
    string? GatewayOrderId = null
);

public record PaymentDto(
    Guid Id,
    string PaymentNumber,
    Guid? CustomerQuotationId,
    Guid? AdditionalWorkQuotationId,
    Guid? ServiceJobId,
    Guid CustomerId,
    Guid? GarageId,
    decimal Amount,
    string Currency,
    string Status,
    string Purpose,
    string PaymentMethod,
    string GatewayProvider,
    string? GatewayOrderId,
    string? GatewayPaymentId,
    decimal RefundedAmount,
    DateTime? PaidAtUtc,
    DateTime CreatedAtUtc,
    Guid? ServiceRequestId = null
);

public record InvoiceDto(
    Guid Id,
    string InvoiceNumber,
    Guid PaymentId,
    Guid? CustomerQuotationId,
    Guid? AdditionalWorkQuotationId,
    Guid? ServiceJobId,
    Guid CustomerId,
    Guid? GarageId,
    string Status,
    decimal Subtotal,
    decimal DiscountAmount,
    decimal TotalAmount,
    string Currency,
    string BillingName,
    string BillingEmail,
    string? BillingAddress,
    string LineItemsJson,
    DateTime IssuedAtUtc,
    DateTime? PaidAtUtc,
    DateTime? VoidedAtUtc,
    string? VoidReason
);

public record GarageSettlementDto(
    Guid Id,
    string SettlementNumber,
    Guid GarageId,
    string? GarageName,
    Guid ServiceJobId,
    string? JobNumber,
    Guid PaymentId,
    string? PaymentNumber,
    decimal GrossAmount,
    decimal PlatformFeePercentage,
    decimal PlatformFeeFixed,
    decimal PlatformFeeAmount,
    decimal TotalPlatformFee,
    decimal NetPayableToGarage,
    string Currency,
    string Status,
    DateTime? SettledAtUtc,
    string? PayoutTransactionRef,
    string? ReferenceNotes,
    DateTime CreatedAtUtc
);

public record FinancialLedgerEntryDto(
    Guid Id,
    string TransactionReference,
    string EntryType,
    decimal DebitAmount,
    decimal CreditAmount,
    string Currency,
    string AccountType,
    Guid? AccountId,
    Guid? PaymentId,
    Guid? InvoiceId,
    Guid? SettlementId,
    string Description,
    DateTime CreatedAtUtc
);

public record PlatformFeeConfigDto(
    Guid Id,
    string Name,
    decimal FeePercentage,
    decimal FixedFee,
    bool IsActive,
    DateTime EffectiveFromUtc,
    DateTime? EffectiveToUtc
);

public record FinanceOverviewDto(
    decimal TotalGrossRevenue,
    decimal TotalPlatformRevenue,
    decimal TotalGarageSettlements,
    decimal TotalRefunds,
    decimal NetPlatformProfit,
    int TotalPaymentsCount,
    int TotalInvoicesCount,
    int PendingSettlementsCount,
    int CompletedSettlementsCount,
    decimal TotalPlatformMargin = 0m,
    // 10% model: advances customers paid BroCo online, and commission garages paid / still owe.
    decimal TotalBookingAdvances = 0m,
    decimal TotalCommissionCollected = 0m,
    decimal TotalCommissionOutstanding = 0m
);

public record PaymentFilterDto(
    string? Status = null,
    DateTime? FromDate = null,
    DateTime? ToDate = null,
    Guid? GarageId = null,
    Guid? CustomerId = null,
    int Page = 1,
    int PageSize = 20,
    // Payment number, gateway order / payment id, request number, garage or customer name
    string? Search = null,
    // PaymentPurpose name, e.g. BookingAdvance or GarageCommission
    string? Purpose = null,
    // PaymentMethod name, e.g. Upi or Card
    string? Method = null
);

public record SettlementFilterDto(
    string? Status = null,
    DateTime? FromDate = null,
    DateTime? ToDate = null,
    Guid? GarageId = null,
    int Page = 1,
    int PageSize = 20,
    // Settlement number, garage name, job number or payout reference
    string? Search = null
);

public record RefundPaymentRequestDto(
    decimal Amount,
    string Reason
);

public record CompleteSettlementRequestDto(
    string PayoutTransactionRef,
    string? ReferenceNotes = null
);


