using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace BroCoMod.UnitTests.FinancialTests;

public class PaymentUnitTests
{
    [Fact]
    public void Constructor_WithValidArguments_InitializesCreatedPayment()
    {
        // Arrange
        var customerId = Guid.NewGuid();
        var garageId = Guid.NewGuid();
        var quoteId = Guid.NewGuid();

        // Act
        var payment = new Payment(
            paymentNumber: "PAY-100001",
            customerId: customerId,
            garageId: garageId,
            amount: 15000.50m,
            currency: "INR",
            purpose: PaymentPurpose.ServiceQuotation,
            gatewayProvider: "DevelopmentFake",
            customerQuotationId: quoteId,
            idempotencyKey: "test-idempotency-key-1"
        );

        // Assert
        payment.PaymentNumber.Should().Be("PAY-100001");
        payment.CustomerId.Should().Be(customerId);
        payment.GarageId.Should().Be(garageId);
        payment.Amount.Should().Be(15000.50m);
        payment.Currency.Should().Be("INR");
        payment.Status.Should().Be(PaymentStatus.Created);
        payment.Purpose.Should().Be(PaymentPurpose.ServiceQuotation);
        payment.GatewayProvider.Should().Be("DevelopmentFake");
        payment.CustomerQuotationId.Should().Be(quoteId);
        payment.IdempotencyKey.Should().Be("test-idempotency-key-1");
        payment.RefundedAmount.Should().Be(0.0m);
        payment.PaidAtUtc.Should().BeNull();
        payment.ConcurrencyToken.Should().NotBeEmpty();
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void Constructor_WithEmptyPaymentNumber_ThrowsArgumentException(string? invalidNumber)
    {
        var action = () => new Payment(
            paymentNumber: invalidNumber!,
            customerId: Guid.NewGuid(),
            garageId: Guid.NewGuid(),
            amount: 1000m,
            currency: "INR",
            purpose: PaymentPurpose.ServiceQuotation,
            gatewayProvider: "DevelopmentFake"
        );

        action.Should().Throw<ArgumentException>()
            .WithMessage("*PaymentNumber*");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-100)]
    public void Constructor_WithNonPositiveAmount_ThrowsArgumentException(decimal invalidAmount)
    {
        var action = () => new Payment(
            paymentNumber: "PAY-100002",
            customerId: Guid.NewGuid(),
            garageId: Guid.NewGuid(),
            amount: invalidAmount,
            currency: "INR",
            purpose: PaymentPurpose.ServiceQuotation,
            gatewayProvider: "DevelopmentFake"
        );

        action.Should().Throw<ArgumentException>()
            .WithMessage("*Amount*");
    }

    [Fact]
    public void SetGatewayOrder_FromCreatedState_TransitionsToPending()
    {
        // Arrange
        var payment = CreateSamplePayment();

        // Act
        payment.SetGatewayOrder("ord_gateway_12345");

        // Assert
        payment.GatewayOrderId.Should().Be("ord_gateway_12345");
        payment.Status.Should().Be(PaymentStatus.Pending);
    }

    [Fact]
    public void MarkProcessing_FromPendingState_TransitionsToProcessing()
    {
        // Arrange
        var payment = CreateSamplePayment();
        payment.SetGatewayOrder("ord_gateway_12345");

        // Act
        payment.MarkProcessing();

        // Assert
        payment.Status.Should().Be(PaymentStatus.Processing);
    }

    [Fact]
    public void MarkPaid_FromProcessingState_SetsPaidStatusAndPaymentDetails()
    {
        // Arrange
        var payment = CreateSamplePayment();
        payment.SetGatewayOrder("ord_gateway_12345");
        payment.MarkProcessing();
        var paidAt = DateTime.UtcNow;

        // Act
        payment.MarkPaid("pay_fake_99999", "sig_fake_hmac", paidAt, PaymentMethod.Card);

        // Assert
        payment.Status.Should().Be(PaymentStatus.Paid);
        payment.GatewayPaymentId.Should().Be("pay_fake_99999");
        payment.GatewaySignature.Should().Be("sig_fake_hmac");
        payment.PaidAtUtc.Should().BeCloseTo(paidAt, TimeSpan.FromSeconds(1));
        payment.PaymentMethod.Should().Be(PaymentMethod.Card);
    }

