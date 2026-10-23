using BroCoMod.Application.Common;
using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Constants;
using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Enums;
using BroCoMod.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BroCoMod.Infrastructure.Services;

/// <summary>
/// Owner's rule: nobody but BroCo cancels a booking once the customer has paid anything. The customer may
/// cancel their own request before any payment; a super admin can cancel at any stage until the job is
/// closed. Cancelling ends the request, its job, assignment and quotations together, waives a commission
/// that is still due, and never refunds by itself: the admin refunds from Admin → Payments.
/// </summary>
public class BookingCancellationService : IBookingCancellationService
{
    public const string BookingCancelledNotification = "BOOKING_CANCELLED";
    public const string CancellationAskedNotification = "JOB_CANCELLATION_REQUESTED";

    private static readonly PaymentStatus[] MoneyReceived =
    {
        PaymentStatus.Paid, PaymentStatus.RefundPending, PaymentStatus.PartiallyRefunded, PaymentStatus.Refunded
    };

    // Before the car reaches the garage; after this a customer must go through support.
    private static readonly ServiceJobStatus[] BeforeIntake = { ServiceJobStatus.BookingConfirmed, ServiceJobStatus.Scheduled };

    private readonly ApplicationDbContext _context;
    private readonly INotificationService _notifications;
    private readonly IAuditService _audit;

    public BookingCancellationService(ApplicationDbContext context, INotificationService notifications, IAuditService audit)
    {
        _context = context;
        _notifications = notifications;
        _audit = audit;
    }

    // ---------------- Customer ----------------

    public async Task CancelByCustomerAsync(Guid customerIdOrUserId, Guid requestId, string reason, CancellationToken cancellationToken = default)
    {
        var profile = await _context.CustomerProfiles.AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.Id == customerIdOrUserId || cp.UserId == customerIdOrUserId, cancellationToken);
        var customerId = profile?.Id ?? customerIdOrUserId;

        var request = await _context.ServiceRequests
            .FirstOrDefaultAsync(sr => sr.Id == requestId && sr.CustomerId == customerId, cancellationToken)
            ?? throw new KeyNotFoundException($"Service request with ID '{requestId}' was not found or is unauthorized.");

        if (request.Status == ServiceRequestStatus.Cancelled)
            throw new InvalidOperationException("Request is already cancelled.");

        var jobs = await OpenJobsAsync(request.Id, cancellationToken);
        var payments = await PaymentsAsync(request.Id, jobs.Select(j => j.Id).ToList(), cancellationToken);
        if (request.IsAdvancePaid || payments.Any(p => MoneyReceived.Contains(p.Status)))
            throw new CancellationNotAllowedException(BookingCancellationRules.CustomerAfterPaymentMessage);
        if (jobs.Any(j => !BeforeIntake.Contains(j.Status)))
            throw new CancellationNotAllowedException(BookingCancellationRules.CustomerCarAtGarageMessage);

        var trimmed = CleanReason(reason, required: false) ?? "Cancelled by customer";
        var actorUserId = profile?.UserId ?? customerIdOrUserId;
        await CascadeAsync(request, jobs, trimmed, actorUserId, byAdmin: false, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        await _audit.LogAsync(
            action: "SERVICE_REQUEST_STATUS_CHANGED",
            userId: actorUserId,
            entityName: nameof(ServiceRequest),
            entityId: request.Id.ToString(),
            details: $"Status changed to Cancelled by the customer before any payment. Reason: {trimmed}",
            cancellationToken: cancellationToken);

        var message = $"The customer cancelled {request.RequestNumber} before paying. Reason: {trimmed}";
        await NotifyAdvisorAsync(request, $"Booking cancelled: {request.RequestNumber}", message, cancellationToken);
        await NotifyGarageAsync(request, jobs, message, cancellationToken);
    }

    // ---------------- Admin ----------------

