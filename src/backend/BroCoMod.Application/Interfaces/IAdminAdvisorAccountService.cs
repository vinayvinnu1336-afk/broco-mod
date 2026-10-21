using BroCoMod.Application.DTOs;

namespace BroCoMod.Application.Interfaces;

/// <summary>Creates and edits advisor accounts from the admin portal. Errors are thrown as <see cref="AdvisorAccountException"/>.</summary>
public interface IAdminAdvisorAccountService
{
    Task<CreatedAdvisorDto> CreateAdvisorAsync(CreateAdvisorRequest request, Guid adminId, string? ipAddress = null, CancellationToken cancellationToken = default);

    Task<PromotedAdvisorDto> PromoteToAdvisorAsync(PromoteToAdvisorRequest request, Guid adminId, string? ipAddress = null, CancellationToken cancellationToken = default);

    Task<AdminAdvisorListDto> UpdateAdvisorAsync(Guid id, UpdateAdvisorRequest request, Guid adminId, string? ipAddress = null, CancellationToken cancellationToken = default);

    Task<AdvisorRemovalPreviewDto> GetRemovalPreviewAsync(Guid id, Guid adminId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes an advisor: hidden from the list, signed out and unable to sign in again, and their open requests moved
    /// to other advisors of the same city (another city's only when it has none). Past records keep the advisor.
    /// </summary>
    Task<RemovedAdvisorDto> RemoveAdvisorAsync(Guid id, Guid adminId, string? ipAddress = null, CancellationToken cancellationToken = default);
}
