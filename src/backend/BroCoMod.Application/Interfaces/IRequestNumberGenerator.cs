namespace BroCoMod.Application.Interfaces;

/// <summary>
/// Generates unique human-readable service request reference numbers (BM-XXXXXX).
/// Generated atomically via PostgreSQL sequence ServiceRequestNumberSeq.
/// The BM-XXXXXX identifier is a unique human-readable service request reference. Sequence values are not guaranteed to be gapless.
/// Security does not rely on this reference; security relies strictly on authentication, authorization, ownership checks, and resource-level data isolation.
/// </summary>
public interface IRequestNumberGenerator
{
    Task<string> GenerateNextRequestNumberAsync(CancellationToken cancellationToken = default);
}
