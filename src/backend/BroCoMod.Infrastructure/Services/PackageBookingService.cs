using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Enums;
using BroCoMod.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BroCoMod.Infrastructure.Services;

/// <summary>
/// A package booking already has an agreed price and a paid advance, so there is no bidding:
/// the advisor picks a garage and the system records the fixed-price quote, the (pre-accepted)
/// customer quotation and the service job in one transaction.
/// </summary>
public class PackageBookingService : IPackageBookingService
{
    private readonly ApplicationDbContext _context;
    private readonly IQuoteNumberGenerator _quoteNumbers;
    private readonly ICustomerQuotationNumberGenerator _quotationNumbers;
    private readonly IServiceJobNumberGenerator _jobNumbers;
    private readonly ICommissionService _commissions;
    private readonly INotificationService _notifications;
    private readonly IAuditService _audit;
    private readonly ILogger<PackageBookingService> _logger;
    private readonly IGarageMatchingService _matching;

    public PackageBookingService(
        ApplicationDbContext context,
        IQuoteNumberGenerator quoteNumbers,
        ICustomerQuotationNumberGenerator quotationNumbers,
        IServiceJobNumberGenerator jobNumbers,
        ICommissionService commissions,
        INotificationService notifications,
        IAuditService audit,
        ILogger<PackageBookingService> logger,
        IGarageMatchingService matching)
    {
        _matching = matching;
        _context = context;
        _quoteNumbers = quoteNumbers;
        _quotationNumbers = quotationNumbers;
        _jobNumbers = jobNumbers;
        _commissions = commissions;
        _notifications = notifications;
        _audit = audit;
        _logger = logger;
    }

    /// <summary>Garages near the customer: the ones notified at booking, or (if none) any within 25 km.</summary>
    public async Task<IReadOnlyList<PackageGarageCandidateDto>> GetCandidateGaragesAsync(Guid serviceRequestId, CancellationToken ct = default)
    {
        var request = await _context.ServiceRequests.AsNoTracking()
            .Include(r => r.GarageRequests).ThenInclude(gr => gr.Garage)
            .FirstOrDefaultAsync(r => r.Id == serviceRequestId, ct)
            ?? throw new KeyNotFoundException("Service request not found.");

        var candidates = request.GarageRequests
            .Where(gr => gr.Garage != null && gr.Garage.IsActive && gr.Garage.IsVerified)
            .Select(gr => (gr.Garage!.Id, gr.Garage.Name, gr.Garage.Address, gr.Garage.PhoneNumber, gr.DistanceKm))
            .ToList();

        if (candidates.Count == 0)
        {
            var nearby = await _matching.FindEligibleGaragesAsync(request.CustomerLocation, 25, ct);
            candidates = nearby.Select(g => (g.GarageId, g.GarageName, g.Address, g.PhoneNumber, g.DistanceKm)).ToList();
        }

        var result = new List<PackageGarageCandidateDto>();
        foreach (var c in candidates.OrderBy(c => c.DistanceKm))
        {
            result.Add(new PackageGarageCandidateDto(c.Item1, c.Name, c.Address, c.PhoneNumber, Math.Round(c.DistanceKm, 1),
                await _commissions.IsGarageBlockedForNewJobsAsync(c.Item1, ct)));
        }
        return result;
    }

