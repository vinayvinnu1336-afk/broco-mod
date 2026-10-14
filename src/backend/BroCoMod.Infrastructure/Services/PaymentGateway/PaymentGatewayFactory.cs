using BroCoMod.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace BroCoMod.Infrastructure.Services.PaymentGateway;

/// <summary>
/// Resolves the gateway for a payment. New payments use the configured default (Payment:Provider);
/// verification, webhooks and refunds ask for the provider stored on the payment row, so payments made
/// with the development gateway keep working after the default switches to Razorpay.
/// </summary>
public class PaymentGatewayFactory : IPaymentGatewayFactory
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IConfiguration _configuration;

    public PaymentGatewayFactory(IServiceProvider serviceProvider, IConfiguration configuration)
    {
        _serviceProvider = serviceProvider;
        _configuration = configuration;
    }

    public IPaymentGateway GetGateway(string? providerName = null)
    {
        var wanted = string.IsNullOrWhiteSpace(providerName) || string.Equals(providerName, "default", StringComparison.OrdinalIgnoreCase)
            ? PaymentSettings.Provider(_configuration)
            : providerName.Trim();

        var matched = _serviceProvider.GetServices<IPaymentGateway>()
            .FirstOrDefault(g => string.Equals(g.ProviderName, wanted, StringComparison.OrdinalIgnoreCase));

        return matched ?? throw new InvalidOperationException(
            $"Payment provider '{wanted}' is not available. Set Payment:Provider to DevelopmentFake or Razorpay.");
    }
}
