using BroCoMod.Application.DTOs;
using BroCoMod.Application.Security;
using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Enums;
using BroCoMod.Domain.Exceptions;
using FluentAssertions;
using Xunit;

namespace BroCoMod.UnitTests.DomainTests;

public class PricingSecurityTests
{
    [Fact]
    public void CustomerRole_AccessingInternalPricing_MustThrowDataIsolationViolationException()
    {
        // Act
        Action act = () => QuoteDataIsolationPolicy.AssertCanViewInternalPricing(UserRole.Customer);

        // Assert
        act.Should().Throw<DataIsolationViolationException>()
            .WithMessage("*Security Policy Violation: Customer role is strictly forbidden*");
    }

    [Theory]
    [InlineData(UserRole.Advisor)]
    [InlineData(UserRole.SuperAdmin)]
    [InlineData(UserRole.Garage)]
    public void InternalRoles_AccessingInternalPricing_IsPermitted(UserRole role)
    {
        // Act
        Action act = () => QuoteDataIsolationPolicy.AssertCanViewInternalPricing(role);

        // Assert
        act.Should().NotThrow();
    }

    [Fact]
    public void ProjectToCustomerView_NeverExposes_GarageInternalCostBreakdown()
    {
        // Arrange
        var serviceRequestId = Guid.NewGuid();
        var garageId = Guid.NewGuid();
        var customerFacingQuotation = new CustomerQuotation(
            serviceRequestId,
            garageId,
            customerFacingPrice: 450.00m,
            advisorMarginApplied: 100.00m,
            scopeSummary: "Full synthetic oil and filter change",
            advisorNotes: "Standard advisor note"
        );

        // Act
        var customerDto = QuoteDataIsolationPolicy.ProjectToCustomerView(customerFacingQuotation);

        // Assert
        customerDto.Should().NotBeNull();
        customerDto.CustomerFacingPrice.Should().Be(450.00m);
        customerDto.ScopeSummary.Should().Be("Full synthetic oil and filter change");

        // Verify by reflection that CustomerQuoteViewDto does not have any internal pricing properties
        var properties = typeof(CustomerQuoteViewDto).GetProperties().Select(p => p.Name).ToList();
        properties.Should().NotContain("GarageInternalPrice");
        properties.Should().NotContain("InternalCostBreakdown");
        properties.Should().NotContain("AdvisorMarginApplied");
    }

    [Fact]
    public void GarageOwner_CannotAccess_CompetitorGarageInternalQuote()
    {
        // Arrange
        var garage1Id = Guid.NewGuid();
        var garage2Id = Guid.NewGuid();
        var quote = new GarageQuote(
            Guid.NewGuid(),
            garage1Id,
            garageInternalPrice: 300.00m,
            internalCostBreakdown: "Confidential garage 1 rate",
            garageNotes: "Private notes",
            estimatedDurationHours: 2
        );

        // Act
        Action act = () => QuoteDataIsolationPolicy.ProjectToGarageInternalView(quote, UserRole.Garage, requestingGarageId: garage2Id);

        // Assert
        act.Should().Throw<DataIsolationViolationException>()
            .WithMessage("*competitor garage*");
    }
}
