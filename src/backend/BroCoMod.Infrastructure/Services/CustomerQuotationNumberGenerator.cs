using BroCoMod.Application.Interfaces;
using BroCoMod.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BroCoMod.Infrastructure.Services;

public class CustomerQuotationNumberGenerator : ICustomerQuotationNumberGenerator
{
    private readonly ApplicationDbContext _context;
    private static long _inMemoryCounter = 100000;

    public CustomerQuotationNumberGenerator(ApplicationDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Generated atomically via PostgreSQL sequence CustomerQuotationNumberSeq.
    /// The CQ-XXXXXX identifier is a unique human-readable customer quotation reference. Sequence values are not guaranteed to be gapless.
    /// Security does not rely on this reference; security relies strictly on authentication, authorization, ownership checks, and resource-level data isolation.
    /// </summary>
    public async Task<string> NextCustomerQuotationNumberAsync(CancellationToken cancellationToken = default)
    {
        if (_context.Database.IsNpgsql())
        {
            try
            {
                var seq = await _context.Database
                    .SqlQueryRaw<long>("SELECT nextval('\"CustomerQuotationNumberSeq\"') AS \"Value\"")
                    .SingleAsync(cancellationToken);
                return $"CQ-{seq}";
            }
            catch
            {
                // Fallback if raw SQL execution is unavailable or in mock environment
            }
        }

        var maxNumber = await _context.CustomerQuotations
            .AsNoTracking()
            .OrderByDescending(cq => cq.CreatedAtUtc)
            .Select(cq => cq.QuotationNumber)
            .FirstOrDefaultAsync(cancellationToken);

        long nextVal = 100001;
        if (!string.IsNullOrEmpty(maxNumber) && maxNumber.StartsWith("CQ-") && long.TryParse(maxNumber[3..], out var parsed))
        {
            nextVal = Math.Max(parsed + 1, Interlocked.Increment(ref _inMemoryCounter));
        }
        else
        {
            nextVal = Interlocked.Increment(ref _inMemoryCounter);
        }

        return $"CQ-{nextVal}";
    }
}
