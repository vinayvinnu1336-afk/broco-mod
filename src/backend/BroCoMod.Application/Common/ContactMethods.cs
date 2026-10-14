namespace BroCoMod.Application.Common;

/// <summary>How a customer prefers to be contacted about bookings (CustomerProfile.PreferredContactMethod).</summary>
public static class ContactMethods
{
    public const string Phone = "Phone";
    public const string WhatsApp = "WhatsApp";
    public const string Sms = "SMS";
    public const string Email = "Email";

    public static readonly IReadOnlyList<string> All = new[] { Phone, WhatsApp, Sms, Email };

    /// <summary>The canonical spelling of a known method (case-insensitive), otherwise null.</summary>
    public static string? Normalize(string? value) =>
        string.IsNullOrWhiteSpace(value)
            ? null
            : All.FirstOrDefault(m => string.Equals(m, value.Trim(), StringComparison.OrdinalIgnoreCase));
}
