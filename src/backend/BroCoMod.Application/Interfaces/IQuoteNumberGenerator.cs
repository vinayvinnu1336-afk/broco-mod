namespace BroCoMod.Application.Interfaces;

/// <summary>
/// Generates unique human-readable quote reference numbers (BQ-XXXXXX).
/// Generated atomically via PostgreSQL sequence GarageQuoteNumberSeq.
/// The BQ-XXXXXX identifier is a unique human-readable quotation reference. Sequence values are not guaranteed to be gapless.
/// Security does not rely on this reference; security relies strictly on authentication, authorization, ownership checks, and resource-level data isolation.
/// </summary>
public interface IQuoteNumberGenerator
{
    Task<string> GenerateNextQuoteNumberAsync(CancellationToken cancellationToken = default);
}
