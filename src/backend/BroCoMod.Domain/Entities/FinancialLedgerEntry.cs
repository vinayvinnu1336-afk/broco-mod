using BroCoMod.Domain.Common;
using BroCoMod.Domain.Enums;

namespace BroCoMod.Domain.Entities;

/// <summary>
/// Immutable, append-only financial ledger entry recording double-entry style accounting movements.
/// </summary>
public class FinancialLedgerEntry : BaseEntity
{
    public string TransactionReference { get; private set; } = string.Empty;
    public LedgerEntryType EntryType { get; private set; }
    public decimal DebitAmount { get; private set; }
    public decimal CreditAmount { get; private set; }
    public string Currency { get; private set; } = "INR";
    public string AccountType { get; private set; } = string.Empty; // e.g. ESCROW, PLATFORM_FEE, GARAGE_PAYABLE, CUSTOMER
    public Guid? AccountId { get; private set; }
    public Guid? PaymentId { get; private set; }
    public Guid? InvoiceId { get; private set; }
    public Guid? SettlementId { get; private set; }
    public string Description { get; private set; } = string.Empty;

    // Navigation properties
    public Payment? Payment { get; private set; }
    public Invoice? Invoice { get; private set; }
    public GarageSettlement? Settlement { get; private set; }

    protected FinancialLedgerEntry() { }

    public FinancialLedgerEntry(
        string transactionReference,
        LedgerEntryType entryType,
        decimal debitAmount,
        decimal creditAmount,
        string accountType,
        string description,
        string currency = "INR",
        Guid? accountId = null,
        Guid? paymentId = null,
        Guid? invoiceId = null,
        Guid? settlementId = null)
    {
        if (string.IsNullOrWhiteSpace(transactionReference))
            throw new ArgumentException("TransactionReference cannot be empty.", nameof(transactionReference));
        if (string.IsNullOrWhiteSpace(accountType))
            throw new ArgumentException("AccountType cannot be empty.", nameof(accountType));

        TransactionReference = transactionReference.Trim();
        EntryType = entryType;
        DebitAmount = Math.Max(0m, debitAmount);
        CreditAmount = Math.Max(0m, creditAmount);
        AccountType = accountType.Trim().ToUpperInvariant();
        Description = description?.Trim() ?? string.Empty;
        Currency = string.IsNullOrWhiteSpace(currency) ? "INR" : currency.Trim().ToUpperInvariant();
        AccountId = accountId;
        PaymentId = paymentId;
        InvoiceId = invoiceId;
        SettlementId = settlementId;
    }
}
