using System.Text.Json;
using BroCoMod.Application.Interfaces;
using StackExchange.Redis;

namespace BroCoMod.Infrastructure.Services;

public class RedisCacheService : ICacheService
{
    private readonly IConnectionMultiplexer? _redis;
    private readonly IDatabase? _database;

    public RedisCacheService(IConnectionMultiplexer? redis = null)
    {
        _redis = redis;
        if (_redis != null && _redis.IsConnected)
        {
            _database = _redis.GetDatabase();
        }
    }

    public async Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken = default)
    {
        if (_database == null) return default;

        try
        {
            var value = await _database.StringGetAsync(key);
            if (!value.HasValue) return default;

            return JsonSerializer.Deserialize<T>(value.ToString()!);
        }
        catch
        {
            return default;
        }
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan? expiry = null, CancellationToken cancellationToken = default)
    {
        if (_database == null) return;

        try
        {
            var json = JsonSerializer.Serialize(value);
            await _database.StringSetAsync(key, json, expiry);
        }
        catch
        {
            // Silently fall back if cache transiently unavailable
        }
    }

    public async Task RemoveAsync(string key, CancellationToken cancellationToken = default)
    {
        if (_database == null) return;

        try
        {
            await _database.KeyDeleteAsync(key);
        }
        catch
        {
            // Silently fall back
        }
    }
}
