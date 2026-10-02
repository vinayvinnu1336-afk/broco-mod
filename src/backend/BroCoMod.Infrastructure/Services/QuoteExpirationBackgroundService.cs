using BroCoMod.Application.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace BroCoMod.Infrastructure.Services;

/// <summary>
/// Hosted background service that periodically checks and marks expired garage quotations.
/// Prevents stale or expired quotations from remaining active in the advisor workbench.
/// </summary>
public class QuoteExpirationBackgroundService : BackgroundService
{
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
                var quoteService = scope.ServiceProvider.GetRequiredService<IGarageQuoteService>();

                var expiredCount = await quoteService.ExpireStaleQuotesAsync(stoppingToken);
                if (expiredCount > 0)
                {
                    _logger.LogInformation("QuoteExpirationBackgroundService expired {Count} stale quotes.", expiredCount);
                }

                var dbContext = scope.ServiceProvider.GetRequiredService<Persistence.ApplicationDbContext>();
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
}
