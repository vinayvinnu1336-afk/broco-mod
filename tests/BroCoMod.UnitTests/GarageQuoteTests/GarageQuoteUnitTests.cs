using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace BroCoMod.UnitTests.GarageQuoteTests;

public class GarageQuoteUnitTests
{
    private readonly Guid _garageRequestId = Guid.NewGuid();
    private readonly Guid _garageId = Guid.NewGuid();
    private readonly Guid _serviceRequestId = Guid.NewGuid();
    private readonly Guid _userId = Guid.NewGuid();

    [Fact]
    public void CreateDraftQuote_WithValidData_SetsDraftStatusAndGeneratesCorrectTotals()
    {
        // Arrange & Act
        var quote = new GarageQuote(
            garageRequestId: _garageRequestId,
            garageId: _garageId,
            serviceRequestId: _serviceRequestId,
            quoteNumber: "BQ-100001",
            currency: "INR",
            validUntil: DateTime.UtcNow.AddDays(7),
            estimatedCompletionHours: 4,
            estimatedCompletionDays: 1,
            garageRemarks: "Full synthetic oil and brake pad replacement",
            createdByUserId: _userId);

        quote.AddLineItem(QuoteLineType.Labour, "Brake pad replacement labour", 1, 800m, 18m, 0m);
        quote.AddLineItem(QuoteLineType.Part, "Front Brake Pads (OEM)", 1, 2400m, 18m, 200m);

        // Assert
        quote.Status.Should().Be(QuoteStatus.Draft);
        quote.QuoteNumber.Should().Be("BQ-100001");
        quote.VersionNumber.Should().Be(1);
        quote.LineItems.Should().HaveCount(2);

        // Calculations:
        // Item 1: Gross = 800, Disc = 0, Subtotal = 800, Tax (18%) = 144, Total = 944
        // Item 2: Gross = 2400, Disc = 200, Subtotal = 2200, Tax (18%) = 396, Total = 2596
        // Header: Subtotal = 3200, Discount = 200, Tax = 540, Total = 3540
        quote.Subtotal.Should().Be(3200.00m);
        quote.DiscountAmount.Should().Be(200.00m);
        quote.TaxAmount.Should().Be(540.00m);
        quote.TotalAmount.Should().Be(3540.00m);
    }

    [Fact]
    public void LineItem_ValidCalculations_CalculatesSubtotalTaxAndTotal()
    {
        // Arrange & Act
        var item = new GarageQuoteLineItem(
            garageQuoteId: Guid.NewGuid(),
            lineType: QuoteLineType.Part,
            description: "Engine Oil 5W30",
            quantity: 3.5m,
            unitPrice: 500m,
            taxRate: 18m,
            discountAmount: 100m,
            sortOrder: 1);

        // Gross = 3.5 * 500 = 1750
        // ItemSubtotal = 1750 - 100 = 1650
        // LineTax = 1650 * 0.18 = 297
        // LineTotal = 1650 + 297 = 1947
        item.ItemSubtotal.Should().Be(1650.00m);
        item.LineTax.Should().Be(297.00m);
        item.LineTotal.Should().Be(1947.00m);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(-5.5)]
    public void LineItem_ZeroOrNegativeQuantity_ThrowsArgumentOutOfRangeException(decimal quantity)
    {
        Action act = () => new GarageQuoteLineItem(
            garageQuoteId: Guid.NewGuid(),
            lineType: QuoteLineType.Labour,
            description: "Oil change labour",
            quantity: quantity,
            unitPrice: 500m);

        act.Should().Throw<ArgumentOutOfRangeException>()
            .WithMessage("*Quantity must be greater than zero*");
    }

    [Theory]
    [InlineData(-0.01)]
    [InlineData(-500)]
    public void LineItem_NegativeUnitPrice_ThrowsArgumentOutOfRangeException(decimal unitPrice)
    {
        Action act = () => new GarageQuoteLineItem(
            garageQuoteId: Guid.NewGuid(),
            lineType: QuoteLineType.Labour,
            description: "Labour",
            quantity: 1,
            unitPrice: unitPrice);

        act.Should().Throw<ArgumentOutOfRangeException>()
            .WithMessage("*UnitPrice cannot be negative*");
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(-18)]
    public void LineItem_NegativeTaxRate_ThrowsArgumentOutOfRangeException(decimal taxRate)
    {
        Action act = () => new GarageQuoteLineItem(
            garageQuoteId: Guid.NewGuid(),
            lineType: QuoteLineType.Part,
            description: "Filter",
            quantity: 1,
            unitPrice: 300m,
            taxRate: taxRate);

        act.Should().Throw<ArgumentOutOfRangeException>()
            .WithMessage("*TaxRate cannot be negative*");
    }

