namespace BroCoMod.Application.DTOs;

/// <summary>
/// Address for a map pin, split into the fields of the booking form. Every part is optional because
/// geocoders often know only some of them; <see cref="Provider"/> says whose data it is (attribution).
/// </summary>
public record AddressLookupDto(
    string? HouseNumber,
    string? Street,
    string? Area,
    string? City,
    string? State,
    string? Pincode,
    string FormattedAddress,
    string Provider
);

/// <summary>Settings the website reads at runtime, so changing them needs only an API restart.</summary>
/// <param name="GoogleMapsBrowserKey">Browser key for the Maps JavaScript API ("" = no map).</param>
/// <param name="AddressLookupProvider">"Google", "OpenStreetMap" or "None": who fills the address from a pin.</param>
public record PublicConfigDto(
    string GoogleMapsBrowserKey,
    string AddressLookupProvider
);
