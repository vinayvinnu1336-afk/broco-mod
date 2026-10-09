using System.Text.Json;
using BroCoMod.Application.Interfaces;
using Microsoft.Extensions.Caching.Memory;
using StackExchange.Redis;

namespace BroCoMod.Infrastructure.Services;

/// <summary>
/// Cache backed by Redis when it is reachable, falling back to an in-process memory cache otherwise.
/// The Redis database handle is resolved on every call, so a Redis server that comes up after the API
/// (or reconnects after an outage) is picked up automatically.
/// </summary>
public class RedisCacheService : ICacheService
{
    private readonly IConnectionMultiplexer? _redis;
    private readonly IMemoryCache _fallback;

    public RedisCacheService(IMemoryCache fallback, IConnectionMultiplexer? redis = null)
    {
        _fallback = fallback;
        _redis = redis;
    }

    private IDatabase? Database => _redis is { IsConnected: true } ? _redis.GetDatabase() : null;

    public async Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken = default)
    {
        var database = Database;
        if (database == null)
        {
            return _fallback.TryGetValue(key, out T? cached) ? cached : default;
        }

        try
        {
            var value = await database.StringGetAsync(key);
            if (!value.HasValue) return default;

            return JsonSerializer.Deserialize<T>(value.ToString()!);
        }
        catch
        {
            return _fallback.TryGetValue(key, out T? cached) ? cached : default;
        }
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan? expiry = null, CancellationToken cancellationToken = default)
    {
        var database = Database;
        if (database != null)
        {
            try
            {
                var json = JsonSerializer.Serialize(value);
                await database.StringSetAsync(key, json, expiry);
                return;
            }
            catch
            {
                // Fall through to the in-process cache when Redis is transiently unavailable.
            }
        }

        if (expiry.HasValue)
        {
            _fallback.Set(key, value, expiry.Value);
        }
        else
        {
            _fallback.Set(key, value);
        }
    }

    public async Task RemoveAsync(string key, CancellationToken cancellationToken = default)
    {
        _fallback.Remove(key);

        var database = Database;
        if (database == null) return;

        try
        {
            await database.KeyDeleteAsync(key);
        }
        catch
        {
            // Silently fall back
        }
    }
}
