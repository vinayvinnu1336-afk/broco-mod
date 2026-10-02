using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Enums;
using FluentAssertions;
using NetTopologySuite.Geometries;
using Xunit;

namespace BroCoMod.UnitTests.AdvisorQuotationTests;

public class CustomerQuotationUnitTests
{
    [Fact]
    public void Constructor_InitializesValidDraft_WithCorrectDefaults()
    {
        // Arrange
        var serviceRequestId = Guid.NewGuid();
        var garageAssignmentId = Guid.NewGuid();
        var assignedGarageId = Guid.NewGuid();
        var advisorId = Guid.NewGuid();
        var quoteNumber = "CQ-100001";
        var validUntil = DateTime.UtcNow.AddDays(5);

        // Act
        var quote = new CustomerQuotation(
            serviceRequestId: serviceRequestId,
            garageAssignmentId: garageAssignmentId,
            assignedGarageId: assignedGarageId,
            advisorId: advisorId,
            quotationNumber: quoteNumber,
            scopeSummary: "Full engine diagnostic and pad replacement",
            advisorRemarks: "All parts OEM guaranteed.",
            validUntilUtc: validUntil,
            customerDiscount: 150m,
            currency: "INR"
        );

        // Assert
        quote.ServiceRequestId.Should().Be(serviceRequestId);
        quote.GarageAssignmentId.Should().Be(garageAssignmentId);
        quote.AssignedGarageId.Should().Be(assignedGarageId);
        quote.AdvisorId.Should().Be(advisorId);
        quote.QuotationNumber.Should().Be("CQ-100001");
        quote.Status.Should().Be(CustomerQuotationStatus.Draft);
        quote.VersionNumber.Should().Be(1);
        quote.Currency.Should().Be("INR");
        quote.CustomerSubtotal.Should().Be(0m);
        quote.CustomerTax.Should().Be(0m);
        quote.CustomerDiscount.Should().Be(150m);
        quote.CustomerTotal.Should().Be(0m);
        quote.AdvisorRemarks.Should().Be("All parts OEM guaranteed.");
        quote.LineItems.Should().BeEmpty();
        quote.Versions.Should().BeEmpty();
    }

    [Fact]
    public void RecalculateTotals_CalculatesSubtotalTaxDiscountAndTotal_Accurately()
    {
        // Arrange
        var quote = new CustomerQuotation(
            serviceRequestId: Guid.NewGuid(),
            garageAssignmentId: Guid.NewGuid(),
            assignedGarageId: Guid.NewGuid(),
            advisorId: Guid.NewGuid(),
            quotationNumber: "CQ-100002",
            scopeSummary: "Brake service",
            advisorRemarks: null,
            validUntilUtc: DateTime.UtcNow.AddDays(3),
            customerDiscount: 100m
        );

        // Line 1: Part (2 x 1500 = 3000, 18% tax, 100 discount on line = 2900 line total before quote-level discount)
        var item1 = new CustomerQuotationLineItem(
            customerQuotationId: quote.Id,
            lineType: QuoteLineType.Part,
            description: "Front Brake Pads OEM",
            quantity: 2,
            unitPrice: 1500m,
            taxRate: 18m,
            discountAmount: 100m,
            sortOrder: 1
        );

        // Line 2: Labour (1 x 800 = 800, 18% tax, 0 discount = 800 line total)
        var item2 = new CustomerQuotationLineItem(
            customerQuotationId: quote.Id,
            lineType: QuoteLineType.Labour,
            description: "Brake Pad Installation Labour",
            quantity: 1,
            unitPrice: 800m,
            taxRate: 18m,
            discountAmount: 0m,
            sortOrder: 2
        );

        // Act
        quote.LineItems.Add(item1);
        quote.LineItems.Add(item2);
        quote.RecalculateTotals();

        // Assert
        // Item 1: LineTotal = (2 * 1500) - 100 = 2900.00
        item1.LineTotal.Should().Be(2900.00m);

        // Item 2: LineTotal = (1 * 800) - 0 = 800.00
        item2.LineTotal.Should().Be(800.00m);

        // Subtotal = 2900 + 800 = 3700.00
        quote.CustomerSubtotal.Should().Be(3700.00m);
        quote.CustomerDiscount.Should().Be(100.00m);

        // Taxable after quote-level discount = 3700 - 100 = 3600
        // Line taxes = (2900 * 0.18) + (800 * 0.18) = 522 + 144 = 666
        // Scaled tax = 666 * (3600 / 3700) = 648.00
        quote.CustomerTax.Should().Be(648.00m);
        // Total = 3600 + 648.00 = 4248.00
        quote.CustomerTotal.Should().Be(4248.00m);
    }

