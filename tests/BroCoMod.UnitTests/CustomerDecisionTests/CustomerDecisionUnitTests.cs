using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace BroCoMod.UnitTests.CustomerDecisionTests;

public class CustomerDecisionUnitTests
{
    [Fact]
    public void CustomerQuotationDecision_Constructor_SetsPropertiesAndValidatesReasonOnRejection()
    {
        // Arrange
        var quotationId = Guid.NewGuid();
        var versionId = Guid.NewGuid();
        var customerId = Guid.NewGuid();

        // Act - Accept
        var acceptDecision = new CustomerQuotationDecision(
            quotationId,
            versionId,
            1,
            customerId,
            CustomerDecisionType.Accepted,
            decisionCategory: null,
            decisionReason: "Looks great, let's proceed.",
            idempotencyKey: "KEY-123",
            clientIpAddress: "127.0.0.1",
            userAgent: "Mozilla/5.0"
        );

        // Assert - Accept
        acceptDecision.CustomerQuotationId.Should().Be(quotationId);
        acceptDecision.CustomerQuotationVersionId.Should().Be(versionId);
        acceptDecision.VersionNumber.Should().Be(1);
        acceptDecision.CustomerId.Should().Be(customerId);
        acceptDecision.Decision.Should().Be(CustomerDecisionType.Accepted);
        acceptDecision.DecisionReason.Should().Be("Looks great, let's proceed.");
        acceptDecision.IdempotencyKey.Should().Be("KEY-123");
        acceptDecision.ClientIpAddress.Should().Be("127.0.0.1");
        acceptDecision.UserAgent.Should().Be("Mozilla/5.0");
        acceptDecision.DecidedAtUtc.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(2));
    }

    [Fact]
    public void CustomerQuotationDecision_Constructor_ThrowsWhenRejectionReasonIsEmpty()
    {
        // Arrange
        var quotationId = Guid.NewGuid();
        var versionId = Guid.NewGuid();
        var customerId = Guid.NewGuid();

        // Act & Assert
        var act = () => new CustomerQuotationDecision(
            quotationId,
            versionId,
            1,
            customerId,
            CustomerDecisionType.Rejected,
            decisionCategory: "PRICE_TOO_HIGH",
            decisionReason: "   "
        );

        act.Should().Throw<ArgumentException>()
            .WithMessage("*Decision reason is mandatory when rejecting a quotation.*");
    }

    [Fact]
    public void CustomerQuotation_Accept_TransitionsStateAndSetsTimestampsAndAcceptedVersionId()
    {
        // Arrange
        var quote = new CustomerQuotation(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            "CQ-70001",
            "Brake replacement",
            "Advisor OK",
            DateTime.UtcNow.AddDays(3)
        );

        var item = new CustomerQuotationLineItem(quote.Id, QuoteLineType.Labour, "Inspection", 1, 500m, 18m, 0m, 1);
        quote.LineItems.Add(item);
        quote.MarkReadyToSend(Guid.NewGuid());
        quote.Send(Guid.NewGuid());

        var initialToken = quote.ConcurrencyToken;
        var versionId = Guid.NewGuid();

        // Act
        quote.Accept(versionId);

        // Assert
        quote.Status.Should().Be(CustomerQuotationStatus.Accepted);
        quote.AcceptedAtUtc.Should().NotBeNull();
        quote.CustomerRespondedAtUtc.Should().NotBeNull();
        quote.AcceptedVersionId.Should().Be(versionId);
        quote.ConcurrencyToken.Should().NotBe(initialToken);
    }

    [Fact]
    public void CustomerQuotation_Accept_ThrowsWhenNotInSentState()
    {
        // Arrange - Quote is in Draft state
        var quote = new CustomerQuotation(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            "CQ-70002",
            "Brake replacement",
            "Advisor OK",
            DateTime.UtcNow.AddDays(3)
        );

        // Act & Assert
        var act = () => quote.Accept();
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*Cannot accept customer quotation in 'Draft' state. Allowed only when 'Sent'.*");
    }

    [Fact]
    public void CustomerQuotation_Accept_ThrowsWhenQuotationHasExpired()
    {
        // Arrange - Quote is past validity
        var quote = new CustomerQuotation(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            "CQ-70003",
            "Brake replacement",
            "Advisor OK",
            DateTime.UtcNow.AddSeconds(1)
        );

        var item = new CustomerQuotationLineItem(quote.Id, QuoteLineType.Labour, "Inspection", 1, 500m, 18m, 0m, 1);
        quote.LineItems.Add(item);
        quote.MarkReadyToSend(Guid.NewGuid());
        quote.Send(Guid.NewGuid());

        // Wait to expire
        Thread.Sleep(1100);

        // Act & Assert
        var act = () => quote.Accept();
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*Cannot accept expired customer quotation.*");
    }

    [Fact]
    public void CustomerQuotation_Reject_TransitionsStateAndSetsTimestamps()
    {
        // Arrange
        var quote = new CustomerQuotation(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            "CQ-70004",
            "Oil change",
            "Advisor Remarks",
            DateTime.UtcNow.AddDays(5)
        );

        var item = new CustomerQuotationLineItem(quote.Id, QuoteLineType.Service, "Oil Change", 1, 1000m, 18m, 0m, 1);
        quote.LineItems.Add(item);
        quote.MarkReadyToSend(Guid.NewGuid());
        quote.Send(Guid.NewGuid());

        var initialToken = quote.ConcurrencyToken;

        // Act
        quote.Reject();

        // Assert
        quote.Status.Should().Be(CustomerQuotationStatus.Rejected);
        quote.RejectedAtUtc.Should().NotBeNull();
        quote.CustomerRespondedAtUtc.Should().NotBeNull();
        quote.ConcurrencyToken.Should().NotBe(initialToken);
    }

    [Fact]
    public void CustomerQuotation_Reject_ThrowsWhenNotInSentState()
    {
        // Arrange - Draft quote
        var quote = new CustomerQuotation(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            "CQ-70005",
            "Oil change",
            null,
            DateTime.UtcNow.AddDays(5)
        );

        // Act & Assert
        var act = () => quote.Reject();
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*Cannot reject customer quotation in 'Draft' state. Allowed only when 'Sent'.*");
    }

    [Fact]
    public void GarageAssignment_Confirm_TransitionsToConfirmedAndMutatesConcurrencyToken()
    {
        // Arrange
        var assignment = new GarageAssignment(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Recommended partner"
        );

        assignment.Status.Should().Be(GarageAssignmentStatus.Assigned);
        var initialToken = assignment.ConcurrencyToken;

        // Act
        assignment.Confirm();

        // Assert
        assignment.Status.Should().Be(GarageAssignmentStatus.Confirmed);
        assignment.ConcurrencyToken.Should().NotBe(initialToken);
    }

    [Fact]
    public void GarageAssignment_Confirm_ThrowsWhenNotInAssignedState()
    {
        // Arrange
        var assignment = new GarageAssignment(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Recommended partner"
        );

        assignment.Cancel("Reassigned", Guid.NewGuid());

        // Act & Assert
        var act = () => assignment.Confirm();
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*Cannot confirm garage assignment in 'Cancelled' state. Allowed only when 'Assigned'.*");
    }

    [Fact]
    public void ServiceRequest_ConfirmBooking_TransitionsToBookingConfirmed()
    {
        // Arrange
        var sr = new ServiceRequest(
            Guid.NewGuid(),
            "Tata",
            "Nexon",
            2023,
            "Battery inspection",
            77.5946,
            12.9716,
            10.0
        );

        sr.MarkGaragesNotified();
        sr.TransitionToAdvisorReview();
        sr.MarkGarageSelected();
        sr.MarkCustomerQuotationSent();

        sr.Status.Should().Be(ServiceRequestStatus.CustomerQuotationSent);

        // Act
        sr.ConfirmBooking();

        // Assert
        sr.Status.Should().Be(ServiceRequestStatus.BookingConfirmed);
    }

    [Fact]
    public void ServiceRequest_RejectByCustomer_TransitionsToCustomerRejectedAndSetsReason()
    {
        // Arrange
        var sr = new ServiceRequest(
            Guid.NewGuid(),
            "Tata",
            "Nexon",
            2023,
            "Battery inspection",
            77.5946,
            12.9716,
            10.0
        );

        sr.MarkCustomerQuotationSent();

        // Act
        sr.RejectByCustomer("Cost is outside budget");

        // Assert
        sr.Status.Should().Be(ServiceRequestStatus.CustomerRejected);
        sr.CancellationReason.Should().Be("Cost is outside budget");
    }
}