    public async Task<AdminBookingCancellationDto> GetAdminCancellationAsync(Guid requestId, CancellationToken cancellationToken = default)
    {
        var request = await _context.ServiceRequests.AsNoTracking().FirstOrDefaultAsync(sr => sr.Id == requestId, cancellationToken)
            ?? throw new KeyNotFoundException($"Service request {requestId} not found.");
        return await BuildSummaryAsync(request, cancellationToken);
    }

    public async Task<AdminBookingCancellationDto> CancelByAdminAsync(Guid requestId, Guid adminUserId, string reason, CancellationToken cancellationToken = default)
    {
        var trimmed = CleanReason(reason, required: true)!;

        var request = await _context.ServiceRequests
            .Include(sr => sr.CustomerProfile)
            .FirstOrDefaultAsync(sr => sr.Id == requestId, cancellationToken)
            ?? throw new KeyNotFoundException($"Service request {requestId} not found.");

        var before = await BuildSummaryAsync(request, cancellationToken);
        if (!before.CanCancel)
            throw new InvalidOperationException(before.CannotCancelReason ?? "This booking can't be cancelled.");

        var jobs = await OpenJobsAsync(request.Id, cancellationToken);
        await CascadeAsync(request, jobs, trimmed, adminUserId, byAdmin: true, cancellationToken);

        // A cancelled job owes BroCo nothing; one already paid is left for the admin to settle.
        var jobIds = jobs.Select(j => j.Id).ToList();
        var dueCommissions = await _context.GarageCommissions
            .Where(c => jobIds.Contains(c.ServiceJobId) && c.Status == GarageCommissionStatus.Due)
            .ToListAsync(cancellationToken);
        foreach (var commission in dueCommissions)
            commission.Waive($"Booking {request.RequestNumber} cancelled by BroCo: {trimmed}", adminUserId);

        await _context.SaveChangesAsync(cancellationToken);

        await _audit.LogAsync(
            action: "SERVICE_REQUEST_CANCELLED_BY_ADMIN",
            userId: adminUserId,
            entityName: nameof(ServiceRequest),
            entityId: request.Id.ToString(),
            details: $"{request.RequestNumber} cancelled by admin" +
                     (before.JobNumber != null ? $" (job {before.JobNumber}, was {before.JobStatus})" : string.Empty) +
                     $". Paid online {Inr(before.PaidOnline)}, refunded so far {Inr(before.RefundedSoFar)}; no automatic refund. Reason: {trimmed}",
            cancellationToken: cancellationToken);
        foreach (var commission in dueCommissions)
        {
            await _audit.LogAsync(
                action: "GARAGE_COMMISSION_WAIVED",
                userId: adminUserId,
                entityName: nameof(GarageCommission),
                entityId: commission.Id.ToString(),
                details: $"Waived {commission.CommissionNumber} ({Inr(commission.TotalDue)}) because booking {request.RequestNumber} was cancelled.",
                cancellationToken: cancellationToken);
        }

        var customerUserId = request.CustomerProfile?.UserId;
        if (customerUserId.HasValue)
        {
            var refundNote = before.RefundableNow > 0
                ? $" You paid {Inr(before.RefundableNow)} online; our team will contact you about the refund as per the Cancellation & Refund Policy."
                : string.Empty;
            await _notifications.SendInAppNotificationAsync(
                customerUserId.Value,
                "Booking cancelled",
                $"BroCo has cancelled your booking {request.RequestNumber}. Reason: {trimmed}.{refundNote}",
                BookingCancelledNotification,
                request.Id,
                nameof(ServiceRequest),
                cancellationToken: cancellationToken);
        }

        var staffMessage = $"BroCo cancelled {request.RequestNumber}" +
                           (before.JobNumber != null ? $" (job {before.JobNumber})" : string.Empty) + $". Reason: {trimmed}";
        await NotifyAdvisorAsync(request, $"Booking cancelled: {request.RequestNumber}", staffMessage, cancellationToken);
        await NotifyGarageAsync(request, jobs, staffMessage + ". Please stop any work on it.", cancellationToken);

        return await BuildSummaryAsync(request, cancellationToken);
    }

    // ---------------- Garage ----------------

