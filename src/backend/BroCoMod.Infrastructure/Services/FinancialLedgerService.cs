using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Enums;
using BroCoMod.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BroCoMod.Infrastructure.Services;

/// <summary>
/// Double-entry style append-only compensating ledger service.
/// Records every debit and credit movement across escrow, customer, platform revenue, and workshop accounts.
/// </summary>
public class FinancialLedgerService : IFinancialLedgerService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<FinancialLedgerService> _logger;

    public FinancialLedgerService(
        ApplicationDbContext context,
        ILogger<FinancialLedgerService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task RecordPaymentEntriesAsync(
        Payment payment,
        CancellationToken cancellationToken = default)
    {
        var txRef = $"TXN-{payment.PaymentNumber}";

        // Check if already recorded (idempotent)
        var exists = await _context.FinancialLedgerEntries
            .AnyAsync(l => l.PaymentId == payment.Id && l.EntryType == LedgerEntryType.CustomerPayment, cancellationToken);

        if (exists)
        {
            _logger.LogInformation("Ledger entries for payment {PaymentNumber} already exist.", payment.PaymentNumber);
            return;
        }

        // 1. Debit Escrow account (Asset increases)
        var escrowEntry = new FinancialLedgerEntry(
            transactionReference: txRef,
            entryType: LedgerEntryType.CustomerPayment,
            debitAmount: payment.Amount,
            creditAmount: 0.0m,
            accountType: "ESCROW",
            description: $"Funds held in escrow for payment {payment.PaymentNumber}",
            currency: payment.Currency,
            paymentId: payment.Id
        );

        // 2. Credit Customer account (Liability / customer payment source)
        var customerEntry = new FinancialLedgerEntry(
            transactionReference: txRef,
            entryType: LedgerEntryType.CustomerPayment,
            debitAmount: 0.0m,
            creditAmount: payment.Amount,
            accountType: "CUSTOMER",
            description: $"Customer payment {payment.PaymentNumber} received",
            currency: payment.Currency,
            accountId: payment.CustomerId,
            paymentId: payment.Id
        );

        _context.FinancialLedgerEntries.AddRange(escrowEntry, customerEntry);
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Recorded payment ledger entries for {PaymentNumber}. Debit Escrow: {Amount}, Credit Customer: {Amount}",
            payment.PaymentNumber, payment.Amount, payment.Amount);
    }

    public async Task RecordSettlementEntriesAsync(
        GarageSettlement settlement,
        CancellationToken cancellationToken = default)
    {
        var txRef = $"TXN-{settlement.SettlementNumber}";

        var exists = await _context.FinancialLedgerEntries
            .AnyAsync(l => l.SettlementId == settlement.Id, cancellationToken);

        if (exists) return;

        var entries = new List<FinancialLedgerEntry>();

        // 1. Garage Net Payable Allocation
        // Escrow -> Garage Payable
        entries.Add(new FinancialLedgerEntry(
            transactionReference: txRef,
            entryType: LedgerEntryType.GaragePayable,
            debitAmount: settlement.NetPayableToGarage,
            creditAmount: 0.0m,
            accountType: "GARAGE_PAYABLE",
            description: $"Workshop earnings allocated for job under settlement {settlement.SettlementNumber}",
            currency: settlement.Currency,
            accountId: settlement.GarageId,
            paymentId: settlement.PaymentId,
            settlementId: settlement.Id
        ));

        // 2. Platform Revenue
        entries.Add(new FinancialLedgerEntry(
            transactionReference: txRef,
            entryType: LedgerEntryType.PlatformFee,
            debitAmount: settlement.PlatformFeeAmount,
            creditAmount: 0.0m,
            accountType: "PLATFORM_REVENUE",
            description: $"Platform commission for settlement {settlement.SettlementNumber}",
            currency: settlement.Currency,
            paymentId: settlement.PaymentId,
            settlementId: settlement.Id
        ));

        // 3. Platform Tax Liability (GST)
        if (settlement.TaxOnPlatformFee > 0.0m)
        {
            entries.Add(new FinancialLedgerEntry(
                transactionReference: txRef,
                entryType: LedgerEntryType.PlatformFee,
                debitAmount: settlement.TaxOnPlatformFee,
                creditAmount: 0.0m,
                accountType: "PLATFORM_TAX_LIABILITY",
                description: $"GST on commission for settlement {settlement.SettlementNumber}",
                currency: settlement.Currency,
                paymentId: settlement.PaymentId,
                settlementId: settlement.Id
            ));
        }

        // 4. Balancing Escrow Credit (Gross payout from Escrow)
        entries.Add(new FinancialLedgerEntry(
            transactionReference: txRef,
            entryType: LedgerEntryType.GaragePayable,
            debitAmount: 0.0m,
            creditAmount: settlement.GrossAmount,
            accountType: "ESCROW",
            description: $"Escrow funds released for settlement {settlement.SettlementNumber}",
            currency: settlement.Currency,
            accountId: settlement.GarageId,
            paymentId: settlement.PaymentId,
            settlementId: settlement.Id
        ));

        _context.FinancialLedgerEntries.AddRange(entries);
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Recorded settlement ledger entries for {SettlementNumber}. Gross: {Gross}, Net Payable: {Net}, Platform Total Fee: {Fee}",
            settlement.SettlementNumber, settlement.GrossAmount, settlement.NetPayableToGarage, settlement.TotalPlatformFee);
    }

    public async Task RecordRefundEntriesAsync(
        Payment payment,
        decimal refundAmount,
        string reason,
        CancellationToken cancellationToken = default)
    {
        var txRef = $"TXN-REFUND-{payment.PaymentNumber}-{Guid.NewGuid():N}";

        // Compensating entries:
        // 1. Debit Customer (Refund payout to customer)
        var debitCustomer = new FinancialLedgerEntry(
            transactionReference: txRef,
            entryType: LedgerEntryType.Refund,
            debitAmount: refundAmount,
            creditAmount: 0.0m,
            accountType: "CUSTOMER",
            description: $"Refund disbursed to customer: {reason}",
            currency: payment.Currency,
            accountId: payment.CustomerId,
            paymentId: payment.Id
        );

        // 2. Credit Escrow (Funds leaves escrow)
        var creditEscrow = new FinancialLedgerEntry(
            transactionReference: txRef,
            entryType: LedgerEntryType.Refund,
            debitAmount: 0.0m,
            creditAmount: refundAmount,
            accountType: "ESCROW",
            description: $"Escrow funds reduced due to refund: {reason}",
            currency: payment.Currency,
            paymentId: payment.Id
        );

        _context.FinancialLedgerEntries.AddRange(debitCustomer, creditEscrow);
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Recorded refund ledger entries for payment {PaymentNumber}, amount {Amount}. Reason: {Reason}",
            payment.PaymentNumber, refundAmount, reason);
    }

    public async Task<IEnumerable<FinancialLedgerEntryDto>> GetLedgerEntriesAsync(
        Guid? accountId = null,
        string? accountType = null,
        CancellationToken cancellationToken = default)
    {
        var query = _context.FinancialLedgerEntries.AsNoTracking().AsQueryable();

        if (accountId.HasValue)
        {
            query = query.Where(l => l.AccountId == accountId.Value);
        }

        if (!string.IsNullOrWhiteSpace(accountType))
        {
            var acc = accountType.Trim().ToUpperInvariant();
            query = query.Where(l => l.AccountType == acc);
        }

        var list = await query
            .OrderByDescending(l => l.CreatedAtUtc)
            .Take(200)
            .ToListAsync(cancellationToken);

        return list.Select(l => new FinancialLedgerEntryDto(
            Id: l.Id,
            TransactionReference: l.TransactionReference,
            EntryType: l.EntryType.ToString(),
            DebitAmount: l.DebitAmount,
            CreditAmount: l.CreditAmount,
            Currency: l.Currency,
            AccountType: l.AccountType,
            AccountId: l.AccountId,
            PaymentId: l.PaymentId,
            InvoiceId: l.InvoiceId,
            SettlementId: l.SettlementId,
            Description: l.Description,
            CreatedAtUtc: l.CreatedAtUtc
        ));
    }
}
