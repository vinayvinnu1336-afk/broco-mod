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
/// Service managing workshop settlement calculations, commission snapshotting, and payout tracking.
/// </summary>
public class SettlementService : ISettlementService
{
    private readonly ApplicationDbContext _context;
    private readonly ISettlementNumberGenerator _numberGenerator;
    private readonly IFinancialLedgerService _ledgerService;
    private readonly IAuditService _auditService;
    private readonly INotificationService _notificationService;
    private readonly ILogger<SettlementService> _logger;

    public SettlementService(
        ApplicationDbContext context,
        ISettlementNumberGenerator numberGenerator,
        IFinancialLedgerService ledgerService,
        IAuditService auditService,
        INotificationService notificationService,
        ILogger<SettlementService> logger)
    {
        _context = context;
        _numberGenerator = numberGenerator;
        _ledgerService = ledgerService;
        _auditService = auditService;
        _notificationService = notificationService;
        _logger = logger;
    }

    public async Task<GarageSettlementDto> CreateSettlementForPaymentAsync(
        Guid paymentId,
        CancellationToken cancellationToken = default)
    {
        // 1. Idempotency check
        var existing = await _context.GarageSettlements
            .Include(s => s.Garage)
            .Include(s => s.ServiceJob)
            .Include(s => s.Payment)
            .FirstOrDefaultAsync(s => s.PaymentId == paymentId, cancellationToken);

        if (existing != null)
        {
            return MapToDto(existing);
        }

        // 2. Fetch payment
        var payment = await _context.Payments
            .FirstOrDefaultAsync(p => p.Id == paymentId, cancellationToken);

        if (payment == null)
            throw new KeyNotFoundException($"Payment with ID {paymentId} not found.");

        if (payment.Status != PaymentStatus.Paid)
            throw new InvalidOperationException($"Cannot create settlement for payment {payment.PaymentNumber} because its status is '{payment.Status}', not 'Paid'.");

        // 3. Resolve ServiceJobId
        Guid serviceJobId = payment.ServiceJobId ?? Guid.Empty;
        if (serviceJobId == Guid.Empty && payment.CustomerQuotationId.HasValue)
        {
            var job = await _context.ServiceJobs
                .AsNoTracking()
                .FirstOrDefaultAsync(j => j.CustomerQuotationId == payment.CustomerQuotationId.Value, cancellationToken);
            if (job != null)
            {
                serviceJobId = job.Id;
            }
        }

        if (serviceJobId == Guid.Empty)
        {
            // If no job was created yet, use a fallback empty or linked reference
            serviceJobId = payment.Id; // Fallback placeholder
        }

        // 4. Fetch Platform Fee Configuration snapshot
        var now = DateTime.UtcNow;
        var feeConfig = await _context.PlatformFeeConfigurations
            .AsNoTracking()
            .Where(c => c.IsActive && c.EffectiveFromUtc <= now && (c.EffectiveToUtc == null || c.EffectiveToUtc > now))
            .OrderByDescending(c => c.EffectiveFromUtc)
            .FirstOrDefaultAsync(cancellationToken);

        decimal feePercentage = feeConfig?.FeePercentage ?? 10.0m;
        decimal fixedFee = feeConfig?.FixedFee ?? 0.0m;
        decimal taxPercentage = feeConfig?.TaxPercentage ?? 18.0m;

        // 5. Generate settlement number and instantiate
        var settlementNumber = await _numberGenerator.NextSettlementNumberAsync(cancellationToken);

        var settlement = new GarageSettlement(
            settlementNumber: settlementNumber,
            garageId: payment.GarageId,
            serviceJobId: serviceJobId,
            paymentId: payment.Id,
            grossAmount: payment.Amount,
            platformFeePercentage: feePercentage,
            platformFeeFixed: fixedFee,
            taxPercentageOnFee: taxPercentage,
            currency: payment.Currency
        );

        _context.GarageSettlements.Add(settlement);
        await _context.SaveChangesAsync(cancellationToken);

        // 6. Record compensating ledger entries
        await _ledgerService.RecordSettlementEntriesAsync(settlement, cancellationToken);

        // 7. Audit log & Notification
        var garageUser = await _context.GarageUsers
            .AsNoTracking()
            .FirstOrDefaultAsync(gu => gu.GarageId == payment.GarageId, cancellationToken);

        await _auditService.LogAsync(
            action: "SETTLEMENT_CREATED",
            userId: garageUser?.UserId,
            entityName: nameof(GarageSettlement),
            entityId: settlement.Id.ToString(),
            details: $"Settlement {settlement.SettlementNumber} created for payment {payment.PaymentNumber}. Gross: {settlement.GrossAmount}, Net: {settlement.NetPayableToGarage}, Platform Fee: {settlement.TotalPlatformFee}",
            cancellationToken: cancellationToken
        );

        if (garageUser != null)
        {
            await _notificationService.SendInAppNotificationAsync(
                userId: garageUser.UserId,
                title: "Workshop Settlement Created",
                message: $"Settlement {settlement.SettlementNumber} of ₹{settlement.NetPayableToGarage:N2} created for payment {payment.PaymentNumber}.",
                type: "SETTLEMENT_CREATED",
                referenceId: settlement.Id,
                referenceType: nameof(GarageSettlement),
                cancellationToken: cancellationToken
            );
        }

        _logger.LogInformation("Created settlement {SettlementNumber} for payment {PaymentNumber}. Net payable to garage: {NetPayable} {Currency}",
            settlement.SettlementNumber, payment.PaymentNumber, settlement.NetPayableToGarage, settlement.Currency);

        return MapToDto(settlement);
    }

