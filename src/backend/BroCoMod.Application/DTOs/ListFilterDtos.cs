namespace BroCoMod.Application.DTOs;

/// <summary>
/// Filters for staff list screens that have only a search box, a status and a date range.
/// Status is an enum name of the listed entity ("Sent", "IN_PROGRESS" ...); dates filter on when the row was created.
/// </summary>
public record ListFilter(
    string? Search = null,
    string? Status = null,
    DateTime? FromDateUtc = null,
    DateTime? ToDateUtc = null
);

/// <summary>Filters for the advisor's service request list.</summary>
public record RequestListFilter(
    string? Search = null,
    string? Status = null,
    DateTime? FromDateUtc = null,
    DateTime? ToDateUtc = null,
    // "package" (Basic / Standard / Premium) or "quote" (priced by garage quotes)
    string? ServiceType = null,
    string? Category = null,
    string? City = null
);

/// <summary>Filters for the admin ledger (latest 200 matching entries).</summary>
public record LedgerFilter(
    Guid? AccountId = null,
    string? AccountType = null,
    string? EntryType = null,
    string? Search = null,
    DateTime? FromDateUtc = null,
    DateTime? ToDateUtc = null
);
