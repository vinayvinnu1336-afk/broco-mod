namespace BroCoMod.Application.DTOs;

/// <summary>Status values: "Configured", "Partial" (works, but something optional is missing), "NotConfigured", "Error".</summary>
public static class IntegrationStatus
{
    public const string Configured = "Configured";
    public const string Partial = "Partial";
    public const string NotConfigured = "NotConfigured";
    public const string Error = "Error";
}

/// <summary>One setting of an integration: whether it is set, and a hint. Never the value of a secret.</summary>
public record IntegrationCheckDto(string Label, bool Ok, string? Note = null);

public record IntegrationStatusDto(
    string Key,
    string Name,
    string Status,
    string Summary,
    IReadOnlyList<IntegrationCheckDto> Checks,
    string? Mode = null);

public record IntegrationsStatusDto(DateTime CheckedAtUtc, IReadOnlyList<IntegrationStatusDto> Integrations);

public record SendTestMessageRequest(string? MobileNumber = null, string? Channel = null);

public record TestMessageResultDto(
    bool Success,
    string Channel,
    string Provider,
    bool Configured,
    string Recipient,
    string Detail,
    string? ProviderMessageId = null,
    int? HttpStatus = null);
