using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Constants;
using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Enums;
using BroCoMod.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BroCoMod.Infrastructure.Services;

/// <summary>
/// Server-authoritative payment orchestration service.
/// Coordinates payment order creation, verification, webhooks, invoice triggering, and settlement payouts.
/// </summary>
public class PaymentService : IPaymentService
{
    private readonly ApplicationDbContext _context;
    private readonly IPaymentGatewayFactory _gatewayFactory;
    private readonly IPaymentNumberGenerator _numberGenerator;
    private readonly IInvoiceService _invoiceService;
    private readonly ISettlementService _settlementService;
    private readonly IFinancialLedgerService _ledgerService;
    private readonly IAuditService _auditService;
    private readonly INotificationService _notificationService;
    private readonly ILogger<PaymentService> _logger;

    public PaymentService(
        ApplicationDbContext context,
        IPaymentGatewayFactory gatewayFactory,
        IPaymentNumberGenerator numberGenerator,
        IInvoiceService invoiceService,
        ISettlementService settlementService,
        IFinancialLedgerService ledgerService,
        IAuditService auditService,
        INotificationService notificationService,
        ILogger<PaymentService> logger)
    {
        _context = context;
        _gatewayFactory = gatewayFactory;
        _numberGenerator = numberGenerator;
        _invoiceService = invoiceService;
        _settlementService = settlementService;
        _ledgerService = ledgerService;
        _auditService = auditService;
        _notificationService = notificationService;
        _logger = logger;
    }

