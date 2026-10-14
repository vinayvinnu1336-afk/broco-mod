using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;

namespace BroCoMod.Infrastructure.Services.Media;

/// <summary>
/// Signs media links so &lt;img&gt; and &lt;video&gt; tags can load files without the bearer token.
/// A link names one media item, an expiry and the audience it was issued to ("c" customer, "s" staff),
/// so a customer's link stops working as soon as the item is hidden from customers.
/// </summary>
public sealed class MediaUrlSigner
{
    public const string CustomerAudience = "c";
    public const string StaffAudience = "s";

    private static readonly TimeSpan Step = TimeSpan.FromMinutes(15);

    private readonly byte[] _key;
    private readonly TimeSpan _lifetime;

    public MediaUrlSigner(IOptions<MediaOptions> options, IConfiguration configuration)
    {
        var configuredKey = options.Value.SigningKey;
        if (!string.IsNullOrWhiteSpace(configuredKey) && configuredKey.Length >= 32)
        {
            _key = Encoding.UTF8.GetBytes(configuredKey);
        }
        else
        {
            var jwtSecret = configuration["Jwt:Secret"];
            if (string.IsNullOrWhiteSpace(jwtSecret))
                throw new InvalidOperationException("Media:SigningKey or Jwt:Secret must be set to sign media links.");
            // A separate key derived from the JWT secret, so a media signature can never pass as anything else.
            _key = HMACSHA256.HashData(Encoding.UTF8.GetBytes(jwtSecret), Encoding.UTF8.GetBytes("broco-media-links-v1"));
        }

        _lifetime = TimeSpan.FromMinutes(Math.Clamp(options.Value.UrlLifetimeMinutes, 5, 24 * 60));
    }

    /// <summary>Expiry for links issued now: at least the lifetime, rounded up to 15 minutes so URLs repeat and cache.</summary>
    public DateTimeOffset NextExpiry(DateTimeOffset? now = null)
    {
        var at = (now ?? DateTimeOffset.UtcNow) + _lifetime;
        var ticks = (at.UtcTicks + Step.Ticks - 1) / Step.Ticks * Step.Ticks;
        return new DateTimeOffset(ticks, TimeSpan.Zero);
    }

    public string Sign(Guid mediaId, long expiresUnix, string audience)
    {
        var payload = Encoding.UTF8.GetBytes($"{mediaId:N}.{expiresUnix}.{audience}");
        return WebEncoders.Base64UrlEncode(HMACSHA256.HashData(_key, payload));
    }

    public bool IsValid(Guid mediaId, long expiresUnix, string? audience, string? signature, DateTimeOffset? now = null)
    {
        if (string.IsNullOrEmpty(signature) || audience is not (CustomerAudience or StaffAudience)) return false;
        var current = (now ?? DateTimeOffset.UtcNow).ToUnixTimeSeconds();
        if (expiresUnix < current) return false;
        // Never accept a link that claims to live longer than any link we issue.
        if (expiresUnix > current + (long)(_lifetime + Step).TotalSeconds + 60) return false;

        byte[] provided;
        try
        {
            provided = WebEncoders.Base64UrlDecode(signature);
        }
        catch (FormatException)
        {
            return false;
        }

        var expected = WebEncoders.Base64UrlDecode(Sign(mediaId, expiresUnix, audience));
        return CryptographicOperations.FixedTimeEquals(provided, expected);
    }
}
