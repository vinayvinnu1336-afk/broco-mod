using System.Text.RegularExpressions;

namespace BroCoMod.Infrastructure.Services;

/// <summary>Tidies geocoder output into values that fit the booking form (and its column sizes).</summary>
internal static partial class AddressText
{
    /// <summary>Longest value we put in one form field; address lines are 250 characters in the database.</summary>
    public const int MaxFieldLength = 120;

    public static string? Clean(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var text = Whitespace().Replace(value, " ").Trim();
        return text.Length <= MaxFieldLength ? text : text[..MaxFieldLength].TrimEnd();
    }

    /// <summary>Indian pincodes are 6 digits; geocoders sometimes write "500 034" or list two.</summary>
    public static string? Pincode(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var match = SixDigits().Match(value.Replace(" ", string.Empty));
        return match.Success ? match.Value : null;
    }

    /// <summary>Joins the distinct, non-empty parts with ", ".</summary>
    public static string? Join(params string?[] parts)
    {
        var distinct = parts
            .Select(Clean)
            .Where(p => p != null)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        return distinct.Count == 0 ? null : Clean(string.Join(", ", distinct));
    }

    /// <summary>"Banjara Hills, Hyderabad, Telangana 500034" style one-liner.</summary>
    public static string Formatted(string? house, string? street, string? area, string? city, string? state, string? pincode) =>
        string.Join(", ", new[] { house, street, area, city, $"{state} {pincode}".Trim() }
            .Where(p => !string.IsNullOrWhiteSpace(p))
            .Distinct(StringComparer.OrdinalIgnoreCase));

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();

    [GeneratedRegex(@"(?<!\d)\d{6}(?!\d)")]
    private static partial Regex SixDigits();
}
