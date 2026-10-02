using BroCoMod.Domain.Common;

namespace BroCoMod.Domain.Entities.Identity;

public class RefreshToken : BaseEntity
{
    public Guid UserId { get; private set; }
    public string TokenHash { get; private set; } = string.Empty;
    public string? ReplacedByTokenHash { get; private set; }
    public DateTime ExpiresAtUtc { get; private set; }
    public DateTime? RevokedAtUtc { get; private set; }
    public string? ReasonRevoked { get; private set; }

    public User User { get; private set; } = default!;

    public bool IsExpired => DateTime.UtcNow >= ExpiresAtUtc;
    public bool IsRevoked => RevokedAtUtc != null;
    public bool IsActive => !IsRevoked && !IsExpired;

    protected RefreshToken() { }

    public RefreshToken(
        Guid userId,
        string tokenHash,
        DateTime expiresAtUtc)
    {
        UserId = userId;
        TokenHash = tokenHash;
        ExpiresAtUtc = expiresAtUtc;
    }

    public void Revoke(string reason, string? replacedByTokenHash = null)
    {
        RevokedAtUtc = DateTime.UtcNow;
        ReasonRevoked = reason;
        ReplacedByTokenHash = replacedByTokenHash;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
