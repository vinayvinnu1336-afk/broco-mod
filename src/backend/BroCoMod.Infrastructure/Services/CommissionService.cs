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
/// After a garage hands a car back it owes BroCo a commission (platform fee % of the service value).
/// Garages pay online from their portal (or an admin records an offline transfer); unpaid dues trigger
/// reminders and, once long overdue, stop the garage from receiving new jobs.
/// </summary>
public class CommissionService : ICommissionService, ICommissionDuesService
{
    private static long _fallbackCounter = 100000;

    private readonly ApplicationDbContext _context;
    private readonly IPaymentGatewayFactory _gatewayFactory;
    private readonly IPaymentNumberGenerator _paymentNumbers;
    private readonly INotificationService _notifications;
    private readonly IEnumerable<INotificationProvider> _providers;
    private readonly IAuditService _audit;
    private readonly ILogger<CommissionService> _logger;
    private readonly int _dueHours;
    private readonly int _reminderIntervalHours;
    private readonly int _blockAfterOverdueDays;
    private readonly decimal _advancePercentage;

    public CommissionService(
        ApplicationDbContext context,
        IPaymentGatewayFactory gatewayFactory,
        IPaymentNumberGenerator paymentNumbers,
        INotificationService notifications,
        IEnumerable<INotificationProvider> providers,
        IAuditService audit,
        IConfiguration configuration,
        ILogger<CommissionService> logger)
    {
        _context = context;
        _gatewayFactory = gatewayFactory;
        _paymentNumbers = paymentNumbers;
        _notifications = notifications;
        _providers = providers;
        _audit = audit;
        _logger = logger;
        _dueHours = Math.Max(1, configuration.GetValue<int?>("Commission:DueHours") ?? 24);
        _reminderIntervalHours = Math.Max(1, configuration.GetValue<int?>("Commission:ReminderIntervalHours") ?? 12);
        _advancePercentage = BookingAdvance.Percentage(configuration);
        _blockAfterOverdueDays = Math.Max(0, configuration.GetValue<int?>("Commission:BlockNewJobsAfterOverdueDays") ?? 3);
    }

    // ---------------- Creation ----------------

    public async Task<GarageCommissionDto?> CreateForJobAsync(Guid serviceJobId, CancellationToken ct = default)
    {
        var existing = await _context.GarageCommissions.FirstOrDefaultAsync(c => c.ServiceJobId == serviceJobId, ct);
        if (existing != null) return await ToDtoAsync(existing.Id, ct);

        var job = await _context.ServiceJobs
            .Include(j => j.CustomerQuotation)
            .Include(j => j.ServiceRequest)
            .Include(j => j.AdditionalWorkRequests)
            .FirstOrDefaultAsync(j => j.Id == serviceJobId, ct)
            ?? throw new KeyNotFoundException("Service job not found.");

        var quotedValue = job.CustomerQuotation?.CustomerTotal ?? job.ServiceRequest?.PackagePrice ?? 0m;
        var extraWork = job.AdditionalWorkRequests
            .Where(a => a.Status == AdditionalWorkStatus.Approved)
            .Sum(a => a.EstimatedAdditionalAmount);
        var serviceValue = quotedValue + extraWork;
        var advance = job.ServiceRequest?.AdvancePaidAmount ?? 0m;

        var fee = await _context.PlatformFeeConfigurations.AsNoTracking()
            .Where(f => f.IsActive)
            .OrderByDescending(f => f.EffectiveFromUtc)
            .FirstOrDefaultAsync(ct);
        var feePercentage = fee?.FeePercentage ?? 10m;

        var commission = new GarageCommission(
            await NextCommissionNumberAsync(ct),
            job.GarageId,
            job.Id,
            job.ServiceRequestId,
            serviceValue,
            advance,
            feePercentage,
            DateTime.UtcNow.AddHours(_dueHours),
            job.CustomerQuotation?.Currency ?? "INR");

        _context.GarageCommissions.Add(commission);
        await _context.SaveChangesAsync(ct);

        await _audit.LogAsync(
            action: "GARAGE_COMMISSION_CREATED",
            userId: null,
            entityName: nameof(GarageCommission),
            entityId: commission.Id.ToString(),
            details: $"Commission {commission.CommissionNumber} of {Inr(commission.TotalDue)} for job {job.JobNumber} (service value {Inr(serviceValue)}).",
            cancellationToken: ct);

        if (commission.Status == GarageCommissionStatus.Due)
        {
            await NotifyGarageAsync(commission, job.JobNumber, isReminder: false, ct);
            commission.RecordReminder(DateTime.UtcNow);
            await _context.SaveChangesAsync(ct);
        }

        return await ToDtoAsync(commission.Id, ct);
    }

    // ---------------- Garage portal ----------------

    public async Task<IReadOnlyList<GarageCommissionDto>> GetGarageCommissionsAsync(Guid garageId, string? status, CancellationToken ct = default)
    {
        var query = Query().Where(c => c.GarageId == garageId);
        if (TryParseStatus(status, out var parsed)) query = query.Where(c => c.Status == parsed);
        var items = await query
            .OrderBy(c => c.Status)
            .ThenByDescending(c => c.CreatedAtUtc)
            .Take(200)
            .ToListAsync(ct);
        var now = DateTime.UtcNow;
        return items.Select(c => ToDto(c, now)).ToList();
    }

