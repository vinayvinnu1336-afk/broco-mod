using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Enums;
using BroCoMod.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BroCoMod.Infrastructure.Services;

/// <summary>
/// Service providing high-level financial reporting and administrative ledger management.
/// Uses real SQL database aggregates for accurate financial accounting.
/// </summary>
public class AdminFinanceService : IAdminFinanceService
{
    private readonly ApplicationDbContext _context;

    public AdminFinanceService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<FinanceOverviewDto> GetFinanceOverviewAsync(
        DateTime? fromUtc = null,
        DateTime? toUtc = null,
        CancellationToken cancellationToken = default)
    {
        var paymentsQuery = _context.Payments.AsNoTracking().AsQueryable();
        var settlementsQuery = _context.GarageSettlements.AsNoTracking().AsQueryable();

        if (fromUtc.HasValue)
        {
            paymentsQuery = paymentsQuery.Where(p => p.CreatedAtUtc >= fromUtc.Value);
            settlementsQuery = settlementsQuery.Where(s => s.CreatedAtUtc >= fromUtc.Value);
        }

        if (toUtc.HasValue)
        {
            paymentsQuery = paymentsQuery.Where(p => p.CreatedAtUtc <= toUtc.Value);
            settlementsQuery = settlementsQuery.Where(s => s.CreatedAtUtc <= toUtc.Value);
        }

        // Real SQL Aggregations
        var paidPayments = paymentsQuery.Where(p =>
            p.Status == PaymentStatus.Paid ||
            p.Status == PaymentStatus.PartiallyRefunded ||
            p.Status == PaymentStatus.Refunded);

        var totalGrossRevenue = await paidPayments
            .Select(p => (decimal?)p.Amount)
            .SumAsync(cancellationToken) ?? 0.0m;

        var totalRefunds = await paymentsQuery
            .Select(p => (decimal?)p.RefundedAmount)
            .SumAsync(cancellationToken) ?? 0.0m;

        var activeSettlements = settlementsQuery.Where(s => s.Status != SettlementStatus.Cancelled);

        var totalPlatformRevenue = await activeSettlements
            .Select(s => (decimal?)s.TotalPlatformFee)
            .SumAsync(cancellationToken) ?? 0.0m;

        var totalGarageSettlements = await activeSettlements
            .Select(s => (decimal?)s.NetPayableToGarage)
            .SumAsync(cancellationToken) ?? 0.0m;

        var netPlatformProfit = totalPlatformRevenue;

        var totalPaymentsCount = await paymentsQuery.CountAsync(cancellationToken);
        var totalInvoicesCount = await _context.Invoices.CountAsync(cancellationToken);
        var pendingSettlementsCount = await settlementsQuery.CountAsync(s => s.Status == SettlementStatus.Pending || s.Status == SettlementStatus.Processing, cancellationToken);
        var completedSettlementsCount = await settlementsQuery.CountAsync(s => s.Status == SettlementStatus.Completed, cancellationToken);

        return new FinanceOverviewDto(
            TotalGrossRevenue: totalGrossRevenue,
            TotalPlatformRevenue: totalPlatformRevenue,
            TotalGarageSettlements: totalGarageSettlements,
            TotalRefunds: totalRefunds,
            NetPlatformProfit: netPlatformProfit,
            TotalPaymentsCount: totalPaymentsCount,
            TotalInvoicesCount: totalInvoicesCount,
            PendingSettlementsCount: pendingSettlementsCount,
            CompletedSettlementsCount: completedSettlementsCount
        );
    }

    public async Task<PagedResult<PaymentDto>> GetAdminPaymentsAsync(
        PaymentFilterDto filter,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Payments.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(filter.Status) &&
            Enum.TryParse<PaymentStatus>(filter.Status, true, out var status))
        {
            query = query.Where(p => p.Status == status);
        }

        if (filter.GarageId.HasValue)
        {
            query = query.Where(p => p.GarageId == filter.GarageId.Value);
        }

        if (filter.CustomerId.HasValue)
        {
            query = query.Where(p => p.CustomerId == filter.CustomerId.Value);
        }

        if (filter.FromDate.HasValue)
        {
            query = query.Where(p => p.CreatedAtUtc >= filter.FromDate.Value);
        }

        if (filter.ToDate.HasValue)
        {
            query = query.Where(p => p.CreatedAtUtc <= filter.ToDate.Value);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var page = Math.Max(1, filter.Page);
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);

        var items = await query
            .OrderByDescending(p => p.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new PaymentDto(
                p.Id,
                p.PaymentNumber,
                p.CustomerQuotationId,
                p.AdditionalWorkQuotationId,
                p.ServiceJobId,
                p.CustomerId,
                p.GarageId,
                p.Amount,
                p.Currency,
                p.Status.ToString(),
                p.Purpose.ToString(),
                p.PaymentMethod.ToString(),
                p.GatewayProvider,
                p.GatewayOrderId,
                p.GatewayPaymentId,
                p.RefundedAmount,
                p.PaidAtUtc,
                p.CreatedAtUtc
            ))
            .ToListAsync(cancellationToken);

        return new PagedResult<PaymentDto>(
            Items: items,
            Page: page,
            PageSize: pageSize,
            TotalCount: totalCount
        );
    }

    public async Task<PagedResult<GarageSettlementDto>> GetAdminSettlementsAsync(
        SettlementFilterDto filter,
        CancellationToken cancellationToken = default)
    {
        var query = _context.GarageSettlements
            .AsNoTracking()
            .Include(s => s.Garage)
            .Include(s => s.ServiceJob)
            .Include(s => s.Payment)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(filter.Status) &&
            Enum.TryParse<SettlementStatus>(filter.Status, true, out var status))
        {
            query = query.Where(s => s.Status == status);
        }

        if (filter.GarageId.HasValue)
        {
            query = query.Where(s => s.GarageId == filter.GarageId.Value);
        }

        if (filter.FromDate.HasValue)
        {
            query = query.Where(s => s.CreatedAtUtc >= filter.FromDate.Value);
        }

        if (filter.ToDate.HasValue)
        {
            query = query.Where(s => s.CreatedAtUtc <= filter.ToDate.Value);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var page = Math.Max(1, filter.Page);
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);

        var items = await query
            .OrderByDescending(s => s.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(s => new GarageSettlementDto(
                s.Id,
                s.SettlementNumber,
                s.GarageId,
                s.Garage != null ? s.Garage.Name : null,
                s.ServiceJobId,
                s.ServiceJob != null ? s.ServiceJob.JobNumber : null,
                s.PaymentId,
                s.Payment != null ? s.Payment.PaymentNumber : null,
                s.GrossAmount,
                s.PlatformFeePercentage,
                s.PlatformFeeFixed,
                s.PlatformFeeAmount,
                s.TaxOnPlatformFee,
                s.TotalPlatformFee,
                s.NetPayableToGarage,
                s.Currency,
                s.Status.ToString(),
                s.SettledAtUtc,
                s.PayoutTransactionRef,
                s.ReferenceNotes,
                s.CreatedAtUtc
            ))
            .ToListAsync(cancellationToken);

        return new PagedResult<GarageSettlementDto>(
            Items: items,
            Page: page,
            PageSize: pageSize,
            TotalCount: totalCount
        );
    }
}
