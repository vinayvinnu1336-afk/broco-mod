using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Constants;
using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Enums;
using BroCoMod.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
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
    private readonly ICommissionService _commissionService;
    private readonly decimal _advancePercentage;

    public PaymentService(
        ApplicationDbContext context,
        IPaymentGatewayFactory gatewayFactory,
        IPaymentNumberGenerator numberGenerator,
        IInvoiceService invoiceService,
        ISettlementService settlementService,
        IFinancialLedgerService ledgerService,
        IAuditService auditService,
        INotificationService notificationService,
        ILogger<PaymentService> logger,
        ICommissionService commissionService,
        IConfiguration configuration)
    {
        _commissionService = commissionService;
        _advancePercentage = BookingAdvance.Percentage(configuration);
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

        // Quote-based services are paid only after the customer accepts the quotation (never at "Sent").
        if (quotation.Status != CustomerQuotationStatus.Accepted)
            throw new InvalidOperationException(quotation.Status switch
            {
                CustomerQuotationStatus.Sent => "Accept the quote first. You pay the booking advance only after accepting it.",
                CustomerQuotationStatus.Draft or CustomerQuotationStatus.ReadyToSend => "This quote hasn't been sent to you yet, so it can't be paid.",
                _ => $"This quote is {quotation.Status.ToString().ToLowerInvariant()}, so it can't be paid. Only an accepted quote can be paid."
            });

        // 3. Server-authoritative payable calculation (strictly calculated on server)
        // BroCo collects only the booking advance online; the customer pays the rest at the garage.
        if (quotation.ServiceRequest.IsAdvancePaid)
            throw new InvalidOperationException("The booking advance for this request is already paid.");
        decimal authoritativeAmount = BookingAdvance.Amount(quotation.CustomerTotal, _advancePercentage);
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
            CustomerPhone: customer?.PhoneNumber,
            Description: $"Booking advance for quotation {quotation.QuotationNumber}"
        ), cancellationToken);

        // 6. Create Payment entity
        var payment = new Payment(
            paymentNumber: paymentNumber,
            customerId: resolvedCustomerId,
            garageId: quotation.AssignedGarageId,
            amount: authoritativeAmount,
            currency: quotation.Currency,
            purpose: PaymentPurpose.BookingAdvance,
            gatewayProvider: gateway.ProviderName,
            customerQuotationId: quotation.Id,
            serviceJobId: quotation.ServiceJob?.Id,
            idempotencyKey: request.IdempotencyKey,
            serviceRequestId: quotation.ServiceRequestId
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

        // Paying approves the extra work, so only an open (or already approved) one can be paid.
        if (awq.Status is CustomerQuotationStatus.Rejected or CustomerQuotationStatus.Expired or CustomerQuotationStatus.Cancelled or CustomerQuotationStatus.Draft)
            throw new InvalidOperationException($"This additional work quote is {awq.Status.ToString().ToLowerInvariant()}, so it can't be paid.");

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
            CustomerPhone: customer?.PhoneNumber,
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

        await FinalizePaidPaymentAsync(payment, resolvedCustomerUserId, "checkout", cancellationToken);

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

            var webhookActorId = await ResolveCustomerUserIdAsync(payment.CustomerId, cancellationToken);
            await FinalizePaidPaymentAsync(payment, webhookActorId, "webhook", cancellationToken);

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
        else if (webhookResult.Status == "attempt_failed")
        {
            // One attempt failed but the gateway order is still open (Razorpay lets the customer retry in
            // the same checkout), so the payment stays pending until it is paid or a new one is started.
            _logger.LogInformation("Webhook: an attempt to pay {PaymentNumber} failed: {Reason}", payment.PaymentNumber, webhookResult.ErrorMessage);
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

        // Refunding would leave the commission marked Paid and BroCo's income overstated.
        if (payment.Purpose == PaymentPurpose.GarageCommission)
            throw new InvalidOperationException($"Payment {payment.PaymentNumber} is a garage commission payment and can't be refunded. Waive or adjust the commission instead.");

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

    /// <summary>
    /// Booking advance for a fixed-price package request, paid right after booking (before a garage is chosen).
    /// </summary>
    public async Task<InitiatePaymentResponseDto> InitiateRequestAdvanceAsync(
        Guid serviceRequestId,
        Guid customerId,
        string? idempotencyKey,
        CancellationToken cancellationToken = default)
    {
        var resolvedCustomerId = await ResolveCustomerIdAsync(customerId, cancellationToken);
        var resolvedCustomerUserId = await ResolveCustomerUserIdAsync(customerId, cancellationToken);

        var request = await _context.ServiceRequests
            .FirstOrDefaultAsync(r => r.Id == serviceRequestId, cancellationToken)
            ?? throw new KeyNotFoundException("Service request not found.");
        if (request.CustomerId != resolvedCustomerId && request.CustomerId != resolvedCustomerUserId)
            throw new UnauthorizedAccessException("You are not authorized to pay for this request.");
        if (!request.IsPackageBooking || request.PackagePrice is not > 0)
            throw new InvalidOperationException("This request has no fixed price yet. You'll pay the advance after accepting the quote.");
        if (request.Status == ServiceRequestStatus.Cancelled)
            throw new InvalidOperationException("This request was cancelled.");
        if (request.IsAdvancePaid)
            throw new InvalidOperationException("The booking advance for this request is already paid.");

        // Re-use an open checkout for the same request instead of creating duplicates.
        var open = await _context.Payments
            .Where(p => p.ServiceRequestId == request.Id && p.Purpose == PaymentPurpose.BookingAdvance &&
                        (p.Status == PaymentStatus.Created || p.Status == PaymentStatus.Pending))
            .OrderByDescending(p => p.CreatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);
        var amount = BookingAdvance.Amount(request.PackagePrice.Value, _advancePercentage);
        var gateway = _gatewayFactory.GetGateway();

        if (open != null && open.Amount == amount && open.GatewayProvider == gateway.ProviderName && open.GatewayOrderId != null)
        {
            return new InitiatePaymentResponseDto(open.Id, open.PaymentNumber, open.Amount, open.Currency, open.GatewayProvider,
                open.GatewayOrderId, $"/customer/payments/checkout?orderId={open.GatewayOrderId}&paymentNumber={open.PaymentNumber}",
                new Dictionary<string, string> { ["order_id"] = open.GatewayOrderId, ["amount"] = ((long)(open.Amount * 100m)).ToString(), ["currency"] = open.Currency });
        }

        var customer = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == resolvedCustomerUserId, cancellationToken);
        var paymentNumber = await _numberGenerator.NextPaymentNumberAsync(cancellationToken);
        var order = await gateway.CreatePaymentOrderAsync(new CreatePaymentOrderParams(
            PaymentNumber: paymentNumber,
            Amount: amount,
            Currency: "INR",
            CustomerEmail: customer?.Email ?? "customer@example.com",
            CustomerName: customer?.FullName ?? "Customer",
            CustomerPhone: customer?.PhoneNumber,
            Description: $"Booking advance for {request.ServicePackageName} ({request.RequestNumber})"), cancellationToken);

        var assignedGarageId = await _context.GarageAssignments.AsNoTracking()
            .Where(a => a.ServiceRequestId == request.Id && (a.Status == GarageAssignmentStatus.Assigned || a.Status == GarageAssignmentStatus.Confirmed))
            .Select(a => (Guid?)a.GarageId)
            .FirstOrDefaultAsync(cancellationToken);

        var payment = new Payment(
            paymentNumber: paymentNumber,
            customerId: request.CustomerId,
            garageId: assignedGarageId,
            amount: amount,
            currency: "INR",
            purpose: PaymentPurpose.BookingAdvance,
            gatewayProvider: gateway.ProviderName,
            idempotencyKey: string.IsNullOrWhiteSpace(idempotencyKey) ? null : idempotencyKey,
            serviceRequestId: request.Id);
        payment.SetGatewayOrder(order.OrderId, gateway.ProviderName);
        _context.Payments.Add(payment);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: "PAYMENT_CREATED",
            userId: resolvedCustomerUserId,
            entityName: nameof(Payment),
            entityId: payment.Id.ToString(),
            details: $"Booking advance {payment.PaymentNumber} of ₹{payment.Amount:N2} started for {request.RequestNumber}.",
            cancellationToken: cancellationToken);

        return new InitiatePaymentResponseDto(payment.Id, payment.PaymentNumber, payment.Amount, payment.Currency,
            payment.GatewayProvider, payment.GatewayOrderId, order.CheckoutUrl, order.ProviderData);
    }

    /// <summary>
    /// Everything that follows a confirmed payment, by purpose: booking advances mark the request as
    /// confirmed, commission payments settle the garage's dues; legacy full payments keep the old
    /// escrow + settlement path.
    /// </summary>
    private async Task FinalizePaidPaymentAsync(Payment payment, Guid actorUserId, string source, CancellationToken cancellationToken)
    {
        switch (payment.Purpose)
        {
            case PaymentPurpose.GarageCommission:
                await _commissionService.SettleCommissionsForPaymentAsync(payment.Id, cancellationToken);
                await _notificationService.SendInAppNotificationAsync(
                    userId: actorUserId,
                    title: "Commission paid",
                    message: $"Thank you! We received ₹{payment.Amount:N2} ({payment.PaymentNumber}).",
                    type: "COMMISSION_PAID",
                    referenceId: payment.Id,
                    referenceType: nameof(Payment),
                    cancellationToken: cancellationToken);
                break;

            case PaymentPurpose.BookingAdvance:
                await RecordAdvanceAsync(payment, cancellationToken);
                await _invoiceService.GenerateInvoiceForPaymentAsync(payment.Id, cancellationToken);
                await _notificationService.SendInAppNotificationAsync(
                    userId: actorUserId,
                    title: "Booking advance received",
                    message: payment.GarageId.HasValue
                        ? $"We received your booking advance of ₹{payment.Amount:N2}. You'll pay the rest directly at the garage after the service."
                        : $"We received your booking advance of ₹{payment.Amount:N2}. BroCo is assigning a garage near you. You'll pay the rest directly at the garage after the service.",
                    type: "PAYMENT_RECEIVED",
                    referenceId: payment.Id,
                    referenceType: nameof(Payment),
                    cancellationToken: cancellationToken);
                if (!payment.GarageId.HasValue && payment.ServiceRequestId.HasValue)
                {
                    // Package booked online, no garage yet: the advisor who owns it assigns one now.
                    var packageRequest = await _context.ServiceRequests.AsNoTracking()
                        .FirstOrDefaultAsync(r => r.Id == payment.ServiceRequestId.Value, cancellationToken);
                    if (packageRequest is { IsPackageBooking: true })
                        await _notificationService.NotifyAdvisorOfPaidPackageBookingAsync(packageRequest, cancellationToken);
                }
                if (payment.GarageId.HasValue)
                {
                    var garageUserIds = await _context.GarageUsers.AsNoTracking()
                        .Where(gu => gu.GarageId == payment.GarageId.Value)
                        .Select(gu => gu.UserId)
                        .ToListAsync(cancellationToken);
                    foreach (var garageUserId in garageUserIds)
                    {
                        await _notificationService.SendInAppNotificationAsync(
                            userId: garageUserId,
                            title: "Booking confirmed",
                            message: "The customer paid the BroCo booking advance. You can receive the car now and collect the balance at handover.",
                            type: "GARAGE_PAYMENT_CONFIRMED",
                            referenceId: payment.Id,
                            referenceType: nameof(Payment),
                            cancellationToken: cancellationToken);
                    }
                }
                break;

            default:
                await _invoiceService.GenerateInvoiceForPaymentAsync(payment.Id, cancellationToken);
                await _settlementService.CreateSettlementForPaymentAsync(payment.Id, cancellationToken);
                await _ledgerService.RecordPaymentEntriesAsync(payment, cancellationToken);
                await _notificationService.SendInAppNotificationAsync(
                    userId: actorUserId,
                    title: "Payment Received",
                    message: $"We received your payment {payment.PaymentNumber} for ₹{payment.Amount:N2}. Your tax invoice is ready.",
                    type: "PAYMENT_RECEIVED",
                    referenceId: payment.Id,
                    referenceType: nameof(Payment),
                    cancellationToken: cancellationToken);
                break;
        }

        await _auditService.LogAsync(
            action: "PAYMENT_PAID",
            userId: actorUserId,
            entityName: nameof(Payment),
            entityId: payment.Id.ToString(),
            details: $"Payment {payment.PaymentNumber} ({payment.Purpose}) paid via {source}. Amount: ₹{payment.Amount:N2}. Gateway ref: {payment.GatewayPaymentId}",
            cancellationToken: cancellationToken);
    }

    private async Task RecordAdvanceAsync(Payment payment, CancellationToken cancellationToken)
    {
        var requestId = payment.ServiceRequestId;
        if (requestId == null && payment.CustomerQuotationId.HasValue)
        {
            requestId = await _context.CustomerQuotations.AsNoTracking()
                .Where(q => q.Id == payment.CustomerQuotationId.Value)
                .Select(q => (Guid?)q.ServiceRequestId)
                .FirstOrDefaultAsync(cancellationToken);
        }
        if (requestId == null) return;

        var request = await _context.ServiceRequests.FirstOrDefaultAsync(r => r.Id == requestId.Value, cancellationToken);
        request?.RecordAdvancePaid(payment.Amount, payment.Id, payment.PaidAtUtc ?? DateTime.UtcNow);

        var txRef = $"TXN-{payment.PaymentNumber}";
        if (!await _context.FinancialLedgerEntries.AnyAsync(l => l.PaymentId == payment.Id && l.EntryType == LedgerEntryType.BookingAdvance, cancellationToken))
        {
            _context.FinancialLedgerEntries.Add(new FinancialLedgerEntry(txRef, LedgerEntryType.BookingAdvance, payment.Amount, 0m,
                "PLATFORM_CASH", $"Booking advance {payment.PaymentNumber} received", payment.Currency, payment.CustomerId, payment.Id));
            _context.FinancialLedgerEntries.Add(new FinancialLedgerEntry(txRef, LedgerEntryType.BookingAdvance, 0m, payment.Amount,
                "PLATFORM_BOOKING_FEE", $"Booking advance revenue {payment.PaymentNumber}", payment.Currency, payment.CustomerId, payment.Id));
        }
        await _context.SaveChangesAsync(cancellationToken);
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
        CreatedAtUtc: p.CreatedAtUtc,
        ServiceRequestId: p.ServiceRequestId
    );
}