    private async Task<Guid> ResolveCustomerIdAsync(Guid customerIdOrUserId, CancellationToken ct)
    {
        var profile = await _context.CustomerProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.Id == customerIdOrUserId || cp.UserId == customerIdOrUserId, ct);
        return profile?.Id ?? customerIdOrUserId;
    }

    private async Task<Guid> ResolveCustomerUserIdAsync(Guid customerIdOrProfileId, CancellationToken ct)
    {
        var profile = await _context.CustomerProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.Id == customerIdOrProfileId || cp.UserId == customerIdOrProfileId, ct);
        return profile?.UserId ?? customerIdOrProfileId;
    }

    public async Task<InitiatePaymentResponseDto> InitiateQuotationPaymentAsync(
        InitiatePaymentRequestDto request,
        Guid customerId,
        CancellationToken cancellationToken = default)
    {
        // 1. Check idempotency key first
        if (!string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            var existingByKey = await _context.Payments
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.IdempotencyKey == request.IdempotencyKey.Trim(), cancellationToken);

            if (existingByKey != null)
            {
                _logger.LogInformation("Idempotency hit for key {Key}, returning existing payment {PaymentNumber}",
                    request.IdempotencyKey, existingByKey.PaymentNumber);

                return new InitiatePaymentResponseDto(
                    PaymentId: existingByKey.Id,
                    PaymentNumber: existingByKey.PaymentNumber,
                    Amount: existingByKey.Amount,
                    Currency: existingByKey.Currency,
                    GatewayProvider: existingByKey.GatewayProvider,
                    GatewayOrderId: existingByKey.GatewayOrderId,
                    CheckoutUrl: $"/customer/payments/checkout?orderId={existingByKey.GatewayOrderId}&paymentNumber={existingByKey.PaymentNumber}",
                    ProviderData: new Dictionary<string, string>
                    {
                        ["order_id"] = existingByKey.GatewayOrderId ?? "",
                        ["amount"] = ((long)(existingByKey.Amount * 100m)).ToString(),
                        ["currency"] = existingByKey.Currency
                    }
                );
            }
        }

        // 2. Resolve customer IDs
        var resolvedCustomerId = await ResolveCustomerIdAsync(customerId, cancellationToken);
        var resolvedCustomerUserId = await ResolveCustomerUserIdAsync(customerId, cancellationToken);

        // Fetch CustomerQuotation and authorize
        var quotation = await _context.CustomerQuotations
            .Include(q => q.ServiceRequest)
            .Include(q => q.ServiceJob)
            .FirstOrDefaultAsync(q => q.Id == request.QuotationId, cancellationToken);

        if (quotation == null)
            throw new KeyNotFoundException($"Customer quotation with ID {request.QuotationId} not found.");

        if (quotation.ServiceRequest == null ||
            (quotation.ServiceRequest.CustomerId != resolvedCustomerId && quotation.ServiceRequest.CustomerId != resolvedCustomerUserId))
            throw new UnauthorizedAccessException("You are not authorized to initiate payment for this quotation.");

        if (quotation.Status != CustomerQuotationStatus.Accepted && quotation.Status != CustomerQuotationStatus.Sent)
            throw new InvalidOperationException($"Cannot initiate payment for quotation with status '{quotation.Status}'. Allowed only when 'Accepted' or 'Sent'.");

        // 3. Server-authoritative payable calculation (strictly calculated on server)
        decimal authoritativeAmount = quotation.CustomerTotal;
        if (authoritativeAmount <= 0.0m)
            throw new InvalidOperationException("Authoritative payable amount must be greater than zero.");

        // 4. Resolve customer info
        var customer = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == resolvedCustomerUserId, cancellationToken);
        var customerEmail = customer?.Email ?? "customer@example.com";
        var customerName = customer?.FullName ?? "Customer";

        // 5. Generate Payment Number & create Gateway Order
        var paymentNumber = await _numberGenerator.NextPaymentNumberAsync(cancellationToken);
        var gateway = _gatewayFactory.GetGateway();

        var orderResult = await gateway.CreatePaymentOrderAsync(new CreatePaymentOrderParams(
            PaymentNumber: paymentNumber,
            Amount: authoritativeAmount,
            Currency: quotation.Currency,
            CustomerEmail: customerEmail,
            CustomerName: customerName,
            Description: $"Payment for Quotation {quotation.QuotationNumber}"
        ), cancellationToken);

        // 6. Create Payment entity
        var payment = new Payment(
            paymentNumber: paymentNumber,
            customerId: resolvedCustomerId,
            garageId: quotation.AssignedGarageId,
            amount: authoritativeAmount,
            currency: quotation.Currency,
            purpose: PaymentPurpose.ServiceQuotation,
            gatewayProvider: gateway.ProviderName,
            customerQuotationId: quotation.Id,
            serviceJobId: quotation.ServiceJob?.Id,
            idempotencyKey: request.IdempotencyKey
        );

        payment.SetGatewayOrder(orderResult.OrderId, gateway.ProviderName);

        _context.Payments.Add(payment);
        await _context.SaveChangesAsync(cancellationToken);

        // 7. Audit Log & Notification
        await _auditService.LogAsync(
            action: "PAYMENT_CREATED",
            userId: resolvedCustomerUserId,
            entityName: nameof(Payment),
            entityId: payment.Id.ToString(),
            details: $"Initiated payment {payment.PaymentNumber} for quotation {quotation.QuotationNumber}. Amount: {payment.Amount} {payment.Currency}. Gateway Order: {orderResult.OrderId}",
            cancellationToken: cancellationToken
        );

        await _notificationService.SendInAppNotificationAsync(
            userId: resolvedCustomerUserId,
            title: "Payment Order Created",
            message: $"Payment {payment.PaymentNumber} of {payment.Amount} {payment.Currency} initiated. Please complete the checkout.",
            type: "PAYMENT_CREATED",
            referenceId: payment.Id,
            referenceType: nameof(Payment),
            cancellationToken: cancellationToken
        );

        return new InitiatePaymentResponseDto(
            PaymentId: payment.Id,
            PaymentNumber: payment.PaymentNumber,
            Amount: payment.Amount,
            Currency: payment.Currency,
            GatewayProvider: payment.GatewayProvider,
            GatewayOrderId: payment.GatewayOrderId,
            CheckoutUrl: orderResult.CheckoutUrl,
            ProviderData: orderResult.ProviderData
        );
    }

    public async Task<InitiatePaymentResponseDto> InitiateAdditionalWorkPaymentAsync(
        InitiateAdditionalWorkPaymentRequestDto request,
        Guid customerId,
        CancellationToken cancellationToken = default)
    {
        if (!string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            var existingByKey = await _context.Payments
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.IdempotencyKey == request.IdempotencyKey.Trim(), cancellationToken);

            if (existingByKey != null)
            {
                return new InitiatePaymentResponseDto(
                    PaymentId: existingByKey.Id,
                    PaymentNumber: existingByKey.PaymentNumber,
                    Amount: existingByKey.Amount,
                    Currency: existingByKey.Currency,
                    GatewayProvider: existingByKey.GatewayProvider,
                    GatewayOrderId: existingByKey.GatewayOrderId,
                    CheckoutUrl: $"/customer/payments/checkout?orderId={existingByKey.GatewayOrderId}&paymentNumber={existingByKey.PaymentNumber}",
                    ProviderData: new Dictionary<string, string>
                    {
                        ["order_id"] = existingByKey.GatewayOrderId ?? "",
                        ["amount"] = ((long)(existingByKey.Amount * 100m)).ToString(),
                        ["currency"] = existingByKey.Currency
                    }
                );
            }
        }

        var resolvedCustomerId = await ResolveCustomerIdAsync(customerId, cancellationToken);
        var resolvedCustomerUserId = await ResolveCustomerUserIdAsync(customerId, cancellationToken);

        var awq = await _context.AdditionalWorkQuotations
            .Include(a => a.ServiceJob)
            .FirstOrDefaultAsync(a => a.Id == request.AdditionalWorkQuotationId, cancellationToken);

        if (awq == null)
            throw new KeyNotFoundException($"Additional work quotation with ID {request.AdditionalWorkQuotationId} not found.");

        if (awq.CustomerId != resolvedCustomerId && awq.CustomerId != resolvedCustomerUserId)
            throw new UnauthorizedAccessException("You are not authorized to initiate payment for this additional work quotation.");

        decimal authoritativeAmount = awq.Total;
        var customer = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == resolvedCustomerUserId, cancellationToken);
        var customerEmail = customer?.Email ?? "customer@example.com";
        var customerName = customer?.FullName ?? "Customer";

        var paymentNumber = await _numberGenerator.NextPaymentNumberAsync(cancellationToken);
        var gateway = _gatewayFactory.GetGateway();

        var orderResult = await gateway.CreatePaymentOrderAsync(new CreatePaymentOrderParams(
            PaymentNumber: paymentNumber,
            Amount: authoritativeAmount,
            Currency: awq.Currency,
            CustomerEmail: customerEmail,
            CustomerName: customerName,
            Description: $"Payment for Additional Work {awq.QuotationNumber}"
        ), cancellationToken);

        var payment = new Payment(
            paymentNumber: paymentNumber,
            customerId: resolvedCustomerId,
            garageId: awq.GarageId,
            amount: authoritativeAmount,
            currency: awq.Currency,
            purpose: PaymentPurpose.AdditionalWork,
            gatewayProvider: gateway.ProviderName,
            additionalWorkQuotationId: awq.Id,
            serviceJobId: awq.ServiceJobId,
            idempotencyKey: request.IdempotencyKey
        );

        payment.SetGatewayOrder(orderResult.OrderId, gateway.ProviderName);

        _context.Payments.Add(payment);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: "ADDITIONAL_WORK_QUOTATION_CREATED",
            userId: resolvedCustomerUserId,
            entityName: nameof(Payment),
            entityId: payment.Id.ToString(),
            details: $"Initiated payment {payment.PaymentNumber} for additional work {awq.QuotationNumber}. Amount: {payment.Amount} {payment.Currency}",
            cancellationToken: cancellationToken
        );

        await _notificationService.SendInAppNotificationAsync(
            userId: resolvedCustomerUserId,
            title: "Additional Work Payment Initiated",
            message: $"Payment {payment.PaymentNumber} of {payment.Amount} {payment.Currency} initiated for additional work.",
            type: "PAYMENT_CREATED",
            referenceId: payment.Id,
            referenceType: nameof(Payment),
            cancellationToken: cancellationToken
        );

        return new InitiatePaymentResponseDto(
            PaymentId: payment.Id,
            PaymentNumber: payment.PaymentNumber,
            Amount: payment.Amount,
            Currency: payment.Currency,
            GatewayProvider: payment.GatewayProvider,
            GatewayOrderId: payment.GatewayOrderId,
            CheckoutUrl: orderResult.CheckoutUrl,
            ProviderData: orderResult.ProviderData
        );
    }

    public async Task<PaymentDto> VerifyAndCompletePaymentAsync(
        VerifyPaymentRequestDto request,
        Guid customerId,
        CancellationToken cancellationToken = default)
    {
        var payment = await _context.Payments
            .Include(p => p.CustomerQuotation)
            .Include(p => p.AdditionalWorkQuotation)
            .FirstOrDefaultAsync(p => p.Id == request.PaymentId, cancellationToken);

        if (payment == null)
            throw new KeyNotFoundException($"Payment with ID {request.PaymentId} not found.");

        var resolvedCustomerId = await ResolveCustomerIdAsync(customerId, cancellationToken);
        var resolvedCustomerUserId = await ResolveCustomerUserIdAsync(customerId, cancellationToken);

        if (payment.CustomerId != resolvedCustomerId && payment.CustomerId != resolvedCustomerUserId)
            throw new UnauthorizedAccessException("You are not authorized to verify this payment.");

        // Idempotent return if already paid
        if (payment.Status == PaymentStatus.Paid)
        {
            _logger.LogInformation("Payment {PaymentNumber} is already marked as Paid. Returning existing record.", payment.PaymentNumber);
            return MapToDto(payment);
        }

        // Gateway verification
        var gateway = _gatewayFactory.GetGateway(payment.GatewayProvider);
        var orderId = request.GatewayOrderId ?? payment.GatewayOrderId ?? string.Empty;

        var verifyResult = await gateway.VerifyPaymentAsync(new VerifyPaymentParams(
            GatewayOrderId: orderId,
            GatewayPaymentId: request.GatewayPaymentId,
            GatewaySignature: request.GatewaySignature,
            ExpectedAmount: payment.Amount,
            ExpectedCurrency: payment.Currency
        ), cancellationToken);

        if (!verifyResult.IsSuccess)
        {
            payment.MarkFailed(verifyResult.ErrorMessage ?? "Payment verification failed.");
            await _context.SaveChangesAsync(cancellationToken);

            await _auditService.LogAsync(
                action: "PAYMENT_FAILED",
                userId: resolvedCustomerUserId,
                entityName: nameof(Payment),
                entityId: payment.Id.ToString(),
                details: $"Payment verification failed for {payment.PaymentNumber}: {verifyResult.ErrorMessage}",
                cancellationToken: cancellationToken
            );

            throw new InvalidOperationException($"Payment verification failed: {verifyResult.ErrorMessage}");
        }

        // Mark Paid
        payment.MarkPaid(request.GatewayPaymentId, request.GatewaySignature, DateTime.UtcNow);

        // Accept Additional Work Quotation if applicable
        if (payment.AdditionalWorkQuotation != null && payment.AdditionalWorkQuotation.Status != CustomerQuotationStatus.Accepted)
        {
            payment.AdditionalWorkQuotation.Accept();
        }

        await _context.SaveChangesAsync(cancellationToken);

        // 1. Generate Tax Invoice
        await _invoiceService.GenerateInvoiceForPaymentAsync(payment.Id, cancellationToken);

        // 2. Create Workshop Settlement
        await _settlementService.CreateSettlementForPaymentAsync(payment.Id, cancellationToken);

        // 3. Record Escrow & Customer Ledger entries
        await _ledgerService.RecordPaymentEntriesAsync(payment, cancellationToken);

        // 4. Audit Log
        await _auditService.LogAsync(
            action: "PAYMENT_PAID",
            userId: resolvedCustomerUserId,
            entityName: nameof(Payment),
            entityId: payment.Id.ToString(),
            details: $"Payment {payment.PaymentNumber} successfully paid. Amount: {payment.Amount} {payment.Currency}. Gateway Ref: {payment.GatewayPaymentId}",
            cancellationToken: cancellationToken
        );

        // 5. Notifications
        await _notificationService.SendInAppNotificationAsync(
            userId: resolvedCustomerUserId,
            title: "Payment Received",
            message: $"We received your payment {payment.PaymentNumber} for {payment.Amount} {payment.Currency}. Your tax invoice is ready.",
            type: "PAYMENT_RECEIVED",
            referenceId: payment.Id,
            referenceType: nameof(Payment),
            cancellationToken: cancellationToken
        );

        // Notify Garage
        var garageUser = await _context.GarageUsers
            .AsNoTracking()
            .FirstOrDefaultAsync(gu => gu.GarageId == payment.GarageId, cancellationToken);

        if (garageUser != null)
        {
            await _notificationService.SendInAppNotificationAsync(
                userId: garageUser.UserId,
                title: "Customer Payment Received",
                message: $"Customer payment {payment.PaymentNumber} of {payment.Amount} {payment.Currency} has been received and confirmed in escrow.",
                type: "GARAGE_PAYMENT_CONFIRMED",
                referenceId: payment.Id,
                referenceType: nameof(Payment),
                cancellationToken: cancellationToken
            );
        }

        _logger.LogInformation("Successfully verified and finalized payment {PaymentNumber}", payment.PaymentNumber);

        return MapToDto(payment);
    }

    public async Task<bool> ProcessWebhookAsync(
        string provider,
        string payload,
        string signature,
        CancellationToken cancellationToken = default)
    {
        var gateway = _gatewayFactory.GetGateway(provider);
        var webhookResult = await gateway.HandleWebhookAsync(payload, signature, cancellationToken: cancellationToken);

        if (!webhookResult.IsHandled)
        {
            _logger.LogWarning("Webhook from provider {Provider} was not handled: {Error}", provider, webhookResult.ErrorMessage);
            return false;
        }

        // Find payment by OrderId or PaymentId
        Payment? payment = null;
        if (!string.IsNullOrWhiteSpace(webhookResult.GatewayOrderId))
        {
            payment = await _context.Payments
                .Include(p => p.CustomerQuotation)
                .Include(p => p.AdditionalWorkQuotation)
                .FirstOrDefaultAsync(p => p.GatewayOrderId == webhookResult.GatewayOrderId, cancellationToken);
        }

        if (payment == null && !string.IsNullOrWhiteSpace(webhookResult.GatewayPaymentId))
        {
            payment = await _context.Payments
                .Include(p => p.CustomerQuotation)
                .Include(p => p.AdditionalWorkQuotation)
                .FirstOrDefaultAsync(p => p.GatewayPaymentId == webhookResult.GatewayPaymentId, cancellationToken);
        }

        if (payment == null)
        {
            _logger.LogWarning("Webhook received for unknown order {OrderId} / payment {PaymentId}",
                webhookResult.GatewayOrderId, webhookResult.GatewayPaymentId);
            return false;
        }

        // Check if already paid
        if (payment.Status == PaymentStatus.Paid)
        {
            _logger.LogInformation("Webhook: Payment {PaymentNumber} is already Paid. Idempotently acknowledging.", payment.PaymentNumber);
            return true;
        }

        if (webhookResult.Status == "captured" || webhookResult.Status == "paid")
        {
            var pId = webhookResult.GatewayPaymentId ?? $"pay_whk_{Guid.NewGuid():N}";
            payment.MarkPaid(pId, signature, DateTime.UtcNow);

            if (payment.AdditionalWorkQuotation != null && payment.AdditionalWorkQuotation.Status != CustomerQuotationStatus.Accepted)
            {
                payment.AdditionalWorkQuotation.Accept();
            }

            await _context.SaveChangesAsync(cancellationToken);

            await _invoiceService.GenerateInvoiceForPaymentAsync(payment.Id, cancellationToken);
            await _settlementService.CreateSettlementForPaymentAsync(payment.Id, cancellationToken);
            await _ledgerService.RecordPaymentEntriesAsync(payment, cancellationToken);

            var customerUserId = await ResolveCustomerUserIdAsync(payment.CustomerId, cancellationToken);

            await _auditService.LogAsync(
                action: "PAYMENT_PAID",
                userId: customerUserId,
                entityName: nameof(Payment),
                entityId: payment.Id.ToString(),
                details: $"Webhook captured payment {payment.PaymentNumber}. Amount: {payment.Amount} {payment.Currency}",
                cancellationToken: cancellationToken
            );

            await _notificationService.SendInAppNotificationAsync(
                userId: customerUserId,
                title: "Payment Received",
                message: $"We received your payment {payment.PaymentNumber} for {payment.Amount} {payment.Currency}. Your tax invoice is ready.",
                type: "PAYMENT_RECEIVED",
                referenceId: payment.Id,
                referenceType: nameof(Payment),
                cancellationToken: cancellationToken
            );

            // Notify Garage
            var garageUser = await _context.GarageUsers
                .AsNoTracking()
                .FirstOrDefaultAsync(gu => gu.GarageId == payment.GarageId, cancellationToken);

            if (garageUser != null)
            {
                await _notificationService.SendInAppNotificationAsync(
                    userId: garageUser.UserId,
                    title: "Customer Payment Received",
                    message: $"Customer payment {payment.PaymentNumber} of {payment.Amount} {payment.Currency} has been received and confirmed in escrow.",
                    type: "GARAGE_PAYMENT_CONFIRMED",
                    referenceId: payment.Id,
                    referenceType: nameof(Payment),
                    cancellationToken: cancellationToken
                );
            }

            _logger.LogInformation("Webhook successfully processed payment {PaymentNumber} as Paid", payment.PaymentNumber);
        }
        else if (webhookResult.Status == "failed")
        {
            payment.MarkFailed(webhookResult.ErrorMessage ?? "Payment failed according to gateway webhook.");
            await _context.SaveChangesAsync(cancellationToken);

            var customerUserId = await ResolveCustomerUserIdAsync(payment.CustomerId, cancellationToken);

            await _auditService.LogAsync(
                action: "PAYMENT_FAILED",
                userId: customerUserId,
                entityName: nameof(Payment),
                entityId: payment.Id.ToString(),
                details: $"Webhook marked payment {payment.PaymentNumber} as Failed",
                cancellationToken: cancellationToken
            );
        }

        return true;
    }

    public async Task<PaymentDto?> GetPaymentByIdAsync(
        Guid paymentId,
        Guid requestingUserId,
        string role,
        CancellationToken cancellationToken = default)
    {
        var payment = await _context.Payments
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == paymentId, cancellationToken);

        if (payment == null) return null;

        await AssertAccessAsync(payment, requestingUserId, role, cancellationToken);
        return MapToDto(payment);
    }

    public async Task<IEnumerable<PaymentDto>> GetCustomerPaymentsAsync(
        Guid customerId,
        CancellationToken cancellationToken = default)
    {
        var profileId = await ResolveCustomerIdAsync(customerId, cancellationToken);
        var userId = await ResolveCustomerUserIdAsync(customerId, cancellationToken);

        var list = await _context.Payments
            .AsNoTracking()
            .Where(p => p.CustomerId == profileId || p.CustomerId == userId)
            .OrderByDescending(p => p.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        return list.Select(MapToDto);
    }

    public async Task<PaymentDto> ProcessRefundAsync(
        Guid paymentId,
        decimal amount,
        string reason,
        Guid adminId,
        CancellationToken cancellationToken = default)
    {
        var payment = await _context.Payments
            .FirstOrDefaultAsync(p => p.Id == paymentId, cancellationToken);

        if (payment == null)
            throw new KeyNotFoundException($"Payment with ID {paymentId} not found.");

        if (payment.Status != PaymentStatus.Paid && payment.Status != PaymentStatus.PartiallyRefunded)
            throw new InvalidOperationException($"Cannot refund payment {payment.PaymentNumber} in status '{payment.Status}'.");

        var gateway = _gatewayFactory.GetGateway(payment.GatewayProvider);
        var refundResult = await gateway.RefundPaymentAsync(new RefundPaymentParams(
            GatewayPaymentId: payment.GatewayPaymentId ?? "",
            RefundAmount: amount,
            Currency: payment.Currency,
            Reason: reason
        ), cancellationToken);

        if (!refundResult.IsSuccess)
        {
            throw new InvalidOperationException($"Gateway refund failed: {refundResult.ErrorMessage}");
        }

        payment.RecordRefund(amount, reason);

        // If fully refunded, mark invoice refunded
        if (payment.Status == PaymentStatus.Refunded)
        {
            var invoice = await _context.Invoices.FirstOrDefaultAsync(i => i.PaymentId == payment.Id, cancellationToken);
            invoice?.MarkRefunded();
        }

        await _context.SaveChangesAsync(cancellationToken);

        // Record compensating refund ledger entries
        await _ledgerService.RecordRefundEntriesAsync(payment, amount, reason, cancellationToken);

        await _auditService.LogAsync(
            action: "PAYMENT_REFUNDED",
            userId: adminId,
            entityName: nameof(Payment),
            entityId: payment.Id.ToString(),
            details: $"Refunded {amount} {payment.Currency} for payment {payment.PaymentNumber}. Refund ID: {refundResult.RefundId}. Reason: {reason}",
            cancellationToken: cancellationToken
        );

        var customerUserId = await ResolveCustomerUserIdAsync(payment.CustomerId, cancellationToken);

        await _notificationService.SendInAppNotificationAsync(
            userId: customerUserId,
            title: "Payment Refund Processed",
            message: $"A refund of {amount} {payment.Currency} for payment {payment.PaymentNumber} has been processed. Reason: {reason}",
            type: "PAYMENT_REFUNDED",
            referenceId: payment.Id,
            referenceType: nameof(Payment),
            cancellationToken: cancellationToken
        );

        return MapToDto(payment);
    }

    private async Task AssertAccessAsync(Payment payment, Guid userId, string role, CancellationToken cancellationToken)
    {
        if (role == AppRoles.SuperAdmin || role == AppRoles.Advisor)
            return;

        if (role == AppRoles.Customer)
        {
            var profileId = await ResolveCustomerIdAsync(userId, cancellationToken);
            var customerUserId = await ResolveCustomerUserIdAsync(userId, cancellationToken);
            if (payment.CustomerId == profileId || payment.CustomerId == customerUserId)
                return;
        }

        var isGarageUser = await _context.GarageUsers
            .AnyAsync(gu => gu.UserId == userId && gu.GarageId == payment.GarageId, cancellationToken);

        if (isGarageUser)
            return;

        throw new UnauthorizedAccessException("You do not have permission to access this payment.");
    }

    private static PaymentDto MapToDto(Payment p) => new(
        Id: p.Id,
        PaymentNumber: p.PaymentNumber,
        CustomerQuotationId: p.CustomerQuotationId,
        AdditionalWorkQuotationId: p.AdditionalWorkQuotationId,
        ServiceJobId: p.ServiceJobId,
        CustomerId: p.CustomerId,
        GarageId: p.GarageId,
        Amount: p.Amount,
        Currency: p.Currency,
        Status: p.Status.ToString(),
        Purpose: p.Purpose.ToString(),
        PaymentMethod: p.PaymentMethod.ToString(),
        GatewayProvider: p.GatewayProvider,
        GatewayOrderId: p.GatewayOrderId,
        GatewayPaymentId: p.GatewayPaymentId,
        RefundedAmount: p.RefundedAmount,
        PaidAtUtc: p.PaidAtUtc,
        CreatedAtUtc: p.CreatedAtUtc
    );
}
