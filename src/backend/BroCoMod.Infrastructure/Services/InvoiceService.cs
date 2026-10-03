using System.Text.Json;
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
/// Server-authoritative invoice generation and management service.
/// Ensures invoices are strictly derived from verified payments and accepted quotes.
/// </summary>
public class InvoiceService : IInvoiceService
{
    private readonly ApplicationDbContext _context;
    private readonly IInvoiceNumberGenerator _numberGenerator;
    private readonly IAuditService _auditService;
    private readonly INotificationService _notificationService;
    private readonly ILogger<InvoiceService> _logger;

    public InvoiceService(
        ApplicationDbContext context,
        IInvoiceNumberGenerator numberGenerator,
        IAuditService auditService,
        INotificationService notificationService,
        ILogger<InvoiceService> logger)
    {
        _context = context;
        _numberGenerator = numberGenerator;
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

    public async Task<InvoiceDto> GenerateInvoiceForPaymentAsync(
        Guid paymentId,
        CancellationToken cancellationToken = default)
    {
        // 1. Check existing invoice for idempotency
        var existing = await _context.Invoices
            .AsNoTracking()
            .FirstOrDefaultAsync(i => i.PaymentId == paymentId, cancellationToken);

        if (existing != null)
        {
            return MapToDto(existing);
        }

        // 2. Load payment with relations
        var payment = await _context.Payments
            .Include(p => p.CustomerQuotation)
                .ThenInclude(q => q!.LineItems)
            .Include(p => p.AdditionalWorkQuotation)
            .Include(p => p.ServiceJob)
            .FirstOrDefaultAsync(p => p.Id == paymentId, cancellationToken);

        if (payment == null)
            throw new KeyNotFoundException($"Payment with ID {paymentId} not found.");

        if (payment.Status != PaymentStatus.Paid)
            throw new InvalidOperationException($"Cannot generate invoice for payment {payment.PaymentNumber} because its status is '{payment.Status}', not 'Paid'.");

        // 3. Resolve customer details
        var customerUserId = await ResolveCustomerUserIdAsync(payment.CustomerId, cancellationToken);
        var customer = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == customerUserId, cancellationToken);
        var customerName = customer?.FullName ?? "Valued Customer";
        var customerEmail = customer?.Email ?? "customer@example.com";
        var customerPhone = customer?.PhoneNumber;

        // 4. Calculate items & financials
        decimal subtotal = 0m;
        decimal discount = 0m;
        decimal tax = 0m;
        decimal total = payment.Amount;
        var lineItemList = new List<object>();

        if (payment.CustomerQuotation != null)
        {
            var quote = payment.CustomerQuotation;
            subtotal = quote.CustomerSubtotal;
            discount = quote.CustomerDiscount;
            tax = quote.CustomerTax;

            foreach (var item in quote.LineItems)
            {
                lineItemList.Add(new
                {
                    description = item.Description,
                    itemType = item.LineType.ToString(),
                    quantity = item.Quantity,
                    unitPrice = item.UnitPrice,
                    totalPrice = item.LineTotal
                });
            }
        }
        else if (payment.AdditionalWorkQuotation != null)
        {
            var awq = payment.AdditionalWorkQuotation;
            subtotal = awq.Subtotal;
            tax = awq.Tax;
            discount = 0m;

            lineItemList.Add(new
            {
                description = awq.Description,
                itemType = "AdditionalWork",
                quantity = 1,
                unitPrice = awq.Subtotal,
                totalPrice = awq.Subtotal
            });
        }
        else
        {
            subtotal = total;
            lineItemList.Add(new
            {
                description = $"Automotive Service Payment ({payment.PaymentNumber})",
                itemType = "Service",
                quantity = 1,
                unitPrice = total,
                totalPrice = total
            });
        }

        var lineItemsJson = JsonSerializer.Serialize(lineItemList);
        var invoiceNumber = await _numberGenerator.NextInvoiceNumberAsync(cancellationToken);

        var invoice = new Invoice(
            invoiceNumber: invoiceNumber,
            paymentId: payment.Id,
            customerId: payment.CustomerId,
            garageId: payment.GarageId,
            subtotal: subtotal,
            discountAmount: discount,
            taxAmount: tax,
            totalAmount: total,
            billingName: customerName,
            billingEmail: customerEmail,
            billingAddress: customerPhone != null ? $"Phone: {customerPhone}" : null,
            lineItemsJson: lineItemsJson,
            currency: payment.Currency,
            customerQuotationId: payment.CustomerQuotationId,
            additionalWorkQuotationId: payment.AdditionalWorkQuotationId,
            serviceJobId: payment.ServiceJobId
        );

        invoice.MarkPaid(payment.PaidAtUtc ?? DateTime.UtcNow);

        _context.Invoices.Add(invoice);
        await _context.SaveChangesAsync(cancellationToken);

        // Audit & Notification
        await _auditService.LogAsync(
            action: "INVOICE_ISSUED",
            userId: customerUserId,
            entityName: nameof(Invoice),
            entityId: invoice.Id.ToString(),
            details: $"Generated invoice {invoice.InvoiceNumber} for payment {payment.PaymentNumber}, total {invoice.TotalAmount} {invoice.Currency}",
            cancellationToken: cancellationToken
        );

        await _notificationService.SendInAppNotificationAsync(
            userId: customerUserId,
            title: "Tax Invoice Issued",
            message: $"Your tax invoice {invoice.InvoiceNumber} for payment {payment.PaymentNumber} ({invoice.TotalAmount} {invoice.Currency}) is available.",
            type: "INVOICE_ISSUED",
            referenceId: invoice.Id,
            referenceType: nameof(Invoice),
            cancellationToken: cancellationToken
        );

        _logger.LogInformation("Successfully generated invoice {InvoiceNumber} for payment {PaymentNumber}",
            invoice.InvoiceNumber, payment.PaymentNumber);

        return MapToDto(invoice);
    }

