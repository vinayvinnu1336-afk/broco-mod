namespace BroCoMod.Application.Common;

/// <summary>
/// Password rules for every account (sign-up, password reset, accounts created by staff).
/// </summary>
public static class PasswordPolicy
{
    public const int MinLength = 6;
    public const string TooShortMessage = "Password must be at least 6 characters.";

    /// <summary>The problem with <paramref name="password"/>, or null when it is acceptable.</summary>
    public static string? Validate(string? password) =>
        password is null || password.Length < MinLength ? TooShortMessage : null;
}
