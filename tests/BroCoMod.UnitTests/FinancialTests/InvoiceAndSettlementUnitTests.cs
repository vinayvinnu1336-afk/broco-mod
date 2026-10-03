using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace BroCoMod.UnitTests.FinancialTests;

public class InvoiceAndSettlementUnitTests
{
    [Fact]
    public void Invoice_Constructor_WithValidArguments_InitializesIssuedInvoice()
    {
        // Arrange
        var paymentId = Guid.NewGuid();
        var customerId = Guid.NewGuid();
        var garageId = Guid.NewGuid();

        // Act
        var invoice = new Invoice(
            invoiceNumber: "INV-100001",
            paymentId: paymentId,
            customerId: customerId,
            garageId: garageId,
            subtotal: 10000m,
            discountAmount: 1000m,
            taxAmount: 1620m,
            totalAmount: 10620m,
            billingName: "Rohit Sharma",
            billingEmail: "rohit@example.com",
            billingAddress: "Mumbai, Maharashtra",
            lineItemsJson: "[{\"description\":\"Front Brake Pads\",\"price\":5000}]",
            currency: "INR"
        );

        // Assert
        invoice.InvoiceNumber.Should().Be("INV-100001");
        invoice.PaymentId.Should().Be(paymentId);
        invoice.CustomerId.Should().Be(customerId);
        invoice.GarageId.Should().Be(garageId);
        invoice.Subtotal.Should().Be(10000m);
        invoice.DiscountAmount.Should().Be(1000m);
        invoice.TaxAmount.Should().Be(1620m);
        invoice.TotalAmount.Should().Be(10620m);
        invoice.BillingName.Should().Be("Rohit Sharma");
        invoice.BillingEmail.Should().Be("rohit@example.com");
        invoice.Status.Should().Be(InvoiceStatus.Issued);
        invoice.PaidAtUtc.Should().BeNull();
    }

    [Fact]
    public void Invoice_MarkPaid_UpdatesStatusAndTimestamp()
    {
        // Arrange
        var invoice = CreateSampleInvoice();
        var paidAt = DateTime.UtcNow;

        // Act
        invoice.MarkPaid(paidAt);

        // Assert
        invoice.Status.Should().Be(InvoiceStatus.Paid);
        invoice.PaidAtUtc.Should().BeCloseTo(paidAt, TimeSpan.FromSeconds(1));
    }

    [Fact]
    public void Invoice_MarkVoid_UpdatesStatusAndRecordsReason()
    {
        // Arrange
        var invoice = CreateSampleInvoice();

        // Act
        invoice.MarkVoid("Billing error identified by accounting.");

        // Assert
        invoice.Status.Should().Be(InvoiceStatus.Void);
        invoice.VoidReason.Should().Be("Billing error identified by accounting.");
        invoice.VoidedAtUtc.Should().NotBeNull();
    }

    [Fact]
    public void Invoice_MarkPaid_WhenVoid_ThrowsInvalidOperationException()
    {
        // Arrange
        var invoice = CreateSampleInvoice();
        invoice.MarkVoid("Cancelled due to disputed transaction.");

        // Act & Assert
        invoice.Invoking(i => i.MarkPaid(DateTime.UtcNow))
            .Should().Throw<InvalidOperationException>()
            .WithMessage("*voided*");
    }

    [Fact]
    public void GarageSettlement_CalculatesAuthoritativeNetPayable_Correctly()
    {
        // Arrange: Gross = 20,000 INR, Fee% = 10%, Fixed = 500 INR, Tax% = 18% (GST)
        var gross = 20000m;
        var feePercent = 10m;
        var feeFixed = 500m;
        var taxPercent = 18m;

        // Act
        var settlement = new GarageSettlement(
            settlementNumber: "SET-100001",
            garageId: Guid.NewGuid(),
            serviceJobId: Guid.NewGuid(),
            paymentId: Guid.NewGuid(),
            grossAmount: gross,
            platformFeePercentage: feePercent,
            platformFeeFixed: feeFixed,
            taxPercentageOnFee: taxPercent,
            currency: "INR"
        );

        // Expected:
        // Percentage fee: 20000 * 0.10 = 2000
        // Total platform fee before tax: 2000 + 500 = 2500
        // Tax on fee (18% GST): 2500 * 0.18 = 450
        // Total platform fee: 2500 + 450 = 2950
        // Net payable to workshop: 20000 - 2950 = 17050
        settlement.GrossAmount.Should().Be(20000m);
        settlement.PlatformFeeAmount.Should().Be(2500m);
        settlement.TaxOnPlatformFee.Should().Be(450m);
        settlement.TotalPlatformFee.Should().Be(2950m);
        settlement.NetPayableToGarage.Should().Be(17050m);
        settlement.Status.Should().Be(SettlementStatus.Pending);
    }

