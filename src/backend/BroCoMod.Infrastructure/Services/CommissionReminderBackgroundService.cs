using BroCoMod.Application.Interfaces;
using BroCoMod.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace BroCoMod.Infrastructure.Services;

/// <summary>
/// Reminds garages about unpaid BroCo commission (in-app + SMS/email/WhatsApp providers) every
/// <c>Commission:ReminderIntervalHours</c>. One API replica runs each sweep (advisory lock).
/// </summary>
public class CommissionReminderBackgroundService : BackgroundService
{
    private const long ReminderJobLockKey = 0x42_52_4F_43_4F_4D_03;

    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<CommissionReminderBackgroundService> _logger;
    private readonly TimeSpan _checkInterval = TimeSpan.FromMinutes(15);

    public CommissionReminderBackgroundService(IServiceProvider serviceProvider, ILogger<CommissionReminderBackgroundService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Let startup migrations finish before the first sweep.
        try { await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken); }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var lockContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                if (await DatabaseStartup.TryAcquireJobLockAsync(lockContext, ReminderJobLockKey, stoppingToken))
                {
                    try
                    {
                        var sent = await scope.ServiceProvider.GetRequiredService<ICommissionService>().SendDueRemindersAsync(stoppingToken);
                        if (sent > 0) _logger.LogInformation("Sent {Count} commission reminder(s).", sent);
                    }
                    finally
                    {
                        await DatabaseStartup.ReleaseJobLockAsync(lockContext, ReminderJobLockKey);
                    }
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Commission reminder sweep failed.");
            }

            try { await Task.Delay(_checkInterval, stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }
}
