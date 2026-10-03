using BroCoMod.Application.Interfaces;
using Microsoft.Extensions.DependencyInjection;

namespace BroCoMod.Infrastructure.Services.PaymentGateway;

/// <summary>
/// Factory resolving the active IPaymentGateway provider according to tenant configuration or request specification.
/// </summary>
public class PaymentGatewayFactory : IPaymentGatewayFactory
{
    private readonly IServiceProvider _serviceProvider;

    public PaymentGatewayFactory(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public IPaymentGateway GetGateway(string? providerName = null)
    {
        var gateways = _serviceProvider.GetServices<IPaymentGateway>();

        if (string.IsNullOrWhiteSpace(providerName) ||
            string.Equals(providerName, "DevelopmentFake", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(providerName, "default", StringComparison.OrdinalIgnoreCase))
        {
            var fake = gateways.FirstOrDefault(g => g.ProviderName == DevelopmentFakePaymentGateway.GatewayName);
            if (fake != null) return fake;
        }

        var matched = gateways.FirstOrDefault(g =>
            string.Equals(g.ProviderName, providerName, StringComparison.OrdinalIgnoreCase));

        if (matched != null) return matched;

        // Fallback to first available or resolve fake
        return gateways.FirstOrDefault() ??
               _serviceProvider.GetRequiredService<DevelopmentFakePaymentGateway>();
    }
}