    public async Task<IEnumerable<GarageSettlementDto>> GetGarageSettlementsAsync(
        Guid garageId,
        CancellationToken cancellationToken = default)
    {
        var list = await _context.GarageSettlements
            .AsNoTracking()
            .Include(s => s.Garage)
            .Include(s => s.ServiceJob)
            .Include(s => s.Payment)
            .Where(s => s.GarageId == garageId)
            .OrderByDescending(s => s.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        return list.Select(MapToDto);
    }

    public async Task<GarageSettlementDto?> GetSettlementByIdAsync(
        Guid settlementId,
        Guid garageId,
        CancellationToken cancellationToken = default)
    {
        var settlement = await _context.GarageSettlements
            .AsNoTracking()
            .Include(s => s.Garage)
            .Include(s => s.ServiceJob)
            .Include(s => s.Payment)
            .FirstOrDefaultAsync(s => s.Id == settlementId && s.GarageId == garageId, cancellationToken);

        return settlement != null ? MapToDto(settlement) : null;
    }

    public async Task<GarageSettlementDto> MarkSettlementCompletedAsync(
        Guid settlementId,
        string payoutTransactionRef,
        string? referenceNotes,
        Guid adminId,
        CancellationToken cancellationToken = default)
    {
        var settlement = await _context.GarageSettlements
            .Include(s => s.Garage)
            .Include(s => s.ServiceJob)
            .Include(s => s.Payment)
            .FirstOrDefaultAsync(s => s.Id == settlementId, cancellationToken);

        if (settlement == null)
            throw new KeyNotFoundException($"Settlement with ID {settlementId} not found.");

        settlement.MarkCompleted(payoutTransactionRef, referenceNotes);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: "SETTLEMENT_COMPLETED",
            userId: adminId,
            entityName: nameof(GarageSettlement),
            entityId: settlement.Id.ToString(),
            details: $"Settlement {settlement.SettlementNumber} marked completed. Payout Ref: {payoutTransactionRef}",
            cancellationToken: cancellationToken
        );

        _logger.LogInformation("Settlement {SettlementNumber} marked completed with transaction ref {PayoutRef}",
            settlement.SettlementNumber, payoutTransactionRef);

        return MapToDto(settlement);
    }

    private static GarageSettlementDto MapToDto(GarageSettlement s) => new(
        Id: s.Id,
        SettlementNumber: s.SettlementNumber,
        GarageId: s.GarageId,
        GarageName: s.Garage?.Name,
        ServiceJobId: s.ServiceJobId,
        JobNumber: s.ServiceJob?.JobNumber,
        PaymentId: s.PaymentId,
        PaymentNumber: s.Payment?.PaymentNumber,
        GrossAmount: s.GrossAmount,
        PlatformFeePercentage: s.PlatformFeePercentage,
        PlatformFeeFixed: s.PlatformFeeFixed,
        PlatformFeeAmount: s.PlatformFeeAmount,
        TaxOnPlatformFee: s.TaxOnPlatformFee,
        TotalPlatformFee: s.TotalPlatformFee,
        NetPayableToGarage: s.NetPayableToGarage,
        Currency: s.Currency,
        Status: s.Status.ToString(),
        SettledAtUtc: s.SettledAtUtc,
        PayoutTransactionRef: s.PayoutTransactionRef,
        ReferenceNotes: s.ReferenceNotes,
        CreatedAtUtc: s.CreatedAtUtc
    );
}