    public async Task<GarageCommissionSummaryDto> GetGarageSummaryAsync(Guid garageId, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var due = await _context.GarageCommissions.AsNoTracking()
            .Where(c => c.GarageId == garageId && c.Status == GarageCommissionStatus.Due)
            .Select(c => new { c.TotalDue, c.DueAtUtc })
            .ToListAsync(ct);
        var paidThisMonth = await _context.GarageCommissions.AsNoTracking()
            .Where(c => c.GarageId == garageId && c.Status == GarageCommissionStatus.Paid && c.PaidAtUtc >= monthStart)
            .SumAsync(c => (decimal?)c.TotalDue, ct) ?? 0m;
        var overdue = due.Where(d => d.DueAtUtc < now).ToList();

        return new GarageCommissionSummaryDto(
            OutstandingAmount: due.Sum(d => d.TotalDue),
            OutstandingCount: due.Count,
            OverdueAmount: overdue.Sum(d => d.TotalDue),
            OverdueCount: overdue.Count,
            PaidThisMonth: paidThisMonth,
            OldestDueAtUtc: due.Count == 0 ? null : due.Min(d => d.DueAtUtc),
            NewJobsBlocked: IsBlocked(due.Select(d => d.DueAtUtc), now));
    }

    public async Task<InitiatePaymentResponseDto> InitiateCommissionPaymentAsync(Guid garageId, Guid payerUserId, PayCommissionsRequest request, CancellationToken ct = default)
    {
        var query = _context.GarageCommissions.Where(c => c.GarageId == garageId && c.Status == GarageCommissionStatus.Due);
        if (request.CommissionIds is { Count: > 0 })
        {
            query = query.Where(c => request.CommissionIds.Contains(c.Id));
        }
        var dues = await query.OrderBy(c => c.DueAtUtc).ToListAsync(ct);
        if (dues.Count == 0) throw new InvalidOperationException("There is nothing to pay right now.");
        if (request.CommissionIds is { Count: > 0 } && dues.Count != request.CommissionIds.Distinct().Count())
            throw new InvalidOperationException("Some of the selected dues are already paid or don't belong to your garage.");

        var payer = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == payerUserId, ct);
        var amount = dues.Sum(d => d.TotalDue);
        var paymentNumber = await _paymentNumbers.NextPaymentNumberAsync(ct);
        var gateway = _gatewayFactory.GetGateway();
        var currency = dues[0].Currency;
        var reference = dues.Count == 1 ? dues[0].CommissionNumber : $"{dues.Count} commission dues";

        var order = await gateway.CreatePaymentOrderAsync(new CreatePaymentOrderParams(
            PaymentNumber: paymentNumber,
            Amount: amount,
            Currency: currency,
            CustomerEmail: payer?.Email ?? "garage@example.com",
            CustomerName: payer?.FullName ?? "Garage",
            CustomerPhone: payer?.PhoneNumber,
            Description: $"BroCo commission: {reference}"), ct);

        var payment = new Payment(
            paymentNumber: paymentNumber,
            customerId: payerUserId,
            garageId: garageId,
            amount: amount,
            currency: currency,
            purpose: PaymentPurpose.GarageCommission,
            gatewayProvider: gateway.ProviderName,
            idempotencyKey: string.IsNullOrWhiteSpace(request.IdempotencyKey) ? null : request.IdempotencyKey,
            garageCommissionId: dues.Count == 1 ? dues[0].Id : null);
        payment.SetGatewayOrder(order.OrderId, gateway.ProviderName);
        _context.Payments.Add(payment);
        foreach (var due in dues)
        {
            due.LinkPendingPayment(payment.Id);
            _context.GarageCommissionPaymentAllocations.Add(new GarageCommissionPaymentAllocation(payment.Id, due.Id, due.TotalDue));
        }
        await _context.SaveChangesAsync(ct);

