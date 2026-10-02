using System.Collections.Concurrent;
using System.Security.Cryptography;
using BroCoMod.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace BroCoMod.Infrastructure.Services;

public class OtpProvider : IOtpProvider
{
    private readonly ILogger<OtpProvider> _logger;
    // In-memory thread-safe store for development/staging OTPs
    private static readonly ConcurrentDictionary<string, (string Otp, DateTime ExpiresAt)> OtpCache = new();

    public string ProviderName => "ConsoleMockOtpProvider";

    public OtpProvider(ILogger<OtpProvider> logger)
    {
        _logger = logger;
    }

    public Task<string> GenerateOtpAsync(string destination, string purpose, CancellationToken cancellationToken = default)
    {
        // 6-digit cryptographically secure OTP
        var randomNum = RandomNumberGenerator.GetInt32(100000, 1000000);
        var otp = randomNum.ToString("D6");
        var key = $"{destination.Trim().ToLowerInvariant()}:{purpose.Trim().ToLowerInvariant()}";

        OtpCache[key] = (otp, DateTime.UtcNow.AddMinutes(10));

        _logger.LogInformation("[OTP Provider - {ProviderName}] Generated OTP {Otp} for {Destination} (Purpose: {Purpose}). Valid for 10 minutes.",
            ProviderName, otp, destination, purpose);

        return Task.FromResult(otp);
    }

    public Task<bool> VerifyOtpAsync(string destination, string otp, string purpose, CancellationToken cancellationToken = default)
    {
        var key = $"{destination.Trim().ToLowerInvariant()}:{purpose.Trim().ToLowerInvariant()}";

        if (OtpCache.TryGetValue(key, out var entry))
        {
            if (DateTime.UtcNow <= entry.ExpiresAt && entry.Otp == otp)
            {
                OtpCache.TryRemove(key, out _);
                return Task.FromResult(true);
            }
        }

        return Task.FromResult(false);
    }
}
