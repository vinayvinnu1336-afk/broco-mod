using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace BroCoMod.Infrastructure.Persistence;

/// <summary>
/// Applies migrations and seed data exactly once even when several API replicas start together,
/// by holding a PostgreSQL session-level advisory lock for the duration of the work.
/// </summary>
public static class DatabaseStartup
{
    // Arbitrary application-wide key; any 64-bit constant unique to this app works.
    private const long MigrationLockKey = 0x42_52_4F_43_4F_4D_01;

    public static async Task MigrateAndSeedAsync(ApplicationDbContext db, IServiceProvider services, ILogger logger, CancellationToken cancellationToken = default)
    {
        if (!db.Database.IsNpgsql())
        {
            await db.Database.MigrateAsync(cancellationToken);
            await services.GetRequiredService<DatabaseSeeder>().SeedAsync();
            return;
        }

        var connection = db.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
        {
            await db.Database.OpenConnectionAsync(cancellationToken);
        }

        try
        {
            logger.LogInformation("Waiting for database migration lock...");
            await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_lock({0})", new object[] { MigrationLockKey }, cancellationToken);

            logger.LogInformation("Applying EF Core migrations...");
            await db.Database.MigrateAsync(cancellationToken);
            logger.LogInformation("Database migrations applied successfully.");

            await services.GetRequiredService<DatabaseSeeder>().SeedAsync();
        }
        finally
        {
            await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_unlock({0})", new object[] { MigrationLockKey }, CancellationToken.None);
            await db.Database.CloseConnectionAsync();
        }
    }

    /// <summary>
    /// Tries to take a transaction-independent advisory lock without waiting. Used by background jobs so
    /// that only one replica performs a given periodic job at a time. Returns false if another replica holds it.
    /// </summary>
    public static async Task<bool> TryAcquireJobLockAsync(ApplicationDbContext db, long key, CancellationToken cancellationToken)
    {
        if (!db.Database.IsNpgsql())
        {
            return true;
        }

        await db.Database.OpenConnectionAsync(cancellationToken);
        var acquired = await db.Database
            .SqlQueryRaw<bool>("SELECT pg_try_advisory_lock({0}) AS \"Value\"", key)
            .SingleAsync(cancellationToken);
        return acquired;
    }

    public static async Task ReleaseJobLockAsync(ApplicationDbContext db, long key)
    {
        if (!db.Database.IsNpgsql())
        {
            return;
        }

        await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_unlock({0})", new object[] { key }, CancellationToken.None);
        await db.Database.CloseConnectionAsync();
    }
}
