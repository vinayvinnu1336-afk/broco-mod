using BroCoMod.Domain.Common;

namespace BroCoMod.Domain.Entities.Identity;

public class User : BaseEntity
{
    public string Email { get; private set; } = string.Empty;
    public string NormalizedEmail { get; private set; } = string.Empty;
    public string FullName { get; private set; } = string.Empty;
    public string PhoneNumber { get; private set; } = string.Empty;
    public string PasswordHash { get; private set; } = string.Empty;
    public string Salt { get; private set; } = string.Empty;
    public bool IsActive { get; private set; } = true;
    public bool IsEmailConfirmed { get; private set; } = true;
    public int FailedLoginAttempts { get; private set; } = 0;
    public DateTime? LockoutEndUtc { get; private set; }

    // Navigation properties
    public ICollection<UserRole> UserRoles { get; private set; } = new List<UserRole>();
    public ICollection<RefreshToken> RefreshTokens { get; private set; } = new List<RefreshToken>();
    public CustomerProfile? CustomerProfile { get; private set; }
    public GarageUser? GarageUser { get; private set; }
    public AdvisorProfile? AdvisorProfile { get; private set; }
    public ICollection<Notification> Notifications { get; private set; } = new List<Notification>();

    protected User() { }

    public User(
        string email,
        string fullName,
        string phoneNumber,
        string passwordHash,
        string salt)
    {
        Email = email.Trim().ToLowerInvariant();
        NormalizedEmail = Email.ToUpperInvariant();
        FullName = fullName.Trim();
        PhoneNumber = phoneNumber.Trim();
        PasswordHash = passwordHash;
        Salt = salt;
        IsActive = true;
        IsEmailConfirmed = true;
        FailedLoginAttempts = 0;
    }

    public bool IsLockedOut() =>
        LockoutEndUtc.HasValue && LockoutEndUtc.Value > DateTime.UtcNow;

    public void RecordSuccessfulLogin()
    {
        FailedLoginAttempts = 0;
        LockoutEndUtc = null;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void RecordFailedLogin(int maxFailedAttempts = 5, int lockoutMinutes = 15)
    {
        FailedLoginAttempts++;
        if (FailedLoginAttempts >= maxFailedAttempts)
        {
            LockoutEndUtc = DateTime.UtcNow.AddMinutes(lockoutMinutes);
        }
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void UpdatePassword(string newPasswordHash, string newSalt)
    {
        PasswordHash = newPasswordHash;
        Salt = newSalt;
        FailedLoginAttempts = 0;
        LockoutEndUtc = null;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void SetActive(bool isActive)
    {
        IsActive = isActive;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void UpdateProfile(string fullName, string phoneNumber)
    {
        FullName = fullName.Trim();
        PhoneNumber = phoneNumber.Trim();
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
