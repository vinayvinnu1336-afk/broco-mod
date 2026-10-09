using System.Security.Cryptography;
using System.Text;
using BroCoMod.Application.Interfaces;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace BroCoMod.Infrastructure.Services;

/// <summary>
/// One-time passcode store. Codes live in the shared cache (Redis when available) so that any API
/// replica can verify a code issued by another. Only a hash of the code is stored, each code allows a
/// limited number of wrong guesses, and the plain code is written to logs in Development only.
/// Delivery to the user (SMS / email) is the job of the notification providers.
/// </summary>
public class OtpProvider : IOtpProvider
{
    private const int MaxAttempts = 5;
    private static readonly TimeSpan Validity = TimeSpan.FromMinutes(10);

    private readonly ICacheService _cache;
    private readonly IHostEnvironment _environment;
    private readonly ILogger<OtpProvider> _logger;

    public string ProviderName => "CacheBackedOtpProvider";

    public OtpProvider(ICacheService cache, IHostEnvironment environment, ILogger<OtpProvider> logger)
    {
        _cache = cache;
        _environment = environment;
        _logger = logger;
    }

    public async Task<string> GenerateOtpAsync(string destination, string purpose, CancellationToken cancellationToken = default)
    {
        // 6-digit cryptographically secure OTP
        var otp = RandomNumberGenerator.GetInt32(100000, 1000000).ToString("D6");
        var entry = new OtpEntry(Hash(otp), DateTime.UtcNow.Add(Validity), 0);

        await _cache.SetAsync(Key(destination, purpose), entry, Validity, cancellationToken);

        if (_environment.IsDevelopment())
        {
            _logger.LogInformation("[OTP] Development code for {Destination} ({Purpose}): {Otp}", destination, purpose, otp);
        }
        else
        {
            _logger.LogInformation("[OTP] Code issued for {Purpose}. Valid for {Minutes} minutes.", purpose, Validity.TotalMinutes);
        }

        return otp;
    }

    public async Task<bool> VerifyOtpAsync(string destination, string otp, string purpose, CancellationToken cancellationToken = default)
    {
        var key = Key(destination, purpose);
        var entry = await _cache.GetAsync<OtpEntry>(key, cancellationToken);
        if (entry == null || DateTime.UtcNow > entry.ExpiresAtUtc || entry.Attempts >= MaxAttempts)
        {
            return false;
        }

        var candidate = Hash(otp ?? string.Empty);
        if (CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(candidate), Encoding.ASCII.GetBytes(entry.CodeHash)))
        {
            await _cache.RemoveAsync(key, cancellationToken);
            return true;
        }

        var remaining = entry.ExpiresAtUtc - DateTime.UtcNow;
        if (remaining > TimeSpan.Zero)
        {
            await _cache.SetAsync(key, entry with { Attempts = entry.Attempts + 1 }, remaining, cancellationToken);
        }
        return false;
    }

    private static string Key(string destination, string purpose) =>
        $"otp:{purpose.Trim().ToLowerInvariant()}:{destination.Trim().ToLowerInvariant()}";

    private static string Hash(string value) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value.Trim())));

    public sealed record OtpEntry(string CodeHash, DateTime ExpiresAtUtc, int Attempts);
}