    [Fact]
    public void LineItem_DiscountExceedingGrossAmount_ThrowsArgumentOutOfRangeException()
    {
        Action act = () => new GarageQuoteLineItem(
            garageQuoteId: Guid.NewGuid(),
            lineType: QuoteLineType.Service,
            description: "Full service pack",
            quantity: 1,
            unitPrice: 1000m,
            taxRate: 18m,
            discountAmount: 1200m); // Discount > Gross

        act.Should().Throw<ArgumentOutOfRangeException>()
            .WithMessage("*DiscountAmount cannot exceed gross line item amount*");
    }

    [Fact]
    public void UpdateDraft_InDraftStatus_UpdatesFieldsAndRecalculatesTotals()
    {
        // Arrange
        var quote = new GarageQuote(
            _garageRequestId, _garageId, _serviceRequestId, "BQ-100002",
            validUntil: DateTime.UtcNow.AddDays(5));

        quote.AddLineItem(QuoteLineType.Labour, "Diagnosis", 1, 500m, 18m, 0m);

        // Act
        quote.UpdateDraft(
            estimatedCompletionHours: 8,
            estimatedCompletionDays: 2,
            validUntil: DateTime.UtcNow.AddDays(10),
            garageRemarks: "Revised diagnostic inspection with suspension check",
            updatedByUserId: _userId);

        quote.ClearLineItems();
        quote.AddLineItem(QuoteLineType.Labour, "Comprehensive Diagnosis", 2, 600m, 18m, 100m);

        // Assert
        quote.EstimatedCompletionHours.Should().Be(8);
        quote.EstimatedCompletionDays.Should().Be(2);
        quote.GarageRemarks.Should().Be("Revised diagnostic inspection with suspension check");
        quote.LineItems.Should().HaveCount(1);
        // Gross = 1200, Disc = 100, Subtotal = 1100, Tax = 198, Total = 1298
        quote.Subtotal.Should().Be(1200.00m);
        quote.DiscountAmount.Should().Be(100.00m);
        quote.TaxAmount.Should().Be(198.00m);
        quote.TotalAmount.Should().Be(1298.00m);
    }

    [Fact]
    public void UpdateDraft_WhenNotDraft_ThrowsInvalidOperationException()
    {
        // Arrange
        var quote = new GarageQuote(_garageRequestId, _garageId, _serviceRequestId, "BQ-100003",
            validUntil: DateTime.UtcNow.AddDays(5));
        quote.AddLineItem(QuoteLineType.Service, "Inspection", 1, 500m, 0m, 0m);
        quote.Submit(_userId);

        // Act
        Action act = () => quote.UpdateDraft(4, 1, DateTime.UtcNow.AddDays(5), "Attempted update after submit");

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*Cannot update quote draft on a quote in 'Submitted' state*");
    }

    [Fact]
    public void Submit_WithValidDraft_CreatesSnapshotVersionAndMarksSubmitted()
    {
        // Arrange
        var quote = new GarageQuote(_garageRequestId, _garageId, _serviceRequestId, "BQ-100004",
            validUntil: DateTime.UtcNow.AddDays(5),
            estimatedCompletionDays: 2,
            garageRemarks: "Ready for drop-off");

        quote.AddLineItem(QuoteLineType.Labour, "Clutch Replacement", 1, 2000m, 18m, 0m);
        quote.AddLineItem(QuoteLineType.Part, "Clutch Plate Kit", 1, 5000m, 28m, 500m);

        // Act
        quote.Submit(_userId, "idemp-key-123");

        // Assert
        quote.Status.Should().Be(QuoteStatus.Submitted);
        quote.SubmittedAtUtc.Should().NotBeNull();
        quote.SubmittedByUserId.Should().Be(_userId);
        quote.IdempotencyKey.Should().Be("idemp-key-123");

        // Version history snapshot
        quote.Versions.Should().HaveCount(1);
        var v1 = quote.Versions.First();
        v1.VersionNumber.Should().Be(1);
        v1.Subtotal.Should().Be(quote.Subtotal);
        v1.TotalAmount.Should().Be(quote.TotalAmount);
        v1.LineItemsJson.Should().Contain("Clutch Replacement");
        v1.LineItemsJson.Should().Contain("Clutch Plate Kit");
        v1.SubmittedByUserId.Should().Be(_userId);
    }

    [Fact]
    public void Submit_WhenNoLineItems_ThrowsInvalidOperationException()
    {
        var quote = new GarageQuote(_garageRequestId, _garageId, _serviceRequestId, "BQ-100005",
            validUntil: DateTime.UtcNow.AddDays(5));

        Action act = () => quote.Submit(_userId);

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*Cannot submit a quote without any line items*");
    }