    public async Task<PackageAssignmentResultDto> AssignGarageAsync(Guid serviceRequestId, Guid garageId, Guid advisorUserId, string? reason, CancellationToken ct = default)
    {
        var request = await _context.ServiceRequests
            .Include(r => r.GarageRequests)
            .Include(r => r.CustomerProfile)
            .FirstOrDefaultAsync(r => r.Id == serviceRequestId, ct)
            ?? throw new KeyNotFoundException("Service request not found.");

        if (!request.IsPackageBooking || request.PackagePrice is not > 0)
            throw new InvalidOperationException("This is not a fixed-price package booking. Use the garage quotes to assign it.");
        if (request.Status == ServiceRequestStatus.Cancelled)
            throw new InvalidOperationException("This request was cancelled.");
        if (!request.IsAdvancePaid)
            throw new InvalidOperationException("The customer hasn't paid the booking advance yet.");

        var hasActiveAssignment = await _context.GarageAssignments.AnyAsync(a =>
            a.ServiceRequestId == serviceRequestId &&
            (a.Status == GarageAssignmentStatus.Assigned || a.Status == GarageAssignmentStatus.Confirmed), ct);
        if (hasActiveAssignment)
            throw new InvalidOperationException("A garage is already assigned to this booking.");

        var garage = await _context.Garages.FirstOrDefaultAsync(g => g.Id == garageId, ct)
            ?? throw new KeyNotFoundException("Garage not found.");
        if (!garage.IsActive || !garage.IsVerified)
            throw new InvalidOperationException($"{garage.Name} is not an active, verified garage.");
        if (await _commissions.IsGarageBlockedForNewJobsAsync(garage.Id, ct))
            throw new InvalidOperationException($"{garage.Name} has overdue BroCo commission and can't take new jobs until it's paid.");

        var price = request.PackagePrice.Value;
        var description = $"{request.ServicePackageName} — {request.VehicleMake} {request.VehicleModel}" +
                          (string.IsNullOrWhiteSpace(request.VehicleFuel) ? string.Empty : $" ({request.VehicleFuel})");
        var customerUserId = request.CustomerProfile?.UserId ?? request.CustomerId;

        var quoteNumber = await _quoteNumbers.GenerateNextQuoteNumberAsync(ct);
        var quotationNumber = await _quotationNumbers.NextCustomerQuotationNumberAsync(ct);
        var jobNumber = await _jobNumbers.NextJobNumberAsync(ct);

        ServiceJob job = null!;
        CustomerQuotation quotation = null!;
        var strategy = _context.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await _context.Database.BeginTransactionAsync(ct);

            var garageRequest = request.GarageRequests.FirstOrDefault(gr => gr.GarageId == garage.Id);
            if (garageRequest == null)
            {
                var distance = ServiceAreaService.DistanceKm(request.CustomerLocation.Y, request.CustomerLocation.X, garage.Location.Y, garage.Location.X);
                garageRequest = new GarageRequest(request.Id, garage.Id, Math.Round(distance, 2));
                _context.GarageRequests.Add(garageRequest);
            }
            garageRequest.Accept();

            // Fixed-price quote recorded on the garage's behalf
            var quote = new GarageQuote(garageRequest.Id, garage.Id, request.Id, quoteNumber, "INR",
                DateTime.UtcNow.AddDays(7), garageRemarks: "Fixed-price BroCo service package", createdByUserId: advisorUserId);
            quote.AddLineItem(QuoteLineType.Service, description, 1, price);
            quote.Submit(advisorUserId);
            quote.MarkSelectedByAdvisor();
            _context.GarageQuotes.Add(quote);

            var assignment = new GarageAssignment(request.Id, garage.Id, quote.Id, advisorUserId,
                string.IsNullOrWhiteSpace(reason) ? "Package booking" : reason);
            _context.GarageAssignments.Add(assignment);

            // Customer agreed to this price when booking and paying the advance
            quotation = new CustomerQuotation(request.Id, assignment.Id, garage.Id, advisorUserId, quotationNumber,
                description, "Fixed-price package booked online.", DateTime.UtcNow.AddDays(7));
            _context.CustomerQuotations.Add(quotation);
            var line = new CustomerQuotationLineItem(quotation.Id, QuoteLineType.Service, description, 1, price, taxRate: 0m);
            _context.CustomerQuotationLineItems.Add(line);
            quotation.RecalculateTotals();
            quotation.Send(advisorUserId);
            var version = CustomerQuotationService.AddVersionSnapshot(_context, quotation, advisorUserId);
            quotation.Accept(version.Id);
            assignment.Confirm();
            request.ConfirmBooking();

            _context.CustomerQuotationDecisions.Add(new CustomerQuotationDecision(
                quotation.Id, version.Id, version.VersionNumber, customerUserId, CustomerDecisionType.Accepted,
                decisionReason: "Accepted at booking (fixed-price package, advance paid)."));

            job = new ServiceJob(request.Id, assignment.Id, quotation.Id, garage.Id, jobNumber, request.ProblemDescription, advisorUserId);
            _context.ServiceJobs.Add(job);
            _context.ServiceJobActivities.Add(new ServiceJobActivity(job.Id, JobActivityType.JobCreated,
                $"Booking confirmed with {garage.Name}. {request.ServicePackageName} at ₹{price:N0}; BroCo advance ₹{request.AdvancePaidAmount:N0} paid.",
                isCustomerVisible: true, createdByUserId: advisorUserId));

            if (request.AdvancePaymentId.HasValue)
            {
                var advance = await _context.Payments.FirstOrDefaultAsync(p => p.Id == request.AdvancePaymentId.Value, ct);
                advance?.AttachToGarageJob(garage.Id, job.Id, quotation.Id);
            }

            await _context.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        });

        await _audit.LogAsync(
            action: "PACKAGE_GARAGE_ASSIGNED",
            userId: advisorUserId,
            entityName: nameof(ServiceRequest),
            entityId: request.Id.ToString(),
            details: $"{request.RequestNumber}: {request.ServicePackageName} assigned to {garage.Name}, job {job.JobNumber}.",
            cancellationToken: ct);

        await _notifications.SendInAppNotificationAsync(customerUserId, "Booking confirmed",
            $"Your {request.ServicePackageName} is booked at {garage.Name}. Pay the balance of ₹{price - request.AdvancePaidAmount:N0} at the garage after the service.",
            "BookingConfirmed", request.Id, nameof(ServiceRequest), cancellationToken: ct);

        var garageUserIds = await _context.GarageUsers.AsNoTracking()
            .Where(gu => gu.GarageId == garage.Id).Select(gu => gu.UserId).ToListAsync(ct);
        foreach (var userId in garageUserIds)
        {
            await _notifications.SendInAppNotificationAsync(userId, "New package job",
                $"{job.JobNumber}: {description} at ₹{price:N0}. Customer pays you ₹{price - request.AdvancePaidAmount:N0} at handover.",
                "NewJob", job.Id, nameof(ServiceJob), cancellationToken: ct);
        }

        return new PackageAssignmentResultDto(request.Id, garage.Id, garage.Name, job.Id, job.JobNumber, quotation.Id, price);
    }
}
