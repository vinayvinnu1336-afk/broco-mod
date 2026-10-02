namespace BroCoMod.Application.Interfaces;

public interface ICustomerQuotationNumberGenerator
{
    Task<string> NextCustomerQuotationNumberAsync(CancellationToken cancellationToken = default);
}
