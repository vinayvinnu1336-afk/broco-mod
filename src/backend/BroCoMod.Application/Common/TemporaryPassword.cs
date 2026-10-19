using System.Security.Cryptography;

namespace BroCoMod.Application.Common;

/// <summary>
/// Passwords handed to a person by staff: 12 letters and digits, always at least one capital, one small letter and
/// one digit, and none of the characters people misread when copying by hand (0/O, 1/l/I).
/// </summary>
public static class TemporaryPassword
{
    public const int Length = 12;

    private const string Upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    private const string Lower = "abcdefghijkmnpqrstuvwxyz";
    private const string Digits = "23456789";
    public const string Alphabet = Upper + Lower + Digits;

    public static string Generate()
    {
        var chars = new char[Length];
        chars[0] = Pick(Upper);
        chars[1] = Pick(Lower);
        chars[2] = Pick(Digits);
        for (var i = 3; i < Length; i++) chars[i] = Pick(Alphabet);

        // Shuffle so the guaranteed classes are not always in the first three places.
        for (var i = Length - 1; i > 0; i--)
        {
            var j = RandomNumberGenerator.GetInt32(i + 1);
            (chars[i], chars[j]) = (chars[j], chars[i]);
        }
        return new string(chars);
    }

    private static char Pick(string set) => set[RandomNumberGenerator.GetInt32(set.Length)];
}
