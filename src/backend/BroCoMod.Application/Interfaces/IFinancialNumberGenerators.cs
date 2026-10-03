namespace BroCoMod.Application.Interfaces;

public interface IPaymentNumberGenerator
{
    Task<string> NextPaymentNumberAsync(CancellationToken cancellationToken = default);
}

public interface IInvoiceNumberGenerator
{
    Task<string> NextInvoiceNumberAsync(CancellationToken cancellationToken = default);
}

public interface ISettlementNumberGenerator
{
    Task<string> NextSettlementNumberAsync(CancellationToken cancellationToken = default);
}

public interface IAdditionalWorkQuotationNumberGenerator
{
    Task<string> NextAdditionalWorkQuotationNumberAsync(CancellationToken cancellationToken = default);
}
