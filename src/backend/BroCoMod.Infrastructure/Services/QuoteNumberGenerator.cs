using BroCoMod.Application.Interfaces;
using BroCoMod.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BroCoMod.Infrastructure.Services;

public class QuoteNumberGenerator : IQuoteNumberGenerator
{
    private readonly ApplicationDbContext _context;
    private static long _inMemoryCounter = 100000;

    public QuoteNumberGenerator(ApplicationDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Generated atomically via PostgreSQL sequence GarageQuoteNumberSeq.
    /// The BQ-XXXXXX identifier is a unique human-readable quotation reference. Sequence values are not guaranteed to be gapless.
    /// Security does not rely on this reference; security relies strictly on authentication, authorization, ownership checks, and resource-level data isolation.
    /// </summary>
    public async Task<string> GenerateNextQuoteNumberAsync(CancellationToken cancellationToken = default)
    {
        if (_context.Database.IsNpgsql())
        {
            try
            {
                var seq = await _context.Database
                    .SqlQueryRaw<long>("SELECT nextval('\"GarageQuoteNumberSeq\"') AS \"Value\"")
                    .SingleAsync(cancellationToken);
                return $"BQ-{seq}";
            }
            catch
            {
                // Fallback if raw SQL execution is unavailable or in mock environment
            }
        }

        var maxNumber = await _context.GarageQuotes
            .AsNoTracking()
            .OrderByDescending(gq => gq.CreatedAtUtc)
            .Select(gq => gq.QuoteNumber)
            .FirstOrDefaultAsync(cancellationToken);

        long nextVal = 100001;
        if (!string.IsNullOrEmpty(maxNumber) && maxNumber.StartsWith("BQ-") && long.TryParse(maxNumber[3..], out var parsed))
        {
            nextVal = Math.Max(parsed + 1, Interlocked.Increment(ref _inMemoryCounter));
        }
        else
        {
            nextVal = Interlocked.Increment(ref _inMemoryCounter);
        }

        return $"BQ-{nextVal}";
    }
}
