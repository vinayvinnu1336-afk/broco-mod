using BroCoMod.Domain.Constants;
using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace BroCoMod.UnitTests.AdminOperationsTests;

public class AdminOperationsUnitTests
{
    private static Garage CreateTestGarage(
        bool isVerified = true,
        bool isOperational = true,
        GarageStatus? status = null,
        double serviceRadiusKm = 10.0)
    {
        return new Garage(
            name: "Apex Auto Care",
            email: "service@apexauto.com",
            phoneNumber: "+91 98765 43210",
            address: "123 Industrial Area, Bengaluru",
            longitude: 77.5946,
            latitude: 12.9716,
            isVerified: isVerified,
            isOperational: isOperational,
            status: status,
            serviceRadiusKm: serviceRadiusKm);
    }

    [Fact]
    public void Garage_InitializesWithPendingVerification_WhenIsVerifiedIsFalse()
    {
        var garage = CreateTestGarage(isVerified: false);

        garage.Status.Should().Be(GarageStatus.PendingVerification);
        garage.IsVerified.Should().BeFalse();
        garage.IsActive.Should().BeTrue();
        garage.IsOperational.Should().BeTrue();
        garage.ServiceRadiusKm.Should().Be(10.0);
    }

    [Fact]
    public void Garage_InitializesWithVerified_WhenIsVerifiedIsTrue()
    {
        var garage = CreateTestGarage(isVerified: true);

        garage.Status.Should().Be(GarageStatus.Verified);
        garage.IsVerified.Should().BeTrue();
        garage.IsActive.Should().BeTrue();
        garage.IsOperational.Should().BeTrue();
    }

    [Fact]
    public void Garage_Verify_TransitionsToVerified_AndUpdatesProperties()
    {
        var garage = CreateTestGarage(isVerified: false);
        var adminId = Guid.NewGuid();

        garage.Verify(adminId);

        garage.Status.Should().Be(GarageStatus.Verified);
        garage.IsVerified.Should().BeTrue();
        garage.IsOperational.Should().BeTrue();
        garage.IsActive.Should().BeTrue();
        garage.StatusReason.Should().BeNull();
        garage.StatusChangedAtUtc.Should().NotBeNull();
    }

    [Fact]
    public void Garage_Verify_ThrowsWhenAlreadyVerified()
    {
        var garage = CreateTestGarage(isVerified: true);
        var adminId = Guid.NewGuid();

        var act = () => garage.Verify(adminId);

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*already verified*");
    }

    [Fact]
    public void Garage_Verify_ThrowsWhenInactive()
    {
        var garage = CreateTestGarage(isVerified: false);
        var adminId = Guid.NewGuid();
        garage.Deactivate("Closed down", adminId);

        var act = () => garage.Verify(adminId);

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*inactive*");
    }

