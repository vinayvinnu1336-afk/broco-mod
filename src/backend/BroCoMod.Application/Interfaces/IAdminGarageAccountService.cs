using BroCoMod.Application.DTOs;

namespace BroCoMod.Application.Interfaces;

/// <summary>Garages added from the admin portal. Errors are thrown as <see cref="AdvisorAccountException"/> (same codes).</summary>
public interface IAdminGarageAccountService
{
    Task<CreatedGarageAccountDto> CreateGarageAsync(CreateGarageAccountRequest request, Guid adminId, string? ipAddress = null, CancellationToken cancellationToken = default);

    /// <summary>Moves a garage to another live city (its advisors, bookings and dues lists follow).</summary>
    Task<AdminGarageListDto> UpdateGarageCityAsync(Guid garageId, string city, Guid adminId, string? ipAddress = null, CancellationToken cancellationToken = default);
}