        return new InitiatePaymentResponseDto(
            PaymentId: payment.Id,
            PaymentNumber: payment.PaymentNumber,
            Amount: payment.Amount,
            Currency: payment.Currency,
            GatewayProvider: payment.GatewayProvider,
            GatewayOrderId: payment.GatewayOrderId,
            CheckoutUrl: order.CheckoutUrl,
            ProviderData: order.ProviderData);
    }

    public async Task SettleCommissionsForPaymentAsync(Guid paymentId, CancellationToken ct = default)
    {
        var payment = await _context.Payments.AsNoTracking().FirstOrDefaultAsync(p => p.Id == paymentId, ct);
        if (payment == null || payment.Status != PaymentStatus.Paid || payment.Purpose != PaymentPurpose.GarageCommission) return;

        // The dues this checkout was started for. A due's own PaymentId only remembers its latest checkout, and
        // covers checkouts started before allocations were recorded.
        var allocatedIds = await _context.GarageCommissionPaymentAllocations.AsNoTracking()
            .Where(a => a.PaymentId == paymentId)
            .Select(a => a.GarageCommissionId)
            .ToListAsync(ct);
        var covered = await _context.GarageCommissions
            .Where(c => allocatedIds.Contains(c.Id) || c.PaymentId == paymentId)
            .ToListAsync(ct);
        var dues = covered.Where(c => c.Status == GarageCommissionStatus.Due).ToList();
        foreach (var due in dues)
        {
            due.MarkPaid("Online", payment.GatewayPaymentId ?? payment.PaymentNumber, payment.Id, payment.CustomerId);
            AddCommissionLedgerEntries(due, payment.Id);
        }
        await _context.SaveChangesAsync(ct);

        // Some of these dues were settled by another payment (or waived) first, so part of this money settles nothing.
        var settledByThis = covered.Where(c => c.Status == GarageCommissionStatus.Paid && c.PaymentId == payment.Id).Sum(c => c.TotalDue);
        var surplus = payment.Amount - settledByThis;
        if (surplus >= 1m && !await _context.AuditLogs.AnyAsync(a => a.Action == "GARAGE_COMMISSION_OVERPAID" && a.EntityId == payment.Id.ToString(), ct))
        {
            _logger.LogWarning("Commission payment {PaymentNumber} of {Amount} settled only {Settled}; {Surplus} needs a refund or credit.",
                payment.PaymentNumber, payment.Amount, settledByThis, surplus);
            await _audit.LogAsync(
                action: "GARAGE_COMMISSION_OVERPAID",
                userId: payment.CustomerId,
                entityName: nameof(Payment),
                entityId: payment.Id.ToString(),
                details: $"{payment.PaymentNumber} paid {Inr(payment.Amount)} but settled {Inr(settledByThis)}: the other dues were already paid or waived. Refund or credit {Inr(surplus)} to the garage.",
                cancellationToken: ct);
            var adminIds = await _context.Users.AsNoTracking()
                .Where(u => u.IsActive && u.UserRoles.Any(ur => ur.Role.Name == AppRoles.SuperAdmin))
                .Select(u => u.Id)
                .ToListAsync(ct);
            foreach (var adminId in adminIds)
            {
                await _notifications.SendInAppNotificationAsync(adminId, "Garage overpaid commission",
                    $"{payment.PaymentNumber}: {Inr(surplus)} of {Inr(payment.Amount)} did not settle any due. Refund or credit the garage.",
                    "COMMISSION_OVERPAID", payment.Id, nameof(Payment), cancellationToken: ct);
            }
        }

        if (dues.Count > 0)
        {
            await _audit.LogAsync(
                action: "GARAGE_COMMISSION_PAID",
                userId: payment.CustomerId,
                entityName: nameof(Payment),
                entityId: payment.Id.ToString(),
                details: $"Garage paid {dues.Count} commission due(s) online, {Inr(payment.Amount)} ({payment.PaymentNumber}).",
                cancellationToken: ct);
        }
    }

    // ---------------- Admin ----------------

    public async Task<PagedResult<GarageCommissionDto>> GetAdminCommissionsAsync(string? status, Guid? garageId, int page, int pageSize, CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var now = DateTime.UtcNow;
        var query = Query();
        if (garageId.HasValue) query = query.Where(c => c.GarageId == garageId.Value);
        if (string.Equals(status, "Overdue", StringComparison.OrdinalIgnoreCase))
            query = query.Where(c => c.Status == GarageCommissionStatus.Due && c.DueAtUtc < now);
        else if (TryParseStatus(status, out var parsed))
            query = query.Where(c => c.Status == parsed);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderBy(c => c.Status)
            .ThenBy(c => c.DueAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);
        return new PagedResult<GarageCommissionDto>(items.Select(c => ToDto(c, now)).ToList(), page, pageSize, total);
    }

    public async Task<AdminCommissionOverviewDto> GetAdminOverviewAsync(CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var due = await _context.GarageCommissions.AsNoTracking()
            .Where(c => c.Status == GarageCommissionStatus.Due)
            .Select(c => new { c.GarageId, c.TotalDue, c.DueAtUtc })
            .ToListAsync(ct);
        var collected = await _context.GarageCommissions.AsNoTracking()
            .Where(c => c.Status == GarageCommissionStatus.Paid)
            .SumAsync(c => (decimal?)c.TotalDue, ct) ?? 0m;
        var overdue = due.Where(d => d.DueAtUtc < now).ToList();
        return new AdminCommissionOverviewDto(
            due.Sum(d => d.TotalDue), due.Count,
            overdue.Sum(d => d.TotalDue), overdue.Count,
            collected,
            overdue.Select(d => d.GarageId).Distinct().Count(),
            due.Select(d => d.GarageId).Distinct().Count(),
            CountBlockedGarages(due.Select(d => (d.GarageId, d.DueAtUtc)), now));
    }

    public async Task<GarageCommissionDto> MarkReceivedAsync(Guid commissionId, MarkCommissionReceivedRequest request, Guid adminUserId, CancellationToken ct = default)
    {
        var commission = await _context.GarageCommissions.FirstOrDefaultAsync(c => c.Id == commissionId, ct)
            ?? throw new KeyNotFoundException("Commission not found.");
        commission.MarkPaid(string.IsNullOrWhiteSpace(request.Method) ? "Offline" : request.Method.Trim(), request.Reference, null, adminUserId);
        AddCommissionLedgerEntries(commission, null);
        await _context.SaveChangesAsync(ct);
        await _audit.LogAsync(
            action: "GARAGE_COMMISSION_RECEIVED",
            userId: adminUserId,
            entityName: nameof(GarageCommission),
            entityId: commission.Id.ToString(),
            details: $"Recorded offline receipt of {Inr(commission.TotalDue)} for {commission.CommissionNumber} (ref {request.Reference}).",
            cancellationToken: ct);
        return await ToDtoAsync(commission.Id, ct);
    }

    public async Task<GarageCommissionDto> WaiveAsync(Guid commissionId, WaiveCommissionRequest request, Guid adminUserId, CancellationToken ct = default)
    {
        var commission = await _context.GarageCommissions.FirstOrDefaultAsync(c => c.Id == commissionId, ct)
            ?? throw new KeyNotFoundException("Commission not found.");
        commission.Waive(request.Reason, adminUserId);
        await _context.SaveChangesAsync(ct);
        await _audit.LogAsync(
            action: "GARAGE_COMMISSION_WAIVED",
            userId: adminUserId,
            entityName: nameof(GarageCommission),
            entityId: commission.Id.ToString(),
            details: $"Waived {commission.CommissionNumber} ({Inr(commission.TotalDue)}): {request.Reason}",
            cancellationToken: ct);
        return await ToDtoAsync(commission.Id, ct);
    }

    // ---------------- Terms ----------------

    public async Task<CommissionTermsDto> GetTermsAsync(CancellationToken ct = default)
    {
        var fee = await ActiveFeeAsync(ct);
        return new CommissionTermsDto(fee?.FeePercentage ?? 10m, _advancePercentage);
    }

    /// <summary>Applies to commissions created from now on; existing dues keep the rate they were billed at.</summary>
    public async Task<CommissionTermsDto> UpdateTermsAsync(UpdateCommissionTermsRequest request, Guid adminUserId, CancellationToken ct = default)
    {
        var fee = await ActiveFeeAsync(ct, tracked: true);
        if (fee == null)
        {
            fee = new PlatformFeeConfiguration("Standard Automotive Commission", request.CommissionPercentage, 0m, true, DateTime.UtcNow);
            _context.PlatformFeeConfigurations.Add(fee);
        }
        else
        {
            fee.UpdateTerms(request.CommissionPercentage, fee.FixedFee);
        }
        await _context.SaveChangesAsync(ct);
        await _audit.LogAsync(
            action: "COMMISSION_TERMS_UPDATED",
            userId: adminUserId,
            entityName: nameof(PlatformFeeConfiguration),
            entityId: fee.Id.ToString(),
            details: $"Garage commission set to {request.CommissionPercentage}%.",
            cancellationToken: ct);
        return await GetTermsAsync(ct);
    }

    private Task<PlatformFeeConfiguration?> ActiveFeeAsync(CancellationToken ct, bool tracked = false)
    {
        var query = tracked ? _context.PlatformFeeConfigurations : _context.PlatformFeeConfigurations.AsNoTracking();
        return query.Where(f => f.IsActive).OrderByDescending(f => f.EffectiveFromUtc).FirstOrDefaultAsync(ct);
    }

    // ---------------- Enforcement & reminders ----------------

    public async Task<bool> IsGarageBlockedForNewJobsAsync(Guid garageId, CancellationToken ct = default)
    {
        if (_blockAfterOverdueDays <= 0) return false;
        var cutoff = DateTime.UtcNow.AddDays(-_blockAfterOverdueDays);
        return await _context.GarageCommissions.AsNoTracking()
            .AnyAsync(c => c.GarageId == garageId && c.Status == GarageCommissionStatus.Due && c.DueAtUtc < cutoff, ct);
    }

    public async Task<int> SendDueRemindersAsync(CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var threshold = now.AddHours(-_reminderIntervalHours);
        var dues = await _context.GarageCommissions
            .Include(c => c.ServiceJob)
            .Where(c => c.Status == GarageCommissionStatus.Due &&
                        (c.LastReminderAtUtc == null || c.LastReminderAtUtc < threshold))
            .OrderBy(c => c.DueAtUtc)
            .Take(200)
            .ToListAsync(ct);

        foreach (var due in dues)
        {
            await NotifyGarageAsync(due, due.ServiceJob?.JobNumber ?? string.Empty, isReminder: true, ct);
            due.RecordReminder(now);
        }
        if (dues.Count > 0) await _context.SaveChangesAsync(ct);
        return dues.Count;
    }

    // ---------------- Staff: garage dues & on-demand reminders ----------------

    internal const string ManualReminderAuditAction = "GARAGE_COMMISSION_REMINDER_SENT";
    internal const string StaffOverdueNotificationType = "COMMISSION_OVERDUE_STAFF";
    private static readonly TimeSpan ManualReminderCooldown = TimeSpan.FromHours(1);
    // Dues that were already long overdue before this alert existed are on the dashboards; don't flood staff with them.
    private static readonly TimeSpan StaffOverdueAlertWindow = TimeSpan.FromDays(7);

    public async Task<PagedResult<GarageCommissionDto>> GetDuesAsync(CommissionDuesQuery q, CancellationToken ct = default)
    {
        var page = Math.Max(1, q.Page);
        var pageSize = Math.Clamp(q.PageSize, 1, 100);
        var now = DateTime.UtcNow;
        var query = Query();

        var status = string.IsNullOrWhiteSpace(q.Status) ? nameof(GarageCommissionStatus.Due) : q.Status.Trim();
        if (status.Equals("Overdue", StringComparison.OrdinalIgnoreCase))
            query = query.Where(c => c.Status == GarageCommissionStatus.Due && c.DueAtUtc < now);
        else if (TryParseStatus(status, out var parsed))
            query = query.Where(c => c.Status == parsed);
        else if (!status.Equals("All", StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("Status must be Due, Overdue, Paid, Waived or All.");

        if (q.GarageId.HasValue) query = query.Where(c => c.GarageId == q.GarageId.Value);
        if (q.DueFrom.HasValue)
        {
            var from = AsUtc(q.DueFrom.Value);
            query = query.Where(c => c.DueAtUtc >= from);
        }
        if (q.DueTo.HasValue)
        {
            var to = AsUtc(q.DueTo.Value);
            query = query.Where(c => c.DueAtUtc <= to);
        }
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var term = q.Search.Trim().ToLower();
            query = query.Where(c =>
                c.CommissionNumber.ToLower().Contains(term) ||
                c.Garage!.Name.ToLower().Contains(term) ||
                c.Garage.PhoneNumber.Contains(term) ||
                c.ServiceJob!.JobNumber.ToLower().Contains(term) ||
                c.ServiceRequest!.RequestNumber.ToLower().Contains(term));
        }

        query = (q.Sort?.Trim().ToLowerInvariant()) switch
        {
            "garage" => query.OrderBy(c => c.Garage!.Name).ThenBy(c => c.GarageId).ThenBy(c => c.DueAtUtc),
            "amount" => query.OrderByDescending(c => c.TotalDue).ThenBy(c => c.DueAtUtc),
            "reminded" => query.OrderBy(c => c.LastReminderAtUtc ?? DateTime.MinValue).ThenBy(c => c.DueAtUtc),
            _ => query.OrderBy(c => c.Status).ThenBy(c => c.DueAtUtc),
        };

        var total = await query.CountAsync(ct);
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return new PagedResult<GarageCommissionDto>(await ToStaffDtosAsync(items, now, ct), page, pageSize, total);
    }

    public async Task<GarageDuesOverviewDto> GetDuesOverviewAsync(CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var due = await _context.GarageCommissions.AsNoTracking()
            .Where(c => c.Status == GarageCommissionStatus.Due)
            .Select(c => new { c.GarageId, c.TotalDue, c.DueAtUtc })
            .ToListAsync(ct);
        var overdue = due.Where(d => d.DueAtUtc < now).ToList();
        return new GarageDuesOverviewDto(
            due.Sum(d => d.TotalDue), due.Count,
            overdue.Sum(d => d.TotalDue), overdue.Count,
            due.Select(d => d.GarageId).Distinct().Count(),
            overdue.Select(d => d.GarageId).Distinct().Count(),
            CountBlockedGarages(due.Select(d => (d.GarageId, d.DueAtUtc)), now));
    }

    public async Task<IReadOnlyList<GarageDuesSummaryDto>> GetGarageDuesAsync(CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var rows = await _context.GarageCommissions.AsNoTracking()
            .Where(c => c.Status == GarageCommissionStatus.Due)
            .Select(c => new { c.GarageId, c.Garage!.Name, c.Garage.PhoneNumber, c.TotalDue, c.DueAtUtc, c.LastReminderAtUtc })
            .ToListAsync(ct);

        return rows
            .GroupBy(r => r.GarageId)
            .Select(g =>
            {
                var overdue = g.Where(r => r.DueAtUtc < now).ToList();
                return new GarageDuesSummaryDto(
                    g.Key,
                    g.First().Name,
                    g.First().PhoneNumber,
                    g.Sum(r => r.TotalDue),
                    g.Count(),
                    overdue.Sum(r => r.TotalDue),
                    overdue.Count,
                    g.Min(r => r.DueAtUtc),
                    IsBlocked(g.Select(r => r.DueAtUtc), now),
                    g.Max(r => r.LastReminderAtUtc));
            })
            .OrderByDescending(g => g.OverdueAmount)
            .ThenByDescending(g => g.OutstandingAmount)
            .ThenBy(g => g.GarageName)
            .ToList();
    }

    public async Task<CommissionReminderResultDto> SendManualReminderAsync(Guid commissionId, Guid staffUserId, CancellationToken ct = default)
    {
        var commission = await _context.GarageCommissions
            .Include(c => c.ServiceJob)
            .Include(c => c.ServiceRequest)
            .Include(c => c.Garage)
            .FirstOrDefaultAsync(c => c.Id == commissionId, ct)
            ?? throw new KeyNotFoundException("Commission not found.");
        if (commission.Status != GarageCommissionStatus.Due)
            throw new InvalidOperationException($"{commission.CommissionNumber} is already {commission.Status.ToString().ToLowerInvariant()}; there is nothing to remind the garage about.");

        var now = DateTime.UtcNow;
        var garageName = commission.Garage?.Name ?? "The garage";
        var recent = await RecentManualRemindersAsync(new[] { commission.Id }, now, ct);
        if (recent.TryGetValue(commission.Id, out var lastAt))
        {
            var wait = Math.Max(1, (int)Math.Ceiling((lastAt + ManualReminderCooldown - now).TotalMinutes));
            var ago = Math.Max(1, (int)(now - lastAt).TotalMinutes);
            return new CommissionReminderResultDto(false,
                $"{garageName} was reminded about {commission.CommissionNumber} {ago} min ago. You can send another reminder in {wait} min.",
                (await ToStaffDtosAsync(new[] { commission }, now, ct))[0], ReminderNotSent.TooSoon);
        }

        var notified = await NotifyGarageAsync(commission, commission.ServiceJob?.JobNumber ?? string.Empty, isReminder: true, ct);
        if (notified == 0)
        {
            return new CommissionReminderResultDto(false,
                $"{garageName} has no active portal users to remind. Call them on {commission.Garage?.PhoneNumber}.",
                (await ToStaffDtosAsync(new[] { commission }, now, ct))[0], ReminderNotSent.NoRecipients);
        }

        commission.RecordReminder(now);
        await _context.SaveChangesAsync(ct);
        await LogManualReminderAsync(commission, staffUserId, bulk: false, ct);

        return new CommissionReminderResultDto(true,
            $"Reminder sent to {garageName}.",
            (await ToStaffDtosAsync(new[] { commission }, now, ct))[0]);
    }

    public async Task<BulkCommissionReminderResultDto> RemindOverdueAsync(Guid? garageId, Guid staffUserId, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var query = _context.GarageCommissions
            .Include(c => c.ServiceJob)
            .Include(c => c.Garage)
            .Where(c => c.Status == GarageCommissionStatus.Due && c.DueAtUtc < now);
        if (garageId.HasValue) query = query.Where(c => c.GarageId == garageId.Value);
        var overdue = await query.OrderBy(c => c.DueAtUtc).Take(500).ToListAsync(ct);

        var recent = await RecentManualRemindersAsync(overdue.Select(c => c.Id).ToList(), now, ct);
        var toRemind = overdue.Where(c => !recent.ContainsKey(c.Id)).ToList();

        int duesReminded = 0, garagesReminded = 0;
        foreach (var garageDues in toRemind.GroupBy(c => c.GarageId))
        {
            var dues = garageDues.ToList();
            var notified = dues.Count == 1
                ? await NotifyGarageAsync(dues[0], dues[0].ServiceJob?.JobNumber ?? string.Empty, isReminder: true, ct)
                : await NotifyGarageOfOverdueDuesAsync(dues, ct);
            if (notified == 0) continue;

            foreach (var due in dues) due.RecordReminder(now);
            await _context.SaveChangesAsync(ct);
            foreach (var due in dues) await LogManualReminderAsync(due, staffUserId, bulk: true, ct);
            duesReminded += dues.Count;
            garagesReminded++;
        }

        return new BulkCommissionReminderResultDto(duesReminded, garagesReminded, overdue.Count - toRemind.Count);
    }

    public async Task<int> NotifyStaffOfOverdueDuesAsync(CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var since = now - StaffOverdueAlertWindow;
        // The staff notification itself marks the due as announced, so no extra column is needed.
        var dues = await Query()
            .Where(c => c.Status == GarageCommissionStatus.Due && c.DueAtUtc < now && c.DueAtUtc > since &&
                        !_context.Notifications.Any(n => n.Type == StaffOverdueNotificationType && n.ReferenceId == c.Id))
            .OrderBy(c => c.DueAtUtc)
            .Take(100)
            .ToListAsync(ct);
        if (dues.Count == 0) return 0;

        var staffIds = await _context.Users.AsNoTracking()
            .Where(u => u.IsActive && u.UserRoles.Any(ur => ur.Role.Name == AppRoles.SuperAdmin || ur.Role.Name == AppRoles.Advisor))
            .Select(u => u.Id)
            .ToListAsync(ct);
        if (staffIds.Count == 0) return 0;

        foreach (var due in dues)
        {
            var message = $"{due.Garage?.Name ?? "A garage"} has not paid {Inr(due.TotalDue)} for job {due.ServiceJob?.JobNumber} ({due.CommissionNumber}), " +
                          $"due {IstText(due.DueAtUtc)}. Remind them from Garage dues.";
            _context.Notifications.AddRange(staffIds.Select(id => new Notification(
                id, "Garage payment overdue", message, StaffOverdueNotificationType,
                NotificationChannel.InApp, due.Id, nameof(GarageCommission))));
            await _context.SaveChangesAsync(ct);
        }
        return dues.Count;
    }

    private async Task LogManualReminderAsync(GarageCommission commission, Guid staffUserId, bool bulk, CancellationToken ct)
    {
        var staff = await _context.Users.AsNoTracking()
            .Where(u => u.Id == staffUserId)
            .Select(u => new { u.FullName, u.Email })
            .FirstOrDefaultAsync(ct);
        await _audit.LogAsync(
            action: ManualReminderAuditAction,
            userId: staffUserId == Guid.Empty ? null : staffUserId,
            userEmail: staff?.Email,
            entityName: nameof(GarageCommission),
            entityId: commission.Id.ToString(),
            details: $"{(bulk ? "Overdue reminder (remind all)" : "Reminder")} for {commission.CommissionNumber} ({Inr(commission.TotalDue)}) sent to {commission.Garage?.Name ?? "the garage"} by {staff?.FullName ?? "staff"}.",
            cancellationToken: ct);
    }

    /// <summary>Latest manual reminder within the cooldown, per due.</summary>
    private async Task<Dictionary<Guid, DateTime>> RecentManualRemindersAsync(IReadOnlyCollection<Guid> commissionIds, DateTime now, CancellationToken ct)
    {
        if (commissionIds.Count == 0) return new Dictionary<Guid, DateTime>();
        var ids = commissionIds.Select(id => id.ToString()).ToList();
        var since = now - ManualReminderCooldown;
        var rows = await _context.AuditLogs.AsNoTracking()
            .Where(a => a.Action == ManualReminderAuditAction && a.EntityId != null && ids.Contains(a.EntityId) && a.TimestampUtc > since)
            .GroupBy(a => a.EntityId!)
            .Select(g => new { Id = g.Key, Last = g.Max(a => a.TimestampUtc) })
            .ToListAsync(ct);
        return rows.ToDictionary(r => Guid.Parse(r.Id), r => DateTime.SpecifyKind(r.Last, DateTimeKind.Utc));
    }

    private async Task<List<GarageCommissionDto>> ToStaffDtosAsync(IReadOnlyList<GarageCommission> items, DateTime now, CancellationToken ct)
    {
        var garageIds = items.Select(c => c.GarageId).Distinct().ToList();
        var blocked = new HashSet<Guid>();
        if (_blockAfterOverdueDays > 0 && garageIds.Count > 0)
        {
            var cutoff = now.AddDays(-_blockAfterOverdueDays);
            blocked = (await _context.GarageCommissions.AsNoTracking()
                .Where(c => garageIds.Contains(c.GarageId) && c.Status == GarageCommissionStatus.Due && c.DueAtUtc < cutoff)
                .Select(c => c.GarageId)
                .Distinct()
                .ToListAsync(ct)).ToHashSet();
        }
        var recent = await RecentManualRemindersAsync(
            items.Where(c => c.Status == GarageCommissionStatus.Due).Select(c => c.Id).ToList(), now, ct);

        return items.Select(c => ToDto(c, now) with
        {
            GaragePhone = c.Garage?.PhoneNumber,
            DaysOverdue = c.IsOverdue(now) ? (int)Math.Floor((now - c.DueAtUtc).TotalDays) : 0,
            GarageBlocked = blocked.Contains(c.GarageId),
            NextManualReminderAtUtc = recent.TryGetValue(c.Id, out var at) ? at + ManualReminderCooldown : null,
        }).ToList();
    }

    private int CountBlockedGarages(IEnumerable<(Guid GarageId, DateTime DueAtUtc)> dues, DateTime now) =>
        _blockAfterOverdueDays <= 0
            ? 0
            : dues.Where(d => d.DueAtUtc < now.AddDays(-_blockAfterOverdueDays)).Select(d => d.GarageId).Distinct().Count();

    private static DateTime AsUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value, DateTimeKind.Utc),
    };

    private static string IstText(DateTime utc) =>
        utc.AddMinutes(330).ToString("d MMM, h:mm tt", System.Globalization.CultureInfo.GetCultureInfo("en-IN")) + " IST";

    // ---------------- Helpers ----------------

    private bool IsBlocked(IEnumerable<DateTime> dueDates, DateTime now) =>
        _blockAfterOverdueDays > 0 && dueDates.Any(d => d < now.AddDays(-_blockAfterOverdueDays));

    /// <returns>How many garage users were notified.</returns>
    private async Task<int> NotifyGarageAsync(GarageCommission commission, string jobNumber, bool isReminder, CancellationToken ct)
    {
        var overdue = commission.IsOverdue(DateTime.UtcNow);
        var title = !isReminder
            ? "Commission due to BroCo"
            : overdue ? "Overdue: please pay your BroCo commission" : "Reminder: BroCo commission due";
        var message = !isReminder
            ? $"Job {jobNumber} is complete. Please pay the BroCo commission of {Inr(commission.TotalDue)} ({commission.CommissionNumber}) now from Garage portal → Commission."
            : $"{Inr(commission.TotalDue)} for job {jobNumber} ({commission.CommissionNumber}) is {(overdue ? "overdue" : "due")}. Pay now from Garage portal → Commission" +
              BlockWarning();

        return await NotifyGarageUsersAsync(commission.GarageId, title, message, commission.Id, commission.CommissionNumber, ct);
    }

    /// <summary>One reminder covering several overdue dues of the same garage.</summary>
    private Task<int> NotifyGarageOfOverdueDuesAsync(IReadOnlyList<GarageCommission> dues, CancellationToken ct)
    {
        var numbers = string.Join(", ", dues.Take(3).Select(d => d.CommissionNumber)) + (dues.Count > 3 ? ", …" : string.Empty);
        var message = $"{dues.Count} BroCo commission dues totalling {Inr(dues.Sum(d => d.TotalDue))} are overdue ({numbers}). " +
                      "Pay now from Garage portal → Commission" + BlockWarning();
        return NotifyGarageUsersAsync(dues[0].GarageId, "Overdue: please pay your BroCo commission", message, dues[0].Id, numbers, ct);
    }

    private string BlockWarning() =>
        _blockAfterOverdueDays > 0 ? $" — garages with dues older than {_blockAfterOverdueDays} days stop receiving new jobs." : ".";

    /// <summary>In-app plus every configured SMS / email / WhatsApp provider, to each active user of the garage.</summary>
    private async Task<int> NotifyGarageUsersAsync(Guid garageId, string title, string message, Guid commissionId, string label, CancellationToken ct)
    {
        var userIds = await _context.GarageUsers.AsNoTracking()
            .Where(gu => gu.GarageId == garageId && gu.User.IsActive)
            .Select(gu => gu.UserId)
            .ToListAsync(ct);

        foreach (var userId in userIds)
        {
            await _notifications.SendInAppNotificationAsync(userId, title, message, "COMMISSION_DUE",
                referenceId: commissionId, referenceType: nameof(GarageCommission), cancellationToken: ct);

            foreach (var provider in _providers.Where(p => p.Channel is NotificationChannel.Sms or NotificationChannel.Email or NotificationChannel.WhatsApp))
            {
                try
                {
                    await provider.SendAsync(new NotificationMessage(userId, title, message, "COMMISSION_DUE", provider.Channel, commissionId, nameof(GarageCommission)), ct);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Could not send {Channel} commission reminder for {Commission}", provider.Channel, label);
                }
            }
        }
        return userIds.Count;
    }

    private void AddCommissionLedgerEntries(GarageCommission commission, Guid? paymentId)
    {
        var txRef = $"TXN-{commission.CommissionNumber}";
        _context.FinancialLedgerEntries.Add(new FinancialLedgerEntry(
            transactionReference: txRef,
            entryType: LedgerEntryType.Commission,
            debitAmount: commission.TotalDue,
            creditAmount: 0m,
            accountType: "PLATFORM_CASH",
            description: $"Commission received for {commission.CommissionNumber}",
            currency: commission.Currency,
            accountId: commission.GarageId,
            paymentId: paymentId));
        _context.FinancialLedgerEntries.Add(new FinancialLedgerEntry(
            transactionReference: txRef,
            entryType: LedgerEntryType.Commission,
            debitAmount: 0m,
            creditAmount: commission.TotalDue,
            accountType: "PLATFORM_COMMISSION",
            description: $"Commission revenue {commission.CommissionNumber}",
            currency: commission.Currency,
            accountId: commission.GarageId,
            paymentId: paymentId));
    }

    private IQueryable<GarageCommission> Query() => _context.GarageCommissions.AsNoTracking()
        .Include(c => c.Garage)
        .Include(c => c.ServiceJob)
        .Include(c => c.ServiceRequest);

    private async Task<GarageCommissionDto> ToDtoAsync(Guid id, CancellationToken ct)
    {
        var commission = await Query().FirstAsync(c => c.Id == id, ct);
        return ToDto(commission, DateTime.UtcNow);
    }

    private static GarageCommissionDto ToDto(GarageCommission c, DateTime now) => new(
        c.Id,
        c.CommissionNumber,
        c.GarageId,
        c.Garage?.Name ?? string.Empty,
        c.ServiceJobId,
        c.ServiceJob?.JobNumber ?? string.Empty,
        c.ServiceRequestId,
        c.ServiceRequest?.RequestNumber ?? string.Empty,
        c.ServiceRequest == null ? string.Empty : $"{c.ServiceRequest.VehicleMake} {c.ServiceRequest.VehicleModel} · {c.ServiceRequest.VehicleLicensePlate}".Trim(),
        c.Currency,
        c.ServiceValue,
        c.AdvanceCollectedByPlatform,
        c.BalanceCollectedByGarage,
        c.CommissionPercentage,
        c.CommissionAmount,
        c.TotalDue,
        c.Status.ToString(),
        c.DueAtUtc,
        c.IsOverdue(now),
        c.PaidAtUtc,
        c.SettledVia,
        c.PaymentReference,
        c.WaiverReason,
        c.RemindersSent,
        c.LastReminderAtUtc,
        c.CreatedAtUtc);

    private static bool TryParseStatus(string? status, out GarageCommissionStatus parsed)
    {
        parsed = default;
        return !string.IsNullOrWhiteSpace(status) && Enum.TryParse(status, true, out parsed) && Enum.IsDefined(parsed);
    }

    private async Task<string> NextCommissionNumberAsync(CancellationToken ct)
    {
        if (_context.Database.IsNpgsql())
        {
            try
            {
                var seq = await _context.Database
                    .SqlQueryRaw<long>("SELECT nextval('\"CommissionNumberSeq\"') AS \"Value\"")
                    .SingleAsync(ct);
                return $"COM-{seq}";
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Commission number sequence unavailable; using fallback counter.");
            }
        }
        return $"COM-{Interlocked.Increment(ref _fallbackCounter)}";
    }

    private static string Inr(decimal amount) => "₹" + amount.ToString("N2", System.Globalization.CultureInfo.GetCultureInfo("en-IN"));
}
