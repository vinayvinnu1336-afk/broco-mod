namespace BroCoMod.Infrastructure.Services;

/// <summary>
/// The public Nominatim server allows at most one request per second per application, so every
/// lookup in this process waits its turn here (registered as a singleton).
/// </summary>
public sealed class NominatimRateGate
{
    private readonly SemaphoreSlim _lock = new(1, 1);
    private readonly TimeSpan _interval;
    private readonly TimeProvider _time;
    private DateTimeOffset _lastRequest = DateTimeOffset.MinValue;

    public NominatimRateGate() : this(TimeSpan.FromSeconds(1), TimeProvider.System)
    {
    }

    public NominatimRateGate(TimeSpan interval, TimeProvider time)
    {
        _interval = interval;
        _time = time;
    }

    /// <summary>
    /// Waits until a request may be sent. False when that would take longer than <paramref name="maxWait"/>
    /// (too many lookups queued), so callers give up instead of piling up behind each other.
    /// </summary>
    public async Task<bool> WaitTurnAsync(TimeSpan maxWait, CancellationToken ct = default)
    {
        var started = _time.GetTimestamp();
        if (!await _lock.WaitAsync(maxWait, ct)) return false;
        try
        {
            var delay = _lastRequest + _interval - _time.GetUtcNow();
            if (delay > TimeSpan.Zero)
            {
                if (_time.GetElapsedTime(started) + delay > maxWait) return false;
                await Task.Delay(delay, _time, ct);
            }
            _lastRequest = _time.GetUtcNow();
            return true;
        }
        finally
        {
            _lock.Release();
        }
    }
}