    public async Task<GarageCancellationAskResultDto> AskBroCoToCancelAsync(Guid jobId, Guid garageId, Guid userId, string reason, CancellationToken cancellationToken = default)
    {
        var trimmed = CleanReason(reason, required: true)!;

        var job = await _context.ServiceJobs.AsNoTracking()
            .Include(j => j.ServiceRequest)
            .Include(j => j.Garage)
            .FirstOrDefaultAsync(j => j.Id == jobId, cancellationToken)
            ?? throw new KeyNotFoundException("Service job not found.");
        if (job.GarageId != garageId)
            throw new UnauthorizedAccessException("This job belongs to another garage.");
        if (job.Status is ServiceJobStatus.Cancelled or ServiceJobStatus.Closed)
            throw new InvalidOperationException($"This job is already {job.Status.ToString().ToLowerInvariant()}.");

        var recipients = await _context.Users.AsNoTracking()
            .Where(u => u.IsActive && u.UserRoles.Any(ur => ur.Role.Name == AppRoles.SuperAdmin))
            .Select(u => u.Id)
            .ToListAsync(cancellationToken);
        var advisorUserId = await AdvisorUserIdAsync(job.ServiceRequest?.AssignedAdvisorId, cancellationToken);
        if (advisorUserId.HasValue && !recipients.Contains(advisorUserId.Value))
            recipients.Add(advisorUserId.Value);

        var requestNumber = job.ServiceRequest?.RequestNumber ?? job.JobNumber;
        var garageName = job.Garage?.Name ?? "The garage";
        foreach (var recipient in recipients)
        {
            await _notifications.SendInAppNotificationAsync(
                recipient,
                $"Garage asks to reassign or cancel {job.JobNumber}",
                $"{garageName} can't continue with {requestNumber} (job {job.JobNumber}, {job.Status}). Reason: {trimmed}",
                CancellationAskedNotification,
                job.ServiceRequestId,
                nameof(ServiceRequest),
                cancellationToken: cancellationToken);
        }

        await _audit.LogAsync(
            action: "SERVICE_JOB_CANCELLATION_REQUESTED",
            userId: userId,
            entityName: nameof(ServiceJob),
            entityId: job.Id.ToString(),
            details: $"{garageName} asked BroCo to reassign or cancel job {job.JobNumber} ({requestNumber}). Reason: {trimmed}",
            cancellationToken: cancellationToken);

        return new GarageCancellationAskResultDto(job.Id, job.JobNumber, recipients.Count);
    }

    // ---------------- Shared ----------------

    /// <summary>Ends the request and everything still open under it, using each entity's own rules.</summary>
    private async Task CascadeAsync(ServiceRequest request, List<ServiceJob> jobs, string reason, Guid actorUserId, bool byAdmin, CancellationToken ct)
    {
        request.Cancel(reason, allowAfterCompletion: byAdmin);

        foreach (var job in jobs)
        {
            if (byAdmin) job.CancelByAdmin(reason, actorUserId);
            else job.Cancel(reason, actorUserId);

            _context.ServiceJobActivities.Add(new ServiceJobActivity(
                job.Id,
                JobActivityType.JobCancelled,
                byAdmin ? $"Booking cancelled by BroCo. Reason: {reason}" : $"Booking cancelled by the customer. Reason: {reason}",
                isCustomerVisible: true,
                createdByUserId: actorUserId));
        }

        var jobIds = jobs.Select(j => j.Id).ToList();
        var pendingExtraWork = await _context.AdditionalWorkRequests
            .Where(a => jobIds.Contains(a.ServiceJobId) && a.Status == AdditionalWorkStatus.PendingAdvisorReview)
            .ToListAsync(ct);
        foreach (var work in pendingExtraWork) work.Cancel(actorUserId);

        var assignments = await _context.GarageAssignments
            .Where(a => a.ServiceRequestId == request.Id &&
                        (a.Status == GarageAssignmentStatus.Assigned || a.Status == GarageAssignmentStatus.Confirmed))
            .ToListAsync(ct);
        foreach (var assignment in assignments) assignment.CancelWithBooking(reason, actorUserId);

        var quotations = await _context.CustomerQuotations.Where(q => q.ServiceRequestId == request.Id).ToListAsync(ct);
        foreach (var quotation in quotations) quotation.CancelWithBooking(reason);

        // Garages still looking at the request see it as expired, and open quotes stop.
        var openDispatch = await _context.GarageRequests
            .Where(gr => gr.ServiceRequestId == request.Id &&
                         (gr.Status == GarageRequestStatus.Pending || gr.Status == GarageRequestStatus.Notified || gr.Status == GarageRequestStatus.Viewed))
            .ToListAsync(ct);
        foreach (var dispatch in openDispatch) dispatch.MarkExpired();

        var openQuotes = await _context.GarageQuotes
            .Where(q => q.ServiceRequestId == request.Id &&
                        (q.Status == QuoteStatus.Draft || q.Status == QuoteStatus.Submitted || q.Status == QuoteStatus.UnderReview))
            .ToListAsync(ct);
        foreach (var quote in openQuotes) quote.MarkExpired();
    }

