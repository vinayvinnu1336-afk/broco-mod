using BroCoMod.Application.DTOs;
using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Enums;
using BroCoMod.Domain.Exceptions;

namespace BroCoMod.Application.Security;

/// <summary>
/// Domain Security Policy enforcing strict data isolation on garage internal pricing.
/// Prevents data leaks across architectural and API boundaries.
/// </summary>
public static class QuoteDataIsolationPolicy
{
    /// <summary>
    /// Projects a CustomerQuotation to a sanitized CustomerQuoteViewDto.
    /// Internal garage pricing fields are strictly omitted.
    /// </summary>
    public static CustomerQuoteViewDto ProjectToCustomerView(CustomerQuotation quotation)
    {
        return new CustomerQuoteViewDto(
            quotation.Id,
            quotation.ServiceRequestId,
            quotation.CustomerFacingPrice,
            quotation.ScopeSummary,
            quotation.AdvisorNotes,
            quotation.Status,
            quotation.CreatedAtUtc
        );
    }

    /// <summary>
    /// Validates that a user with the specified role is permitted to view internal garage pricing.
    /// Throws DataIsolationViolationException if a Customer role attempts to access internal pricing.
    /// </summary>
    public static void AssertCanViewInternalPricing(UserRole role)
    {
        if (role == UserRole.Customer)
        {
            throw new DataIsolationViolationException(
                "Security Policy Violation: Customer role is strictly forbidden from accessing garage internal pricing or cost breakdowns.");
        }
    }

    public static bool IsGarageRole(UserRole role) =>
        role is UserRole.Garage or UserRole.GarageOwner or UserRole.GarageManager or UserRole.GarageStaff;

    /// <summary>
    /// Projects an internal GarageQuote to GarageInternalQuoteDto.
    /// Guaranteed to enforce that only Garage (owner) or Advisor/Admin can invoke this projection.
    /// </summary>
    public static GarageInternalQuoteDto ProjectToGarageInternalView(GarageQuote quote, UserRole requestingRole, Guid? requestingGarageId = null)
    {
        AssertCanViewInternalPricing(requestingRole);

        if (IsGarageRole(requestingRole) && requestingGarageId.HasValue && quote.GarageId != requestingGarageId.Value)
        {
            throw new DataIsolationViolationException(
                "Security Policy Violation: A garage cannot view another competitor garage's internal pricing.");
        }

        return new GarageInternalQuoteDto(
            quote.Id,
            quote.ServiceRequestId,
            quote.GarageId,
            quote.Garage?.Name ?? "Garage",
            quote.GarageInternalPrice,
            quote.InternalCostBreakdown,
            quote.GarageNotes,
            quote.EstimatedDurationHours,
            quote.Status,
            quote.CreatedAtUtc
        );
    }
}
