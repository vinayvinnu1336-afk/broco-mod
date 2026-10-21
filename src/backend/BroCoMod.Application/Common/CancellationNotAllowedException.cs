namespace BroCoMod.Application.Common;

/// <summary>The caller may not cancel this booking (e.g. the customer after paying). Maps to HTTP 409.</summary>
public sealed class CancellationNotAllowedException : Exception
{
    public CancellationNotAllowedException(string message) : base(message)
    {
    }
}
