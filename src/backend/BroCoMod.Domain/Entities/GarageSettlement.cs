using BroCoMod.Domain.Common;
using BroCoMod.Domain.Enums;

namespace BroCoMod.Domain.Entities;

/// <summary>
/// Settlement record calculating the net payout owed to a workshop after deducting platform commission.
/// </summary>
public class GarageSettlement : BaseEntity
{
    public string SettlementNumber { get; private set; } = string.Empty;
    public Guid GarageId { get; private set; }
    public Guid ServiceJobId { get; private set; }
    public Guid PaymentId { get; private set; }
    public decimal GrossAmount { get; private set; }
    public decimal PlatformFeePercentage { get; private set; }
    public decimal PlatformFeeFixed { get; private set; }
    public decimal PlatformFeeAmount { get; private set; }
    public decimal TaxOnPlatformFee { get; private set; }
    public decimal TotalPlatformFee { get; private set; }
    public decimal NetPayableToGarage { get; private set; }
    public string Currency { get; private set; } = "INR";
    public SettlementStatus Status { get; private set; } = SettlementStatus.Pending;
    public DateTime? SettledAtUtc { get; private set; }
    public string? PayoutTransactionRef { get; private set; }
    public string? ReferenceNotes { get; private set; }

    // Navigation properties
    public Garage? Garage { get; private set; }
    public ServiceJob? ServiceJob { get; private set; }
    public Payment? Payment { get; private set; }

    protected GarageSettlement() { }

    public GarageSettlement(
        string settlementNumber,
        Guid garageId,
        Guid serviceJobId,
        Guid paymentId,
        decimal grossAmount,
        decimal platformFeePercentage,
        decimal platformFeeFixed,
        string currency = "INR")
    {
        if (string.IsNullOrWhiteSpace(settlementNumber))
            throw new ArgumentException("SettlementNumber cannot be empty.", nameof(settlementNumber));
        if (garageId == Guid.Empty)
            throw new ArgumentException("GarageId cannot be empty.", nameof(garageId));
        if (serviceJobId == Guid.Empty)
            throw new ArgumentException("ServiceJobId cannot be empty.", nameof(serviceJobId));
        if (paymentId == Guid.Empty)
            throw new ArgumentException("PaymentId cannot be empty.", nameof(paymentId));
        if (grossAmount <= 0.0m)
            throw new ArgumentException("Gross amount must be positive.", nameof(grossAmount));

        SettlementNumber = settlementNumber.Trim().ToUpperInvariant();
        GarageId = garageId;
        ServiceJobId = serviceJobId;
        PaymentId = paymentId;
        GrossAmount = grossAmount;
        PlatformFeePercentage = Math.Max(0m, platformFeePercentage);
        PlatformFeeFixed = Math.Max(0m, platformFeeFixed);
        Currency = string.IsNullOrWhiteSpace(currency) ? "INR" : currency.Trim().ToUpperInvariant();

        // Calculate fee snapshot
        var percentageFee = Math.Round(GrossAmount * (PlatformFeePercentage / 100m), 2, MidpointRounding.AwayFromZero);
        PlatformFeeAmount = percentageFee + PlatformFeeFixed;
        TaxOnPlatformFee = 0m; // legacy column; no tax is charged on the fee
        TotalPlatformFee = PlatformFeeAmount;
        NetPayableToGarage = Math.Max(0m, GrossAmount - TotalPlatformFee);
        Status = SettlementStatus.Pending;
    }

    public void MarkProcessing()
    {
        if (Status != SettlementStatus.Pending && Status != SettlementStatus.OnHold)
            throw new InvalidOperationException($"Cannot transition settlement from {Status} to Processing.");

        Status = SettlementStatus.Processing;
    }

    public void MarkCompleted(string transactionRef, string? notes = null)
    {
        if (Status == SettlementStatus.Completed)
            return;

        if (string.IsNullOrWhiteSpace(transactionRef))
            throw new ArgumentException("Payout transaction reference is required.", nameof(transactionRef));

        Status = SettlementStatus.Completed;
        PayoutTransactionRef = transactionRef.Trim();
        ReferenceNotes = notes?.Trim();
        SettledAtUtc = DateTime.UtcNow;
    }

    public void MarkOnHold(string reason)
    {
        if (Status == SettlementStatus.Completed)
            throw new InvalidOperationException("Cannot place a completed settlement on hold.");

        Status = SettlementStatus.OnHold;
        ReferenceNotes = reason?.Trim();
    }

    public void MarkCancelled(string reason)
    {
        if (Status == SettlementStatus.Completed)
            throw new InvalidOperationException("Cannot cancel a completed settlement.");

        Status = SettlementStatus.Cancelled;
        ReferenceNotes = reason?.Trim();
    }
}