    [Fact]
    public void MarkReadyToSend_Fails_WhenNoLineItems()
    {
        // Arrange
        var quote = new CustomerQuotation(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            "CQ-100003", "Test", null, DateTime.UtcNow.AddDays(3));

        // Act & Assert - No items
        var actNoItems = () => quote.MarkReadyToSend(Guid.NewGuid());
        actNoItems.Should().Throw<InvalidOperationException>().WithMessage("*at least one line item*");
    }

    [Fact]
    public void MarkReadyToSend_TransitionsState()
    {
        // Arrange
        var advisorId = Guid.NewGuid();
        var quote = new CustomerQuotation(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), advisorId,
            "CQ-100004", "Engine Service", null, DateTime.UtcNow.AddDays(3));
        quote.LineItems.Add(new CustomerQuotationLineItem(quote.Id, QuoteLineType.Service, "Synthetic Oil Change", 1, 3500m, 18m, 0m));

        // Act
        quote.MarkReadyToSend(advisorId);

        // Assert
        quote.Status.Should().Be(CustomerQuotationStatus.ReadyToSend);
        quote.CustomerSubtotal.Should().Be(3500.00m);
        quote.CustomerTax.Should().Be(630.00m);
        quote.CustomerTotal.Should().Be(4130.00m);
        quote.AdvisorId.Should().Be(advisorId);
    }

    [Fact]
    public void Send_TransitionsState_AndSetsSentTimestamp()
    {
        // Arrange
        var advisorId = Guid.NewGuid();
        var quote = new CustomerQuotation(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), advisorId,
            "CQ-100005", "Air Filter", null, DateTime.UtcNow.AddDays(3));
        quote.LineItems.Add(new CustomerQuotationLineItem(quote.Id, QuoteLineType.Part, "Cabin Air Filter", 1, 900m, 18m));
        quote.MarkReadyToSend(advisorId);

        // Act
        quote.Send(advisorId);

        // Assert
        quote.Status.Should().Be(CustomerQuotationStatus.Sent);
        quote.SentAtUtc.Should().NotBeNull();
        quote.SentAtUtc.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(2));
    }

    [Fact]
    public void Send_Throws_WhenQuoteIsExpired()
    {
        // Arrange
        var advisorId = Guid.NewGuid();
        var quote = new CustomerQuotation(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), advisorId,
            "CQ-100006", "Filter", null, DateTime.UtcNow.AddDays(1));
        quote.LineItems.Add(new CustomerQuotationLineItem(quote.Id, QuoteLineType.Part, "Air Filter", 1, 500m));
        quote.MarkReadyToSend(advisorId);

        // Expire it
        quote.Expire();

        // Act & Assert
        var act = () => quote.Send(advisorId);
        act.Should().Throw<InvalidOperationException>().WithMessage("*Cannot send customer quotation in 'Expired' state*");
    }

    [Fact]
    public void CreateRevision_IncrementsVersion_AndResetsToDraft()
    {
        // Arrange
        var advisorId = Guid.NewGuid();
        var quote = new CustomerQuotation(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), advisorId,
            "CQ-100007", "Brake job", null, DateTime.UtcNow.AddDays(3));
        quote.LineItems.Add(new CustomerQuotationLineItem(quote.Id, QuoteLineType.Part, "Pads", 1, 1200m));
        quote.MarkReadyToSend(advisorId);
        quote.Send(advisorId);

        // Act
        quote.CreateRevision(advisorId);

        // Assert
        quote.Status.Should().Be(CustomerQuotationStatus.Draft);
        quote.VersionNumber.Should().Be(2);
    }

    [Fact]
    public void GarageAssignment_Constructor_AndCancellation_FollowDomainInvariants()
    {
        // Arrange
        var serviceRequestId = Guid.NewGuid();
        var garageId = Guid.NewGuid();
        var quoteId = Guid.NewGuid();
        var advisorId = Guid.NewGuid();

        // Act
        var assignment = new GarageAssignment(
            serviceRequestId: serviceRequestId,
            garageId: garageId,
            selectedQuoteId: quoteId,
            assignedByAdvisorId: advisorId,
            assignmentReason: "Lowest cost with fastest turnaround."
        );

        // Assert
        assignment.ServiceRequestId.Should().Be(serviceRequestId);
        assignment.GarageId.Should().Be(garageId);
        assignment.SelectedQuoteId.Should().Be(quoteId);
        assignment.AssignedByAdvisorId.Should().Be(advisorId);
        assignment.Status.Should().Be(GarageAssignmentStatus.Assigned);
        assignment.AssignmentReason.Should().Be("Lowest cost with fastest turnaround.");
        assignment.CancelledAtUtc.Should().BeNull();

        // Cancel assignment
        var cancelAdvisorId = Guid.NewGuid();
        assignment.Cancel("Customer requested alternative location.", cancelAdvisorId);

        assignment.Status.Should().Be(GarageAssignmentStatus.Cancelled);
        assignment.CancellationReason.Should().Be("Customer requested alternative location.");
        assignment.CancelledAtUtc.Should().NotBeNull();
    }

    [Fact]
    public void GarageAssignment_Cancel_RequiresValidAdvisorId()
    {
        // Arrange
        var assignment = new GarageAssignment(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "Reason");

        // Act & Assert
        var act = () => assignment.Cancel("Some reason", Guid.Empty);
        act.Should().Throw<ArgumentException>().WithMessage("*AdvisorId cannot be empty*");
    }

    [Fact]
    public void AdvisorRequestNote_AuthorCanUpdate_AndTimestampUpdates()
    {
        // Arrange
        var serviceRequestId = Guid.NewGuid();
        var advisorId = Guid.NewGuid();
        var note = new AdvisorRequestNote(serviceRequestId, advisorId, "Advisor John", "Spoke with customer about strange engine rattling.");

        note.Note.Should().Be("Spoke with customer about strange engine rattling.");
        note.UpdatedAtUtc.Should().BeNull();

        // Act
        note.Update("Updated note after diagnostic audio recording received.", advisorId);

        // Assert
        note.Note.Should().Be("Updated note after diagnostic audio recording received.");
        note.UpdatedAtUtc.Should().NotBeNull();
    }

    [Fact]
    public void ServiceRequest_StateTransitions_TransitionToAdvisorReview_And_MarkGarageSelected()
    {
        // Arrange
        var request = new ServiceRequest(
            Guid.NewGuid(),
            "Honda",
            "City",
            2021,
            "Brake issue",
            77.5946,
            12.9716,
            10.0
        );

        request.Status.Should().Be(ServiceRequestStatus.Submitted);

        // Move to GaragesNotified
        request.MarkGaragesNotified();
        request.Status.Should().Be(ServiceRequestStatus.GaragesNotified);

        // Transition to AdvisorReview
        request.TransitionToAdvisorReview();
        request.Status.Should().Be(ServiceRequestStatus.AdvisorReview);

        // Mark Garage Selected
        request.MarkGarageSelected();
        request.Status.Should().Be(ServiceRequestStatus.GarageSelected);
    }
}
