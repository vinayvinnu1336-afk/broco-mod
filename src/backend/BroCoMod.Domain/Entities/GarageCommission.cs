using BroCoMod.Domain.Common;
using BroCoMod.Domain.Enums;

namespace BroCoMod.Domain.Entities;

/// <summary>
/// Commission a garage owes BroCo once a job is handed over. The customer pays the garage
/// directly for the service (minus the booking advance BroCo already collected); the garage
/// then pays BroCo its commission plus GST.
/// </summary>
public class GarageCommission : BaseEntity
{
    public string CommissionNumber { get; private set; } = string.Empty;
    public Guid GarageId { get; private set; }
    public Guid ServiceJobId { get; private set; }
    public Guid ServiceRequestId { get; private set; }
    public string Currency { get; private set; } = "INR";

    public decimal ServiceValue { get; private set; }
    public decimal AdvanceCollectedByPlatform { get; private set; }
    public decimal BalanceCollectedByGarage { get; private set; }
    public decimal CommissionPercentage { get; private set; }
    public decimal CommissionAmount { get; private set; }
    public decimal TaxPercentage { get; private set; }
    public decimal TaxAmount { get; private set; }
    public decimal TotalDue { get; private set; }

    public GarageCommissionStatus Status { get; private set; } = GarageCommissionStatus.Due;
    public DateTime DueAtUtc { get; private set; }
    public DateTime? PaidAtUtc { get; private set; }
    public Guid? PaymentId { get; private set; }
    public string? PaymentReference { get; private set; }
    public string? SettledVia { get; private set; }
    public Guid? SettledByUserId { get; private set; }
    public string? WaiverReason { get; private set; }
    public int RemindersSent { get; private set; }
    public DateTime? LastReminderAtUtc { get; private set; }
    public Guid ConcurrencyToken { get; private set; } = Guid.NewGuid();

    public Garage? Garage { get; private set; }
    public ServiceJob? ServiceJob { get; private set; }
    public ServiceRequest? ServiceRequest { get; private set; }

    protected GarageCommission() { }

    public GarageCommission(
        string commissionNumber,
        Guid garageId,
        Guid serviceJobId,
        Guid serviceRequestId,
        decimal serviceValue,
        decimal advanceCollectedByPlatform,
        decimal commissionPercentage,
        decimal taxPercentage,
        DateTime dueAtUtc,
        string currency = "INR")
    {
        if (string.IsNullOrWhiteSpace(commissionNumber)) throw new ArgumentException("Number is required.", nameof(commissionNumber));
        if (garageId == Guid.Empty) throw new ArgumentException("Garage is required.", nameof(garageId));
        if (serviceJobId == Guid.Empty) throw new ArgumentException("Job is required.", nameof(serviceJobId));
        if (serviceValue < 0) throw new ArgumentException("Service value cannot be negative.", nameof(serviceValue));

        CommissionNumber = commissionNumber.Trim().ToUpperInvariant();
        GarageId = garageId;
        ServiceJobId = serviceJobId;
        ServiceRequestId = serviceRequestId;
        Currency = string.IsNullOrWhiteSpace(currency) ? "INR" : currency.Trim().ToUpperInvariant();
        ServiceValue = decimal.Round(serviceValue, 2);
        AdvanceCollectedByPlatform = decimal.Round(Math.Max(0m, advanceCollectedByPlatform), 2);
        BalanceCollectedByGarage = Math.Max(0m, ServiceValue - AdvanceCollectedByPlatform);
        CommissionPercentage = commissionPercentage;
        CommissionAmount = decimal.Round(ServiceValue * commissionPercentage / 100m, 2, MidpointRounding.AwayFromZero);
        TaxPercentage = taxPercentage;
        TaxAmount = decimal.Round(CommissionAmount * taxPercentage / 100m, 2, MidpointRounding.AwayFromZero);
        TotalDue = CommissionAmount + TaxAmount;
        DueAtUtc = DateTime.SpecifyKind(dueAtUtc, DateTimeKind.Utc);
        Status = TotalDue > 0 ? GarageCommissionStatus.Due : GarageCommissionStatus.Paid;
        if (Status == GarageCommissionStatus.Paid) PaidAtUtc = DateTime.UtcNow;
    }

    public bool IsOverdue(DateTime nowUtc) => Status == GarageCommissionStatus.Due && nowUtc > DueAtUtc;

    public void MarkPaid(string settledVia, string? reference, Guid? paymentId, Guid? settledByUserId)
    {
        if (Status == GarageCommissionStatus.Paid) return;
        if (Status != GarageCommissionStatus.Due)
            throw new InvalidOperationException($"Commission {CommissionNumber} is {Status} and cannot be marked paid.");
        Status = GarageCommissionStatus.Paid;
        PaidAtUtc = DateTime.UtcNow;
        SettledVia = settledVia;
        PaymentReference = reference?.Trim();
        PaymentId = paymentId;
        SettledByUserId = settledByUserId;
        UpdatedAtUtc = DateTime.UtcNow;
        ConcurrencyToken = Guid.NewGuid();
    }

    /// <summary>Remembers the online payment started for this due; it is settled when that payment is verified.</summary>
    public void LinkPendingPayment(Guid paymentId)
    {
        if (Status != GarageCommissionStatus.Due)
            throw new InvalidOperationException($"Commission {CommissionNumber} is not due.");
        PaymentId = paymentId;
        ConcurrencyToken = Guid.NewGuid();
    }

    public void Waive(string reason, Guid userId)
    {
        if (Status != GarageCommissionStatus.Due)
            throw new InvalidOperationException($"Only a due commission can be waived (current: {Status}).");
        if (string.IsNullOrWhiteSpace(reason)) throw new ArgumentException("A reason is required.", nameof(reason));
        Status = GarageCommissionStatus.Waived;
        WaiverReason = reason.Trim();
        SettledByUserId = userId;
        UpdatedAtUtc = DateTime.UtcNow;
        ConcurrencyToken = Guid.NewGuid();
    }

    public void RecordReminder(DateTime sentAtUtc)
    {
        RemindersSent++;
        LastReminderAtUtc = sentAtUtc;
    }
}