    [Fact]
    public void GarageSettlement_StateTransitions_PendingToProcessingToCompleted()
    {
        // Arrange
        var settlement = new GarageSettlement(
            settlementNumber: "SET-100002",
            garageId: Guid.NewGuid(),
            serviceJobId: Guid.NewGuid(),
            paymentId: Guid.NewGuid(),
            grossAmount: 10000m,
            platformFeePercentage: 10m,
            platformFeeFixed: 0m,
            taxPercentageOnFee: 18m
        );

        // Act 1: Processing
        settlement.MarkProcessing();
        settlement.Status.Should().Be(SettlementStatus.Processing);

        // Act 2: Completed
        settlement.MarkCompleted("NEFT-UTIB-20261003-99988", "Disbursed via bank portal");
        settlement.Status.Should().Be(SettlementStatus.Completed);
        settlement.PayoutTransactionRef.Should().Be("NEFT-UTIB-20261003-99988");
        settlement.SettledAtUtc.Should().NotBeNull();
        settlement.ReferenceNotes.Should().Be("Disbursed via bank portal");
    }

    [Fact]
    public void GarageSettlement_CannotCancelOrHold_WhenCompleted()
    {
        // Arrange
        var settlement = new GarageSettlement(
            settlementNumber: "SET-100003",
            garageId: Guid.NewGuid(),
            serviceJobId: Guid.NewGuid(),
            paymentId: Guid.NewGuid(),
            grossAmount: 5000m,
            platformFeePercentage: 10m,
            platformFeeFixed: 0m,
            taxPercentageOnFee: 18m
        );
        settlement.MarkCompleted("TXN-12345");

        // Act & Assert
        settlement.Invoking(s => s.MarkOnHold("Delay"))
            .Should().Throw<InvalidOperationException>()
            .WithMessage("*completed*");

        settlement.Invoking(s => s.MarkCancelled("Cancelled"))
            .Should().Throw<InvalidOperationException>()
            .WithMessage("*completed*");
    }

    [Fact]
    public void AdditionalWorkQuotation_AcceptAndReject_TransitionsStatus()
    {
        // Arrange
        var awq = new AdditionalWorkQuotation(
            quotationNumber: "AWQ-100001",
            serviceJobId: Guid.NewGuid(),
            additionalWorkRequestId: Guid.NewGuid(),
            customerId: Guid.NewGuid(),
            garageId: Guid.NewGuid(),
            subtotal: 3000m,
            tax: 540m,
            total: 3540m,
            description: "Discovered worn serpentine belt during engine inspection."
        );

        awq.Status.Should().Be(CustomerQuotationStatus.Sent);
        awq.Total.Should().Be(3540m);

        // Act: Accept
        awq.Accept();
        awq.Status.Should().Be(CustomerQuotationStatus.Accepted);
        awq.CustomerRespondedAtUtc.Should().NotBeNull();
    }

    private static Invoice CreateSampleInvoice()
    {
        return new Invoice(
            invoiceNumber: "INV-SAMPLE-1",
            paymentId: Guid.NewGuid(),
            customerId: Guid.NewGuid(),
            garageId: Guid.NewGuid(),
            subtotal: 5000m,
            discountAmount: 0m,
            taxAmount: 900m,
            totalAmount: 5900m,
            billingName: "Customer Name",
            billingEmail: "cust@example.com",
            billingAddress: null,
            lineItemsJson: "[]"
        );
    }
}
