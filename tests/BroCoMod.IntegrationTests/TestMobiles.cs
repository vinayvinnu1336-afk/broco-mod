namespace BroCoMod.IntegrationTests;

/// <summary>
/// A mobile number signs in to exactly one active account, so every registration in these tests needs its own.
/// Test classes run in parallel on one database; a random number keeps them from colliding.
/// </summary>
internal static class TestMobiles
{
    /// <summary>A fresh 10-digit Indian mobile (first digit 6-9), e.g. "9123456789".</summary>
    public static string NewNational() => $"{Random.Shared.Next(6, 10)}{Random.Shared.Next(0, 1_000_000_000):D9}";

    /// <summary>A fresh mobile in the stored "+91 91234 56789" format.</summary>
    public static string New() => Canonical(NewNational());

    public static string Canonical(string tenDigits) => $"+91 {tenDigits[..5]} {tenDigits[5..]}";
}
