using System.Globalization;
using System.Threading.Channels;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace BroCoMod.Infrastructure.Services.Messaging;

public sealed record ExternalNotificationJob(
    Guid UserId,
    string Title,
    string Message,
    string Type,
    Guid? ReferenceId,
    string? ReferenceType);

/// <summary>
/// In-app notifications that the customer should also get by email / SMS (booking confirmed, quotation ready,
/// payment receipt). They are queued and sent in the background, so a slow or failing provider never slows
/// down or breaks the request that created them. Nothing is queued while email and SMS are both off.
/// </summary>
public sealed class ExternalNotificationQueue
{
    /// <summary>Types that also go out by email / SMS. Commission reminders are sent by CommissionService itself.</summary>
    public static readonly IReadOnlySet<string> ExternalTypes = new HashSet<string>(StringComparer.Ordinal)
    {
        EmailTemplates.BookingConfirmedType,
        EmailTemplates.QuoteReadyType,
        EmailTemplates.PaymentReceivedType,
        EmailTemplates.CommissionPaidType,
    };

    private readonly Channel<ExternalNotificationJob> _channel =
        Channel.CreateBounded<ExternalNotificationJob>(new BoundedChannelOptions(1000) { FullMode = BoundedChannelFullMode.DropOldest });
    private readonly IConfiguration _configuration;

    public ExternalNotificationQueue(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public ChannelReader<ExternalNotificationJob> Reader => _channel.Reader;

    public bool TryEnqueue(ExternalNotificationJob job)
    {
        if (!ExternalTypes.Contains(job.Type)) return false;
        if (!MessagingSettings.EmailConfigured(_configuration) && !MessagingSettings.SmsConfigured(_configuration)) return false;
        return _channel.Writer.TryWrite(job);
    }
}

public sealed class ExternalNotificationWorker : BackgroundService
{
    private static readonly CultureInfo India = CultureInfo.GetCultureInfo("en-IN");
    private readonly ExternalNotificationQueue _queue;
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<ExternalNotificationWorker> _logger;

    public ExternalNotificationWorker(ExternalNotificationQueue queue, IServiceScopeFactory scopes, ILogger<ExternalNotificationWorker> logger)
    {
        _queue = queue;
        _scopes = scopes;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await foreach (var job in _queue.Reader.ReadAllAsync(stoppingToken))
            {
                try
                {
                    using var timeout = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
                    timeout.CancelAfter(TimeSpan.FromSeconds(60));
                    await using var scope = _scopes.CreateAsyncScope();
                    await SendAsync(scope.ServiceProvider, job, timeout.Token);
                }
                catch (Exception ex) when (ex is not OperationCanceledException || !stoppingToken.IsCancellationRequested)
                {
                    _logger.LogWarning(ex, "Could not send the email/SMS copy of {Type} notification for user {UserId}", job.Type, job.UserId);
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
        }
    }

    public static async Task SendAsync(IServiceProvider services, ExternalNotificationJob job, CancellationToken ct)
    {
        var context = services.GetRequiredService<IApplicationDbContext>();

        // Booking / quotation / payment messages are written for the customer; garage staff get only the in-app copy.
        var isCustomer = await context.CustomerProfiles.AsNoTracking().AnyAsync(c => c.UserId == job.UserId, ct);
        if (job.Type != EmailTemplates.CommissionPaidType && !isCustomer) return;

        var data = await BuildDataAsync(context, job, ct);
        var message = new NotificationMessage(job.UserId, job.Title, job.Message, job.Type, NotificationChannel.Email,
            job.ReferenceId, job.ReferenceType, Data: data);

        foreach (var provider in services.GetServices<INotificationProvider>()
                     .Where(p => p.Channel is NotificationChannel.Email or NotificationChannel.Sms))
        {
            // Commission payments are receipts for the garage: email only.
            if (job.Type == EmailTemplates.CommissionPaidType && provider.Channel == NotificationChannel.Sms) continue;
            await provider.SendAsync(message with { Channel = provider.Channel }, ct);
        }
    }

    private static async Task<IReadOnlyDictionary<string, string>> BuildDataAsync(IApplicationDbContext context, ExternalNotificationJob job, CancellationToken ct)
    {
        var data = new Dictionary<string, string>();
        if (job.ReferenceId is not { } id) return data;

        switch (job.ReferenceType)
        {
            case "ServiceRequest":
            {
                var request = await context.ServiceRequests.AsNoTracking().Where(r => r.Id == id)
                    .Select(r => new { r.RequestNumber, r.VehicleMake, r.VehicleModel }).FirstOrDefaultAsync(ct);
                if (request is null) break;
                data["requestNumber"] = request.RequestNumber;
                data["vehicle"] = $"{request.VehicleMake} {request.VehicleModel}".Trim();
                break;
            }
            case "CustomerQuotation":
            {
                var quotation = await context.CustomerQuotations.AsNoTracking().Where(q => q.Id == id)
                    .Select(q => new { q.QuotationNumber, RequestNumber = q.ServiceRequest != null ? q.ServiceRequest.RequestNumber : null })
                    .FirstOrDefaultAsync(ct);
                if (quotation is null) break;
                data["quotationNumber"] = quotation.QuotationNumber;
                if (quotation.RequestNumber is not null) data["requestNumber"] = quotation.RequestNumber;
                break;
            }
            case "Payment":
            {
                var payment = await context.Payments.AsNoTracking().Where(p => p.Id == id)
                    .Select(p => new { p.PaymentNumber, p.Amount, p.PaidAtUtc, p.ServiceRequestId, p.GarageCommissionId })
                    .FirstOrDefaultAsync(ct);
                if (payment is null) break;
                data["paymentNumber"] = payment.PaymentNumber;
                data["amount"] = payment.Amount.ToString(payment.Amount == decimal.Truncate(payment.Amount) ? "N0" : "N2", India);
                if (payment.PaidAtUtc is { } paid)
                {
                    data["paidOn"] = TimeZoneInfo.ConvertTimeFromUtc(paid, IndiaTimeZone()).ToString("d MMM yyyy, h:mm tt", India) + " IST";
                }
                var requestNumber = payment.ServiceRequestId is { } srId
                    ? await context.ServiceRequests.AsNoTracking().Where(r => r.Id == srId).Select(r => r.RequestNumber).FirstOrDefaultAsync(ct)
                    : null;
                data["purpose"] = requestNumber is not null ? $"booking {requestNumber}"
                    : payment.GarageCommissionId is not null ? "BroCo commission"
                    : $"payment {payment.PaymentNumber}";
                break;
            }
        }
        return data;
    }

    private static TimeZoneInfo IndiaTimeZone()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata"); }
        catch (TimeZoneNotFoundException) { return TimeZoneInfo.FindSystemTimeZoneById("India Standard Time"); }
    }
}
