namespace BroCoMod.Application.DTOs;

// ==========================================
// Garages created by an administrator
// ==========================================

/// <summary>
/// A new garage with its owner account. Garage phone and email default to the owner's. The pin must be inside a live
/// city; <see cref="City"/> defaults to the city of the pin. When <see cref="Password"/> is empty a temporary password
/// is generated and returned once.
/// </summary>
public record CreateGarageAccountRequest(
    string GarageName,
    string OwnerFullName,
    string OwnerMobile,
    string OwnerEmail,
    string Address,
    double? Latitude,
    double? Longitude,
    string? GaragePhone = null,
    string? GarageEmail = null,
    string? City = null,
    bool Verified = true,
    string? Password = null
);

/// <summary>
/// The result of creating a garage. <see cref="TemporaryPassword"/> is only set when the password was generated,
/// and only in this response.
/// </summary>
public record CreatedGarageAccountDto(
    AdminGarageListDto Garage,
    Guid OwnerUserId,
    string OwnerName,
    string LoginMobile,
    string? TemporaryPassword,
    bool PasswordGenerated,
    bool WelcomeEmailSent,
    string WelcomeEmailStatus
);

public record UpdateGarageCityRequest(string City);
