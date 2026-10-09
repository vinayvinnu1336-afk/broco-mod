using BroCoMod.Application.Interfaces;
using BroCoMod.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace BroCoMod.Infrastructure.Services;

/// <summary>
/// Hosted background service that periodically checks and marks expired garage quotations.
/// Prevents stale or expired quotations from remaining active in the advisor workbench.
/// When several API replicas run, a PostgreSQL advisory lock ensures only one performs each sweep.
/// </summary>
public class QuoteExpirationBackgroundService : BackgroundService
{
    private const long ExpirationJobLockKey = 0x42_52_4F_43_4F_4D_02;

    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<QuoteExpirationBackgroundService> _logger;
    private readonly TimeSpan _checkInterval = TimeSpan.FromMinutes(15);

    public QuoteExpirationBackgroundService(
        IServiceProvider serviceProvider,
        ILogger<QuoteExpirationBackgroundService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("QuoteExpirationBackgroundService started. Check interval: {Interval}", _checkInterval);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var lockContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                if (await DatabaseStartup.TryAcquireJobLockAsync(lockContext, ExpirationJobLockKey, stoppingToken))
                {
                    try
                    {
                        await RunSweepAsync(scope.ServiceProvider, stoppingToken);
                    }
                    finally
                    {
                        await DatabaseStartup.ReleaseJobLockAsync(lockContext, ExpirationJobLockKey);
                    }
                }
                else
                {
                    _logger.LogDebug("Quote expiration sweep skipped: another instance holds the job lock.");
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred during quote expiration background execution.");
            }

            try
            {
                await Task.Delay(_checkInterval, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }

        _logger.LogInformation("QuoteExpirationBackgroundService stopped.");
    }

    private async Task RunSweepAsync(IServiceProvider services, CancellationToken stoppingToken)
    {
        var quoteService = services.GetRequiredService<IGarageQuoteService>();

        var expiredCount = await quoteService.ExpireStaleQuotesAsync(stoppingToken);
        if (expiredCount > 0)
        {
            _logger.LogInformation("QuoteExpirationBackgroundService expired {Count} stale quotes.", expiredCount);
        }

        var dbContext = services.GetRequiredService<ApplicationDbContext>();
        var now = DateTime.UtcNow;
        var staleCustomerQuotes = await dbContext.CustomerQuotations
            .Where(cq => (cq.Status == Domain.Enums.CustomerQuotationStatus.Draft ||
                          cq.Status == Domain.Enums.CustomerQuotationStatus.ReadyToSend ||
                          cq.Status == Domain.Enums.CustomerQuotationStatus.Sent) &&
                         cq.ValidUntilUtc < now)
            .ToListAsync(stoppingToken);

        if (staleCustomerQuotes.Count > 0)
        {
            foreach (var cq in staleCustomerQuotes)
            {
                cq.Expire();
            }
            await dbContext.SaveChangesAsync(stoppingToken);
            _logger.LogInformation("QuoteExpirationBackgroundService expired {Count} stale customer quotations.", staleCustomerQuotes.Count);
        }
    }
}
