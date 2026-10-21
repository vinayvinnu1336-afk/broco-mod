using BroCoMod.Domain.Entities.Identity;

namespace BroCoMod.Infrastructure.Services;

/// <summary>Removed advisors stay on past records but their name is no longer shown.</summary>
public static class AdvisorDisplay
{
    public static string? Name(AdvisorProfile? advisor) =>
        advisor == null ? null : advisor.IsRemoved ? AdvisorProfile.FormerAdvisorName : advisor.User?.FullName;
}
