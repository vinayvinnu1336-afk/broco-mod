namespace BroCoMod.Application.Interfaces;

public interface IRequestNumberGenerator
{
    Task<string> GenerateNextRequestNumberAsync(CancellationToken cancellationToken = default);
}