    [Fact]
    public void Submit_WhenPastValidUntil_ThrowsInvalidOperationException()
    {
        var quote = new GarageQuote(_garageRequestId, _garageId, _serviceRequestId, "BQ-100006",
            validUntil: DateTime.UtcNow.AddMinutes(-5));
        quote.AddLineItem(QuoteLineType.Labour, "Fast inspection", 1, 500m, 0m, 0m);

        Action act = () => quote.Submit(_userId);

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*Cannot submit an expired quote*");
    }

    [Fact]
    public void Submit_WhenAlreadySubmittedWithoutMatchingIdempotencyKey_ThrowsInvalidOperationException()
    {
        var quote = new GarageQuote(_garageRequestId, _garageId, _serviceRequestId, "BQ-100007",
            validUntil: DateTime.UtcNow.AddDays(5));
        quote.AddLineItem(QuoteLineType.Part, "Wiper Blades", 2, 400m, 18m, 0m);
        quote.Submit(_userId, "first-key");

        Action act = () => quote.Submit(_userId, "second-key");

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*Quote has already been submitted*");
    }

    [Fact]
    public void Submit_WhenAlreadySubmittedWithMatchingIdempotencyKey_DoesNotThrow()
    {
        var quote = new GarageQuote(_garageRequestId, _garageId, _serviceRequestId, "BQ-100008",
            validUntil: DateTime.UtcNow.AddDays(5));
        quote.AddLineItem(QuoteLineType.Part, "Wiper Blades", 2, 400m, 18m, 0m);
        quote.Submit(_userId, "same-idemp-key");

        // Calling submit again with same key should be a no-op idempotent success
        Action act = () => quote.Submit(_userId, "same-idemp-key");
        act.Should().NotThrow();
        quote.Versions.Should().HaveCount(1);
    }

    [Fact]
    public void CreateRevision_FromSubmittedQuote_IncrementsVersionAndReturnsToDraftPreservingHistory()
    {
        // Arrange
        var quote = new GarageQuote(_garageRequestId, _garageId, _serviceRequestId, "BQ-100009",
            validUntil: DateTime.UtcNow.AddDays(5));
        quote.AddLineItem(QuoteLineType.Labour, "Original Diagnostic", 1, 1000m, 18m, 0m);
        quote.Submit(_userId);

        quote.VersionNumber.Should().Be(1);
        quote.Status.Should().Be(QuoteStatus.Submitted);
        quote.Versions.Should().HaveCount(1);

        // Act
        quote.CreateRevision(_userId);

        // Assert
        quote.VersionNumber.Should().Be(2);
        quote.Status.Should().Be(QuoteStatus.Draft);
        quote.SubmittedAtUtc.Should().BeNull();
        quote.Versions.Should().HaveCount(1); // Historical version 1 preserved

        // We can now update the new revision in Draft
        quote.ClearLineItems();
        quote.AddLineItem(QuoteLineType.Labour, "Revised Comprehensive Diagnostic", 1, 1500m, 18m, 0m);
        quote.Submit(_userId);

        quote.Status.Should().Be(QuoteStatus.Submitted);
        quote.VersionNumber.Should().Be(2);
        quote.Versions.Should().HaveCount(2); // Both v1 and v2 preserved
    }

    [Fact]
    public void CreateRevision_FromDraftQuote_ThrowsInvalidOperationException()
    {
        var quote = new GarageQuote(_garageRequestId, _garageId, _serviceRequestId, "BQ-100010",
            validUntil: DateTime.UtcNow.AddDays(5));
        quote.AddLineItem(QuoteLineType.Part, "Oil Filter", 1, 300m, 0m, 0m);

        Action act = () => quote.CreateRevision(_userId);

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*Cannot create a revision for a quote in 'Draft' state*");
    }

    [Fact]
    public void Withdraw_WhenSubmitted_TransitionsToWithdrawnWithReason()
    {
        // Arrange
        var quote = new GarageQuote(_garageRequestId, _garageId, _serviceRequestId, "BQ-100011",
            validUntil: DateTime.UtcNow.AddDays(5));
        quote.AddLineItem(QuoteLineType.Part, "Brake Fluid", 1, 400m, 18m, 0m);
        quote.Submit(_userId);

        // Act
        quote.Withdraw(_userId, "Out of replacement parts in stock");

        // Assert
        quote.Status.Should().Be(QuoteStatus.Withdrawn);
        quote.WithdrawnAtUtc.Should().NotBeNull();
        quote.WithdrawalReason.Should().Be("Out of replacement parts in stock");
    }

    [Fact]
    public void MarkExpired_TransitionsStatusToExpired()
    {
        var quote = new GarageQuote(_garageRequestId, _garageId, _serviceRequestId, "BQ-100012",
            validUntil: DateTime.UtcNow.AddDays(-1));

        quote.MarkExpired();

        quote.Status.Should().Be(QuoteStatus.Expired);
        quote.ExpiredAtUtc.Should().NotBeNull();
    }
}