    [Fact]
    public void MarkPaid_WhenAlreadyPaid_IsIdempotentAndDoesNotThrow()
    {
        // Arrange
        var payment = CreateSamplePayment();
        payment.SetGatewayOrder("ord_gateway_12345");
        payment.MarkPaid("pay_fake_99999", null, DateTime.UtcNow);

        // Act & Assert
        payment.Invoking(p => p.MarkPaid("pay_fake_99999", null, DateTime.UtcNow))
            .Should().NotThrow();
        payment.Status.Should().Be(PaymentStatus.Paid);
    }

    [Fact]
    public void MarkPaid_FromFailedState_ThrowsInvalidOperationException()
    {
        // Arrange
        var payment = CreateSamplePayment();
        payment.MarkFailed("Card was declined by issuing bank.");

        // Act & Assert
        payment.Invoking(p => p.MarkPaid("pay_fake_99999", null, DateTime.UtcNow))
            .Should().Throw<InvalidOperationException>()
            .WithMessage("*Failed*");
    }

    [Fact]
    public void MarkFailed_WhenAlreadyPaid_ThrowsInvalidOperationException()
    {
        // Arrange
        var payment = CreateSamplePayment();
        payment.MarkPaid("pay_fake_99999", null, DateTime.UtcNow);

        // Act & Assert
        payment.Invoking(p => p.MarkFailed("Error after capture"))
            .Should().Throw<InvalidOperationException>()
            .WithMessage("*Paid*");
    }

    [Fact]
    public void MarkCancelled_FromCreatedState_TransitionsToCancelled()
    {
        // Arrange
        var payment = CreateSamplePayment();

        // Act
        payment.MarkCancelled("Customer abandoned checkout");

        // Assert
        payment.Status.Should().Be(PaymentStatus.Cancelled);
        payment.FailureReason.Should().Be("Customer abandoned checkout");
    }

    [Fact]
    public void RecordRefund_PartialRefund_TransitionsToPartiallyRefunded()
    {
        // Arrange
        var payment = CreateSamplePayment(amount: 10000m);
        payment.MarkPaid("pay_fake_123", null, DateTime.UtcNow);

        // Act
        payment.RecordRefund(4000m, "Customer requested partial component return");

        // Assert
        payment.RefundedAmount.Should().Be(4000m);
        payment.Status.Should().Be(PaymentStatus.PartiallyRefunded);
    }

    [Fact]
    public void RecordRefund_FullRefund_TransitionsToRefunded()
    {
        // Arrange
        var payment = CreateSamplePayment(amount: 10000m);
        payment.MarkPaid("pay_fake_123", null, DateTime.UtcNow);

        // Act
        payment.RecordRefund(4000m, "Partial");
        payment.RecordRefund(6000m, "Remaining full refund");

        // Assert
        payment.RefundedAmount.Should().Be(10000m);
        payment.Status.Should().Be(PaymentStatus.Refunded);
    }

    [Fact]
    public void RecordRefund_ExceedingAmount_ThrowsInvalidOperationException()
    {
        // Arrange
        var payment = CreateSamplePayment(amount: 5000m);
        payment.MarkPaid("pay_fake_123", null, DateTime.UtcNow);

        // Act & Assert
        payment.Invoking(p => p.RecordRefund(6000m, "Over refund"))
            .Should().Throw<InvalidOperationException>()
            .WithMessage("*cannot exceed*");
    }

    [Fact]
    public void RecordRefund_OnUnpaidPayment_ThrowsInvalidOperationException()
    {
        // Arrange
        var payment = CreateSamplePayment(amount: 5000m);

        // Act & Assert
        payment.Invoking(p => p.RecordRefund(1000m, "Refund uncaptured"))
            .Should().Throw<InvalidOperationException>()
            .WithMessage("*status Created*");
    }

    private static Payment CreateSamplePayment(decimal amount = 10000m)
    {
        return new Payment(
            paymentNumber: "PAY-SAMPLE-1",
            customerId: Guid.NewGuid(),
            garageId: Guid.NewGuid(),
            amount: amount,
            currency: "INR",
            purpose: PaymentPurpose.ServiceQuotation,
            gatewayProvider: "DevelopmentFake"
        );
    }
}
