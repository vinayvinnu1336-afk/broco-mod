using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace BroCoMod.UnitTests.ServiceJobTests;

/// <summary>The admin-only cancel paths: a BroCo cancellation ends the job and assignment at any stage until the job is closed.</summary>
public class BookingCancellationUnitTests
{
    private static ServiceJob NewJob() => new(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
        "JOB-200001", "Brakes squeal", Guid.NewGuid());

    [Fact]
    public void CancelByAdmin_works_after_the_car_is_at_the_garage()
    {
        var job = NewJob();
        job.ReceiveVehicle(20000, null, null, Guid.NewGuid());
        var admin = Guid.NewGuid();

        job.CancelByAdmin("  Customer asked support to cancel  ", admin);

        job.Status.Should().Be(ServiceJobStatus.Cancelled);
        job.CancellationReason.Should().Be("Customer asked support to cancel");
        job.UpdatedByUserId.Should().Be(admin);
        job.CancelledAtUtc.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(2));
    }

    [Fact]
    public void CancelByAdmin_needs_a_reason_and_refuses_a_cancelled_job()
    {
        var job = NewJob();
        job.Invoking(j => j.CancelByAdmin(" ", Guid.NewGuid())).Should().Throw<ArgumentException>();

        job.CancelByAdmin("Duplicate", Guid.NewGuid());
        job.Invoking(j => j.CancelByAdmin("Again", Guid.NewGuid())).Should().Throw<InvalidOperationException>().WithMessage("*already cancelled*");
    }

    [Fact]
    public void Garage_style_Cancel_still_refuses_after_intake()
    {
        var job = NewJob();
        job.ReceiveVehicle(20000, null, null, Guid.NewGuid());
        job.Invoking(j => j.Cancel("No", Guid.NewGuid())).Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void Assignment_CancelWithBooking_ends_a_confirmed_assignment()
    {
        var assignment = new GarageAssignment(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "Nearest");
        assignment.Confirm();

        assignment.CancelWithBooking("Booking cancelled by BroCo", Guid.NewGuid());

        assignment.Status.Should().Be(GarageAssignmentStatus.Cancelled);
        assignment.CancellationReason.Should().Be("Booking cancelled by BroCo");
        assignment.Invoking(a => a.CancelWithBooking("Again", Guid.NewGuid())).Should().Throw<InvalidOperationException>();
    }
}
