namespace BroCoMod.Application.Common;

/// <summary>A per-number or per-client allowance is used up (e.g. one-time codes). Maps to HTTP 429.</summary>
public sealed class TooManyRequestsException : Exception
{
    public TooManyRequestsException(string message, TimeSpan retryAfter) : base(message)
    {
        RetryAfter = retryAfter;
    }

    public TimeSpan RetryAfter { get; }
}