    private async Task<AdminBookingCancellationDto> BuildSummaryAsync(ServiceRequest request, CancellationToken ct)
    {
        var allJobs = await _context.ServiceJobs.AsNoTracking()
            .Include(j => j.Garage)
            .Where(j => j.ServiceRequestId == request.Id)
            .OrderByDescending(j => j.CreatedAtUtc)
            .ToListAsync(ct);
        var job = allJobs.FirstOrDefault(j => j.Status != ServiceJobStatus.Cancelled) ?? allJobs.FirstOrDefault();

        var payments = await PaymentsAsync(request.Id, allJobs.Select(j => j.Id).ToList(), ct);
        var received = payments.Where(p => MoneyReceived.Contains(p.Status)).ToList();
        var paidOnline = received.Sum(p => p.Amount);
        var refunded = received.Sum(p => p.RefundedAmount);

        var commission = job == null
            ? null
            : await _context.GarageCommissions.AsNoTracking().FirstOrDefaultAsync(c => c.ServiceJobId == job.Id, ct);

        string? garageName = job?.Garage?.Name;
        if (garageName == null)
        {
            garageName = await _context.GarageAssignments.AsNoTracking()
                .Where(a => a.ServiceRequestId == request.Id &&
                            (a.Status == GarageAssignmentStatus.Assigned || a.Status == GarageAssignmentStatus.Confirmed))
                .OrderByDescending(a => a.AssignedAtUtc)
                .Select(a => a.Garage!.Name)
                .FirstOrDefaultAsync(ct);
        }

        var isCancelled = request.Status == ServiceRequestStatus.Cancelled;
        string? cannotCancel = isCancelled
            ? "This booking is already cancelled."
            // A booking is Completed from handover, but BroCo can still cancel it until the job is closed.
            : allJobs.Any(j => j.Status == ServiceJobStatus.Closed)
                ? "This job is closed, so it can no longer be cancelled."
                : request.Status == ServiceRequestStatus.Completed && allJobs.All(j => j.Status == ServiceJobStatus.Cancelled)
                    ? "This booking is completed, so it can no longer be cancelled."
                    : null;

        var currency = payments.FirstOrDefault()?.Currency ?? "INR";
        return new AdminBookingCancellationDto(
            request.Id,
            request.RequestNumber,
            request.Status.ToString(),
            isCancelled,
            cannotCancel == null,
            cannotCancel,
            request.CancelledAtUtc,
            request.CancellationReason,
            job?.Id,
            job?.JobNumber,
            job?.Status.ToString(),
            garageName,
            currency,
            paidOnline,
            refunded,
            Math.Max(0m, paidOnline - refunded),
            payments.Select(p => new BookingCancellationPaymentDto(
                p.Id, p.PaymentNumber, p.Purpose.ToString(), p.Status.ToString(), p.Amount, p.RefundedAmount, p.PaidAtUtc)).ToList(),
            commission?.CommissionNumber,
            commission?.Status.ToString(),
            commission?.TotalDue,
            $"/admin/payments?q={Uri.EscapeDataString(request.RequestNumber)}");
    }

