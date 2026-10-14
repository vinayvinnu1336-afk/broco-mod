namespace BroCoMod.Domain.Constants;

/// <summary>
/// The quote-based services a customer can pick when booking (anything that isn't a fixed-price
/// package). A request may carry several; they are stored joined in ServiceRequest.ServiceCategory.
/// Keep in sync with OTHER_SERVICES in src/frontend/src/app/customer/requests/new/page.tsx.
/// </summary>
public static class ServiceCategories
{
    public const int MaxPerRequest = 8;

    /// <summary>Length of the ServiceRequest.ServiceCategory column (varchar(300)).</summary>
    public const int MaxStoredLength = 300;

    public const string Separator = ", ";

    public static readonly IReadOnlyList<string> QuoteBased = new[]
    {
        "AC Service & Repair",
        "Batteries",
        "Tyres & Wheel Care",
        "Denting & Painting",
        "Detailing & Car Spa",
        "Clutch & Body Parts",
        "Suspension & Fitments",
        "Windshields & Lights",
        "Insurance Claims",
        "General Repair",
    };

    /// <summary>The canonical spelling of a known service, or null when it isn't one.</summary>
    public static string? Canonical(string? name)
    {
        if (string.IsNullOrWhiteSpace(name)) return null;
        var trimmed = name.Trim();
        return QuoteBased.FirstOrDefault(c => string.Equals(c, trimmed, StringComparison.OrdinalIgnoreCase));
    }

    public static string Join(IEnumerable<string> categories) => string.Join(Separator, categories);

    /// <summary>The individual services of a stored (possibly joined) category value.</summary>
    public static IReadOnlyList<string> Split(string? stored) =>
        string.IsNullOrWhiteSpace(stored)
            ? Array.Empty<string>()
            : stored.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}
