using BroCoMod.Application.DTOs;

namespace BroCoMod.Application.Interfaces;

/// <summary>Creates and edits advisor accounts from the admin portal. Errors are thrown as <see cref="AdvisorAccountException"/>.</summary>
public interface IAdminAdvisorAccountService
{
    Task<CreatedAdvisorDto> CreateAdvisorAsync(CreateAdvisorRequest request, Guid adminId, string? ipAddress = null, CancellationToken cancellationToken = default);

    Task<PromotedAdvisorDto> PromoteToAdvisorAsync(PromoteToAdvisorRequest request, Guid adminId, string? ipAddress = null, CancellationToken cancellationToken = default);

    Task<AdminAdvisorListDto> UpdateAdvisorAsync(Guid id, UpdateAdvisorRequest request, Guid adminId, string? ipAddress = null, CancellationToken cancellationToken = default);
}
