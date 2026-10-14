namespace BroCoMod.Application.Common;

/// <summary>
/// Shared parsing and validation for list-screen filters (search box, status, date range, service type).
/// Invalid input throws <see cref="ArgumentException"/>, which the API turns into a 400 with the message.
/// </summary>
public static class ListFilters
{
    /// <summary>A custom date range may span at most this many days.</summary>
    public const int MaxRangeDays = 366;
    public const int MaxSearchLength = 100;

    /// <summary>Lower-cased, trimmed search text, or null when blank.</summary>
    public static string? Search(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var trimmed = value.Trim();
        if (trimmed.Length > MaxSearchLength)
            throw new ArgumentException($"Search can be at most {MaxSearchLength} characters.");
        return trimmed.ToLowerInvariant();
    }

    /// <summary>Search text without spaces, so "9876543210" finds numbers stored as "+91 98765 43210".</summary>
    public static string? Compact(string? search) => search?.Replace(" ", string.Empty);

    /// <summary>
    /// Both ends as UTC (an unspecified kind is taken as UTC). Throws when "from" is after "to" or the
    /// range is longer than <see cref="MaxRangeDays"/> days. Either end may be missing (open range).
    /// </summary>
    public static (DateTime? From, DateTime? To) DateRange(DateTime? from, DateTime? to)
    {
        var f = from.HasValue ? AsUtc(from.Value) : (DateTime?)null;
        var t = to.HasValue ? AsUtc(to.Value) : (DateTime?)null;
        if (f.HasValue && t.HasValue)
        {
            if (f.Value > t.Value)
                throw new ArgumentException("The start date must be on or before the end date.");
            if ((t.Value - f.Value).TotalDays > MaxRangeDays)
                throw new ArgumentException($"Choose a date range of at most {MaxRangeDays} days.");
        }
        return (f, t);
    }

    /// <summary>
    /// Parses an enum name case-insensitively, ignoring spaces, dashes and underscores ("IN_PROGRESS",
    /// "InProgress"). Null when blank; throws for unknown names and for numbers.
    /// </summary>
    public static TEnum? Enum<TEnum>(string? value, string parameterName) where TEnum : struct, System.Enum
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var key = value.Trim().Replace("_", string.Empty).Replace("-", string.Empty).Replace(" ", string.Empty);
        if (key.Length > 0 && !char.IsDigit(key[0]) && key[0] != '-' &&
            System.Enum.TryParse<TEnum>(key, ignoreCase: true, out var parsed) &&
            System.Enum.IsDefined(parsed))
        {
            return parsed;
        }
        throw new ArgumentException($"'{value.Trim()}' is not a valid {parameterName}.");
    }

    /// <summary>
    /// "package" (fixed-price Basic / Standard / Premium bookings) or "quote" (repairs priced by garage
    /// quotes). Returns true for packages, false for quotes, null when blank.
    /// </summary>
    public static bool? ServiceType(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        return value.Trim().ToLowerInvariant() switch
        {
            "package" or "packages" => true,
            "quote" or "quotes" or "repair" => false,
            _ => throw new ArgumentException($"'{value.Trim()}' is not a valid service type. Use 'package' or 'quote'.")
        };
    }

    private static DateTime AsUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
    };
}
