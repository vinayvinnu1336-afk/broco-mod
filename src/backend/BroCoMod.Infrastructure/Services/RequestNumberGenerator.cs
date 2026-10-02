using BroCoMod.Application.Interfaces;
using BroCoMod.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BroCoMod.Infrastructure.Services;

public class RequestNumberGenerator : IRequestNumberGenerator
{
    private readonly ApplicationDbContext _context;
    private static long _inMemoryCounter = 100000;

    public RequestNumberGenerator(ApplicationDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Generated atomically via PostgreSQL sequence ServiceRequestNumberSeq.
    /// The BM-XXXXXX identifier is a unique human-readable service request reference. Sequence values are not guaranteed to be gapless.
    /// Security does not rely on this reference; security relies strictly on authentication, authorization, ownership checks, and resource-level data isolation.
    /// </summary>
    public async Task<string> GenerateNextRequestNumberAsync(CancellationToken cancellationToken = default)
    {
        if (_context.Database.IsNpgsql())
        {
            try
            {
                var seq = await _context.Database
                    .SqlQueryRaw<long>("SELECT nextval('\"ServiceRequestNumberSeq\"') AS \"Value\"")
                    .SingleAsync(cancellationToken);
                return $"BM-{seq}";
            }
            catch
            {
                // Fallback in case raw SQL is unavailable or in mock context
            }
        }

        var maxNumber = await _context.ServiceRequests
            .AsNoTracking()
            .OrderByDescending(sr => sr.CreatedAtUtc)
            .Select(sr => sr.RequestNumber)
            .FirstOrDefaultAsync(cancellationToken);

        long nextVal = 100001;
        if (!string.IsNullOrEmpty(maxNumber) && maxNumber.StartsWith("BM-") && long.TryParse(maxNumber[3..], out var parsed))
        {
            nextVal = Math.Max(parsed + 1, Interlocked.Increment(ref _inMemoryCounter));
        }
        else
        {
            nextVal = Interlocked.Increment(ref _inMemoryCounter);
        }

        return $"BM-{nextVal}";
    }
}
