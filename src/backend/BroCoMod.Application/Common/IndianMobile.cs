using System.ComponentModel.DataAnnotations;

namespace BroCoMod.Application.Common;

/// <summary>
/// Indian mobile numbers: 10 digits starting with 6-9. Stored everywhere as "+91 98765 43210".
/// </summary>
public static class IndianMobile
{
    public const string InvalidMessage = "Enter a valid 10-digit Indian mobile number.";

    /// <summary>
    /// The 10-digit national number, or null when the input is not an Indian mobile. Accepts an optional
    /// +91 / 91 / 0 prefix and spaces, dashes or brackets between the digits.
    /// </summary>
    public static string? NationalNumber(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return null;

        var digits = new System.Text.StringBuilder(16);
        var hasPlus = false;
        foreach (var c in input.Trim())
        {
            if (char.IsAsciiDigit(c)) digits.Append(c);
            else if (c == '+' && digits.Length == 0 && !hasPlus) hasPlus = true;
            else if (!(char.IsWhiteSpace(c) || c is '-' or '(' or ')')) return null;
        }

        var number = digits.ToString();
        if (hasPlus)
        {
            // "+" means a country code follows; only India's is accepted.
            if (!number.StartsWith("91", StringComparison.Ordinal)) return null;
            number = number[2..];
        }
        else if (number.Length == 12 && number.StartsWith("91", StringComparison.Ordinal))
        {
            number = number[2..];
        }
        else if (number.Length == 11 && number[0] == '0')
        {
            number = number[1..];
        }

        return number.Length == 10 && number[0] is >= '6' and <= '9' ? number : null;
    }

    public static bool IsValid(string? input) => NationalNumber(input) != null;

    /// <summary>The canonical "+91 98765 43210" form, or null when the input is not an Indian mobile.</summary>
    public static string? Normalize(string? input) =>
        NationalNumber(input) is { } n ? $"+91 {n[..5]} {n[5..]}" : null;
}

/// <summary>
/// Validates an Indian mobile number. Null is left to [Required] (or the implicit required check on
/// non-nullable strings); set <see cref="AllowEmpty"/> on optional fields so an empty string passes too.
/// </summary>
[AttributeUsage(AttributeTargets.Property | AttributeTargets.Field | AttributeTargets.Parameter)]
public sealed class IndianMobileAttribute : ValidationAttribute
{
    public IndianMobileAttribute() : base(IndianMobile.InvalidMessage) { }

    public bool AllowEmpty { get; set; }

    public override bool IsValid(object? value) => value switch
    {
        null => true,
        string s when string.IsNullOrWhiteSpace(s) => AllowEmpty,
        string s => IndianMobile.IsValid(s),
        _ => false,
    };
}