    [Fact]
    public void Garage_Suspend_TransitionsToSuspended_AndSetsOperationalFalse()
    {
        var garage = CreateTestGarage(isVerified: true);
        var adminId = Guid.NewGuid();

        garage.Suspend("Compliance audit failure", adminId);

        garage.Status.Should().Be(GarageStatus.Suspended);
        garage.IsOperational.Should().BeFalse();
        garage.StatusReason.Should().Be("Compliance audit failure");
        garage.StatusChangedAtUtc.Should().NotBeNull();
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void Garage_Suspend_ThrowsWhenReasonEmptyOrWhitespace(string? reason)
    {
        var garage = CreateTestGarage(isVerified: true);
        var adminId = Guid.NewGuid();

        var act = () => garage.Suspend(reason!, adminId);

        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Garage_Suspend_ThrowsWhenAlreadySuspended()
    {
        var garage = CreateTestGarage(isVerified: true);
        var adminId = Guid.NewGuid();
        garage.Suspend("Initial violation", adminId);

        var act = () => garage.Suspend("Second violation", adminId);

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*already suspended*");
    }

    [Fact]
    public void Garage_Activate_TransitionsFromSuspendedToVerified()
    {
        var garage = CreateTestGarage(isVerified: true);
        var adminId = Guid.NewGuid();
        garage.Suspend("Temporary pause", adminId);

        garage.Activate(adminId);

        garage.Status.Should().Be(GarageStatus.Verified);
        garage.IsActive.Should().BeTrue();
        garage.IsOperational.Should().BeTrue();
        garage.StatusReason.Should().BeNull();
    }

    [Fact]
    public void Garage_Deactivate_TransitionsToInactive_AndSetsActiveAndOperationalFalse()
    {
        var garage = CreateTestGarage(isVerified: true);
        var adminId = Guid.NewGuid();

        garage.Deactivate("Ceased operations", adminId);

        garage.Status.Should().Be(GarageStatus.Inactive);
        garage.IsActive.Should().BeFalse();
        garage.IsOperational.Should().BeFalse();
        garage.StatusReason.Should().Be("Ceased operations");
    }

    [Theory]
    [InlineData(1.0)]
    [InlineData(15.5)]
    [InlineData(25.0)]
    [InlineData(50.0)]
    public void Garage_UpdateServiceRadius_SucceedsForValidRadius(double radius)
    {
        var garage = CreateTestGarage();

        garage.UpdateServiceRadius(radius);

        garage.ServiceRadiusKm.Should().Be(radius);
        garage.UpdatedAtUtc.Should().NotBeNull();
    }

    [Theory]
    [InlineData(0.5)]
    [InlineData(0.0)]
    [InlineData(-5.0)]
    [InlineData(50.1)]
    [InlineData(100.0)]
    public void Garage_UpdateServiceRadius_ThrowsWhenOutOfRange(double radius)
    {
        var garage = CreateTestGarage();

        var act = () => garage.UpdateServiceRadius(radius);

        act.Should().Throw<ArgumentOutOfRangeException>()
            .WithMessage("*between 1.0 KM and 50.0 KM*");
    }

    [Fact]
    public void Notification_MarkFailed_SetsStatusAndErrorSummary()
    {
        var notification = new Notification(
            userId: Guid.NewGuid(),
            title: "Booking Alert",
            message: "Your booking is confirmed.",
            type: "BOOKING_CONFIRMED",
            channel: NotificationChannel.Email);

        notification.MarkFailed("SMTP timeout after 30s");

        notification.Status.Should().Be(NotificationStatus.Failed);
        notification.ErrorSummary.Should().Be("SMTP timeout after 30s");
        notification.LastAttemptAtUtc.Should().NotBeNull();
    }

    [Fact]
    public void Notification_MarkSent_SetsStatusSent()
    {
        var notification = new Notification(
            userId: Guid.NewGuid(),
            title: "Booking Alert",
            message: "Your booking is confirmed.",
            type: "BOOKING_CONFIRMED",
            channel: NotificationChannel.Email);

        notification.MarkSent();

        notification.Status.Should().Be(NotificationStatus.Sent);
        notification.SentAtUtc.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
        notification.ErrorSummary.Should().BeNull();
    }

    [Fact]
    public void Notification_Retry_IncrementsRetryCountAndUpdatesTimestamp()
    {
        var notification = new Notification(
            userId: Guid.NewGuid(),
            title: "Booking Alert",
            message: "Your booking is confirmed.",
            type: "BOOKING_CONFIRMED",
            channel: NotificationChannel.Email);

        notification.MarkFailed("Network connection reset");
        notification.Retry();

        notification.Status.Should().Be(NotificationStatus.Sent);
        notification.RetryCount.Should().Be(1);
        notification.LastAttemptAtUtc.Should().NotBeNull();
        notification.ErrorSummary.Should().BeNull();
    }

    [Fact]
    public void AppPermissions_ContainsRequiredAdminOperationsPermissions()
    {
        AppPermissions.AdminDashboardView.Should().Be("ADMIN_DASHBOARD_VIEW");
        AppPermissions.AdminRequestsView.Should().Be("ADMIN_REQUESTS_VIEW");
        AppPermissions.AdminGaragesManage.Should().Be("ADMIN_GARAGES_MANAGE");
        AppPermissions.AdminGaragesView.Should().Be("ADMIN_GARAGES_VIEW");
        AppPermissions.AdminAdvisorsManage.Should().Be("ADMIN_ADVISORS_MANAGE");
        AppPermissions.AdminAdvisorsView.Should().Be("ADMIN_ADVISORS_VIEW");
        AppPermissions.AdminCustomersView.Should().Be("ADMIN_CUSTOMERS_VIEW");
        AppPermissions.AdminJobsView.Should().Be("ADMIN_JOBS_VIEW");
        AppPermissions.AdminAuditView.Should().Be("ADMIN_AUDIT_VIEW");
        AppPermissions.AdminNotificationsView.Should().Be("ADMIN_NOTIFICATIONS_VIEW");
        AppPermissions.AdminNotificationsManage.Should().Be("ADMIN_NOTIFICATIONS_MANAGE");
        AppPermissions.AdminSystemHealthView.Should().Be("ADMIN_SYSTEMHEALTH_VIEW");
        AppPermissions.AdvisorWorkQueueView.Should().Be("ADVISOR_WORKQUEUE_VIEW");
    }
}
