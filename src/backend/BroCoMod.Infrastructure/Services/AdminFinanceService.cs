using BroCoMod.Application.Common;
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
        var commissionsQuery = _context.GarageCommissions.AsNoTracking().AsQueryable();

        if (fromUtc.HasValue)
        {
            paymentsQuery = paymentsQuery.Where(p => p.CreatedAtUtc >= fromUtc.Value);
            settlementsQuery = settlementsQuery.Where(s => s.CreatedAtUtc >= fromUtc.Value);
            commissionsQuery = commissionsQuery.Where(c => c.CreatedAtUtc >= fromUtc.Value);
        }

        if (toUtc.HasValue)
        {
            paymentsQuery = paymentsQuery.Where(p => p.CreatedAtUtc <= toUtc.Value);
            settlementsQuery = settlementsQuery.Where(s => s.CreatedAtUtc <= toUtc.Value);
            commissionsQuery = commissionsQuery.Where(c => c.CreatedAtUtc <= toUtc.Value);
        }

        // Real SQL Aggregations
        var paidPayments = paymentsQuery.Where(p =>
            p.Status == PaymentStatus.Paid ||
            p.Status == PaymentStatus.PartiallyRefunded ||
            p.Status == PaymentStatus.Refunded);

        // Money customers paid. A garage paying its commission is BroCo income (counted below), not customer revenue.
        var customerPaidPayments = paidPayments.Where(p => p.Purpose != PaymentPurpose.GarageCommission);
        var totalGrossRevenue = await customerPaidPayments
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

        // Advisor margin: what customers paid above the garage's own quote.
        var totalPlatformMargin = await activeSettlements
            .Where(s => s.Payment != null)
            .Select(s => (decimal?)(s.Payment!.Amount - s.GrossAmount))
            .SumAsync(cancellationToken) ?? 0.0m;

        // 10% model: the booking advance belongs to BroCo (net of refunds); paid commission is BroCo income.
        var totalBookingAdvances = await paidPayments
            .Where(p => p.Purpose == PaymentPurpose.BookingAdvance)
            .Select(p => (decimal?)(p.Amount - p.RefundedAmount))
            .SumAsync(cancellationToken) ?? 0.0m;
        var paidCommissions = commissionsQuery.Where(c => c.Status == GarageCommissionStatus.Paid);
        var totalCommissionCollected = await paidCommissions
            .Select(c => (decimal?)c.TotalDue)
            .SumAsync(cancellationToken) ?? 0.0m;
        var totalCommissionOutstanding = await commissionsQuery
            .Where(c => c.Status == GarageCommissionStatus.Due)
            .Select(c => (decimal?)c.TotalDue)
            .SumAsync(cancellationToken) ?? 0.0m;

        totalPlatformRevenue += totalBookingAdvances + totalCommissionCollected;

        var netPlatformProfit = totalPlatformRevenue + totalPlatformMargin;

        // The same rows the gross figure adds up, not abandoned checkouts or garage commission payments.
        var totalPaymentsCount = await customerPaidPayments.CountAsync(cancellationToken);
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
            CompletedSettlementsCount: completedSettlementsCount,
            TotalPlatformMargin: totalPlatformMargin,
            TotalBookingAdvances: totalBookingAdvances,
            TotalCommissionCollected: totalCommissionCollected,
            TotalCommissionOutstanding: totalCommissionOutstanding
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

        var (fromUtc, toUtc) = ListFilters.DateRange(filter.FromDate, filter.ToDate);
        if (fromUtc.HasValue)
        {
            query = query.Where(p => p.CreatedAtUtc >= fromUtc.Value);
        }

        if (toUtc.HasValue)
        {
            query = query.Where(p => p.CreatedAtUtc <= toUtc.Value);
        }

        var purpose = ListFilters.Enum<PaymentPurpose>(filter.Purpose, "payment purpose");
        if (purpose.HasValue)
        {
            query = query.Where(p => p.Purpose == purpose.Value);
        }

        var method = ListFilters.Enum<PaymentMethod>(filter.Method, "payment method");
        if (method.HasValue)
        {
            query = query.Where(p => p.PaymentMethod == method.Value);
        }

        var search = ListFilters.Search(filter.Search);
        if (search != null)
        {
            query = query.Where(p =>
                p.PaymentNumber.ToLower().Contains(search) ||
                (p.GatewayOrderId != null && p.GatewayOrderId.ToLower().Contains(search)) ||
                (p.GatewayPaymentId != null && p.GatewayPaymentId.ToLower().Contains(search)) ||
                (p.Garage != null && p.Garage.Name.ToLower().Contains(search)) ||
                _context.ServiceRequests.Any(sr => sr.Id == p.ServiceRequestId && sr.RequestNumber.ToLower().Contains(search)));
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
                p.CreatedAtUtc,
                p.ServiceRequestId
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

        var (fromUtc, toUtc) = ListFilters.DateRange(filter.FromDate, filter.ToDate);
        if (fromUtc.HasValue)
        {
            query = query.Where(s => s.CreatedAtUtc >= fromUtc.Value);
        }

        if (toUtc.HasValue)
        {
            query = query.Where(s => s.CreatedAtUtc <= toUtc.Value);
        }

        var search = ListFilters.Search(filter.Search);
        if (search != null)
        {
            query = query.Where(s =>
                s.SettlementNumber.ToLower().Contains(search) ||
                (s.Garage != null && s.Garage.Name.ToLower().Contains(search)) ||
                (s.ServiceJob != null && s.ServiceJob.JobNumber.ToLower().Contains(search)) ||
                (s.PayoutTransactionRef != null && s.PayoutTransactionRef.ToLower().Contains(search)));
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
