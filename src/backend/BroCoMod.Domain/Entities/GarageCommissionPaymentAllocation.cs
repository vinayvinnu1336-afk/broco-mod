using BroCoMod.Domain.Common;

namespace BroCoMod.Domain.Entities;

/// <summary>
/// Which commission dues an online commission payment was started for. A due can sit in more than one
/// checkout (a garage may open a second one before finishing the first), so the payment that is actually
/// paid settles its own dues from these rows instead of relying on the due's last-linked payment.
/// </summary>
public class GarageCommissionPaymentAllocation : BaseEntity
{
    public Guid PaymentId { get; private set; }
    public Guid GarageCommissionId { get; private set; }
    public decimal Amount { get; private set; }

    protected GarageCommissionPaymentAllocation() { }

    public GarageCommissionPaymentAllocation(Guid paymentId, Guid garageCommissionId, decimal amount)
    {
        if (paymentId == Guid.Empty) throw new ArgumentException("Payment is required.", nameof(paymentId));
        if (garageCommissionId == Guid.Empty) throw new ArgumentException("Commission is required.", nameof(garageCommissionId));
        if (amount <= 0) throw new ArgumentOutOfRangeException(nameof(amount), "Amount must be positive.");
        PaymentId = paymentId;
        GarageCommissionId = garageCommissionId;
        Amount = amount;
    }
}