    private Task<List<ServiceJob>> OpenJobsAsync(Guid requestId, CancellationToken ct) =>
        _context.ServiceJobs
            .Where(j => j.ServiceRequestId == requestId && j.Status != ServiceJobStatus.Cancelled)
            .ToListAsync(ct);

    /// <summary>Customer payments for the request (advance, extra work); garage commission payments are not the customer's.</summary>
    private async Task<List<Payment>> PaymentsAsync(Guid requestId, List<Guid> jobIds, CancellationToken ct)
    {
        var quotationIds = await _context.CustomerQuotations.AsNoTracking()
            .Where(q => q.ServiceRequestId == requestId)
            .Select(q => q.Id)
            .ToListAsync(ct);

        return await _context.Payments.AsNoTracking()
            .Where(p => p.Purpose != PaymentPurpose.GarageCommission &&
                        (p.ServiceRequestId == requestId ||
                         (p.CustomerQuotationId.HasValue && quotationIds.Contains(p.CustomerQuotationId.Value)) ||
                         (p.ServiceJobId.HasValue && jobIds.Contains(p.ServiceJobId.Value))))
            .OrderBy(p => p.CreatedAtUtc)
            .ToListAsync(ct);
    }

    private async Task NotifyAdvisorAsync(ServiceRequest request, string title, string message, CancellationToken ct)
    {
        var advisorUserId = await AdvisorUserIdAsync(request.AssignedAdvisorId, ct);
        if (advisorUserId == null) return;
        await _notifications.SendInAppNotificationAsync(advisorUserId.Value, title, message, BookingCancelledNotification,
            request.Id, nameof(ServiceRequest), cancellationToken: ct);
    }

    /// <summary>Tells the team of the garage that had the job (or the assignment) that it is off.</summary>
    private async Task NotifyGarageAsync(ServiceRequest request, List<ServiceJob> jobs, string message, CancellationToken ct)
    {
        var job = jobs.FirstOrDefault();
        var garageId = job?.GarageId ?? await _context.GarageAssignments.AsNoTracking()
            .Where(a => a.ServiceRequestId == request.Id && a.Status == GarageAssignmentStatus.Cancelled)
            .OrderByDescending(a => a.CancelledAtUtc)
            .Select(a => (Guid?)a.GarageId)
            .FirstOrDefaultAsync(ct);
        if (garageId == null) return;

        var garageUserIds = await _context.GarageUsers.AsNoTracking()
            .Where(gu => gu.GarageId == garageId.Value && gu.User.IsActive)
            .Select(gu => gu.UserId)
            .ToListAsync(ct);
        var title = job != null ? $"Booking cancelled: {job.JobNumber}" : $"Booking cancelled: {request.RequestNumber}";
        foreach (var userId in garageUserIds)
        {
            await _notifications.SendInAppNotificationAsync(userId, title, message, BookingCancelledNotification,
                job?.Id ?? request.Id, job != null ? nameof(ServiceJob) : nameof(ServiceRequest), cancellationToken: ct);
        }
    }

    private async Task<Guid?> AdvisorUserIdAsync(Guid? advisorProfileId, CancellationToken ct)
    {
        if (!advisorProfileId.HasValue) return null;
        return await _context.AdvisorProfiles.AsNoTracking()
            .Where(a => a.Id == advisorProfileId.Value)
            .Select(a => (Guid?)a.UserId)
            .FirstOrDefaultAsync(ct);
    }

    private static string? CleanReason(string? reason, bool required)
    {
        var trimmed = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
        if (trimmed == null && required)
            throw new ArgumentException("Add a reason for the cancellation.", nameof(reason));
        if (trimmed != null && trimmed.Length > BookingCancellationRules.ReasonMaxLength)
            throw new ArgumentException($"Keep the reason under {BookingCancellationRules.ReasonMaxLength} characters.", nameof(reason));
        return trimmed;
    }

    private static string Inr(decimal amount) => $"₹{amount:N2}";
}