    public async Task<InvoiceDto?> GetInvoiceByIdAsync(
        Guid invoiceId,
        Guid requestingUserId,
        string role,
        CancellationToken cancellationToken = default)
    {
        var invoice = await _context.Invoices
            .AsNoTracking()
            .FirstOrDefaultAsync(i => i.Id == invoiceId, cancellationToken);

        if (invoice == null) return null;

        await AssertAccessAsync(invoice, requestingUserId, role, cancellationToken);
        return MapToDto(invoice);
    }

    public async Task<InvoiceDto?> GetInvoiceByPaymentIdAsync(
        Guid paymentId,
        Guid requestingUserId,
        string role,
        CancellationToken cancellationToken = default)
    {
        var invoice = await _context.Invoices
            .AsNoTracking()
            .FirstOrDefaultAsync(i => i.PaymentId == paymentId, cancellationToken);

        if (invoice == null) return null;

        await AssertAccessAsync(invoice, requestingUserId, role, cancellationToken);
        return MapToDto(invoice);
    }

    public async Task<IEnumerable<InvoiceDto>> GetCustomerInvoicesAsync(
        Guid customerId,
        CancellationToken cancellationToken = default)
    {
        var profileId = await ResolveCustomerIdAsync(customerId, cancellationToken);
        var userId = await ResolveCustomerUserIdAsync(customerId, cancellationToken);

        var list = await _context.Invoices
            .AsNoTracking()
            .Where(i => i.CustomerId == profileId || i.CustomerId == userId)
            .OrderByDescending(i => i.IssuedAtUtc)
            .ToListAsync(cancellationToken);

        return list.Select(MapToDto);
    }

    public async Task<InvoiceDto> VoidInvoiceAsync(
        Guid invoiceId,
        string reason,
        Guid adminId,
        CancellationToken cancellationToken = default)
    {
        var invoice = await _context.Invoices
            .FirstOrDefaultAsync(i => i.Id == invoiceId, cancellationToken);

        if (invoice == null)
            throw new KeyNotFoundException($"Invoice with ID {invoiceId} not found.");

        invoice.MarkVoid(reason);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: "INVOICE_VOIDED",
            userId: adminId,
            entityName: nameof(Invoice),
            entityId: invoice.Id.ToString(),
            details: $"Invoice {invoice.InvoiceNumber} voided. Reason: {reason}",
            cancellationToken: cancellationToken
        );

        return MapToDto(invoice);
    }

    private async Task AssertAccessAsync(Invoice invoice, Guid userId, string role, CancellationToken cancellationToken)
    {
        if (role == AppRoles.SuperAdmin || role == AppRoles.Advisor)
            return;

        if (role == AppRoles.Customer)
        {
            var profileId = await ResolveCustomerIdAsync(userId, cancellationToken);
            var customerUserId = await ResolveCustomerUserIdAsync(userId, cancellationToken);
            if (invoice.CustomerId == profileId || invoice.CustomerId == customerUserId)
                return;
        }

        // Garage user check
        var isGarageUser = await _context.GarageUsers
            .AnyAsync(gu => gu.UserId == userId && gu.GarageId == invoice.GarageId, cancellationToken);

        if (isGarageUser)
            return;

        throw new UnauthorizedAccessException("You do not have permission to access this invoice.");
    }

    private static InvoiceDto MapToDto(Invoice i) => new(
        Id: i.Id,
        InvoiceNumber: i.InvoiceNumber,
        PaymentId: i.PaymentId,
        CustomerQuotationId: i.CustomerQuotationId,
        AdditionalWorkQuotationId: i.AdditionalWorkQuotationId,
        ServiceJobId: i.ServiceJobId,
        CustomerId: i.CustomerId,
        GarageId: i.GarageId,
        Status: i.Status.ToString(),
        Subtotal: i.Subtotal,
        DiscountAmount: i.DiscountAmount,
        TaxAmount: i.TaxAmount,
        TotalAmount: i.TotalAmount,
        Currency: i.Currency,
        BillingName: i.BillingName,
        BillingEmail: i.BillingEmail,
        BillingAddress: i.BillingAddress,
        LineItemsJson: i.LineItemsJson,
        IssuedAtUtc: i.IssuedAtUtc,
        PaidAtUtc: i.PaidAtUtc,
        VoidedAtUtc: i.VoidedAtUtc,
        VoidReason: i.VoidReason
    );
}
