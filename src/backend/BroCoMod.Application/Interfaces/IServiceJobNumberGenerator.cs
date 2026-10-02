namespace BroCoMod.Application.Interfaces;

public interface IServiceJobNumberGenerator
{
    Task<string> NextJobNumberAsync(CancellationToken cancellationToken = default);
}
