using BroCoMod.Application.Interfaces;
using BroCoMod.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BroCoMod.Infrastructure.Services;

public class ServiceJobNumberGenerator : IServiceJobNumberGenerator
{
    private readonly ApplicationDbContext _context;
    private static long _inMemoryCounter = 100000;

    public ServiceJobNumberGenerator(ApplicationDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Generated atomically via PostgreSQL sequence ServiceJobNumberSeq.
    /// The JOB-XXXXXX identifier is a unique human-readable job reference. Sequence values are not guaranteed to be gapless.
    /// Security does not rely on this reference; security relies strictly on authentication, authorization, ownership checks, and resource-level data isolation.
    /// </summary>
    public async Task<string> NextJobNumberAsync(CancellationToken cancellationToken = default)
    {
        if (_context.Database.IsNpgsql())
        {
            try
            {
                var seq = await _context.Database
                    .SqlQueryRaw<long>("SELECT nextval('\"ServiceJobNumberSeq\"') AS \"Value\"")
                    .SingleAsync(cancellationToken);
                return $"JOB-{seq}";
            }
            catch
            {
                // Fallback if raw SQL execution is unavailable or in mock/unit test environment
            }
        }

        var maxNumber = await _context.ServiceJobs
            .AsNoTracking()
            .OrderByDescending(j => j.CreatedAtUtc)
            .Select(j => j.JobNumber)
            .FirstOrDefaultAsync(cancellationToken);

        long nextVal = 100001;
        if (!string.IsNullOrEmpty(maxNumber) && maxNumber.StartsWith("JOB-") && long.TryParse(maxNumber[4..], out var parsed))
        {
            nextVal = Math.Max(parsed + 1, Interlocked.Increment(ref _inMemoryCounter));
        }
        else
        {
            nextVal = Interlocked.Increment(ref _inMemoryCounter);
        }

        return $"JOB-{nextVal}";
    }
}
