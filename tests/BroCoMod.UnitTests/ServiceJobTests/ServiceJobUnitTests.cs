using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace BroCoMod.UnitTests.ServiceJobTests;

public class ServiceJobUnitTests
{
    private static ServiceJob CreateTestJob()
    {
        return new ServiceJob(
            serviceRequestId: Guid.NewGuid(),
            garageAssignmentId: Guid.NewGuid(),
            customerQuotationId: Guid.NewGuid(),
            garageId: Guid.NewGuid(),
            jobNumber: "JOB-100001",
            customerComplaintSnapshot: "Brake squeaking and periodic oil leak.",
            createdByUserId: Guid.NewGuid()
        );
    }

    [Fact]
    public void ServiceJob_Constructor_InitializesCorrectly_InBookingConfirmedState()
    {
        var requestId = Guid.NewGuid();
        var assignmentId = Guid.NewGuid();
        var quotationId = Guid.NewGuid();
        var garageId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var job = new ServiceJob(
            requestId,
            assignmentId,
            quotationId,
            garageId,
            "JOB-100001",
            "General Maintenance",
            userId
        );

        job.ServiceRequestId.Should().Be(requestId);
        job.GarageAssignmentId.Should().Be(assignmentId);
        job.CustomerQuotationId.Should().Be(quotationId);
        job.GarageId.Should().Be(garageId);
        job.JobNumber.Should().Be("JOB-100001");
        job.Status.Should().Be(ServiceJobStatus.BookingConfirmed);
        job.CustomerComplaintSnapshot.Should().Be("General Maintenance");
        job.CreatedByUserId.Should().Be(userId);
        job.ConcurrencyToken.Should().NotBeEmpty();
    }

    [Fact]
    public void ServiceJob_Schedule_TransitionsToScheduled_AndUpdatesConcurrencyToken()
    {
        var job = CreateTestJob();
        var initialToken = job.ConcurrencyToken;
        var start = DateTime.UtcNow.AddDays(1);
        var end = DateTime.UtcNow.AddDays(2);
        var userId = Guid.NewGuid();

        job.Schedule(start, end, userId);

        job.Status.Should().Be(ServiceJobStatus.Scheduled);
        job.ScheduledStartAtUtc.Should().BeCloseTo(start, TimeSpan.FromSeconds(1));
        job.EstimatedCompletionAtUtc.Should().BeCloseTo(end, TimeSpan.FromSeconds(1));
        job.UpdatedByUserId.Should().Be(userId);
        job.ConcurrencyToken.Should().NotBe(initialToken);
    }

    [Fact]
    public void ServiceJob_Schedule_Throws_WhenEstimatedCompletionBeforeStart()
    {
        var job = CreateTestJob();
        var start = DateTime.UtcNow.AddDays(2);
        var end = DateTime.UtcNow.AddDays(1);

        var act = () => job.Schedule(start, end, Guid.NewGuid());

        act.Should().Throw<ArgumentException>()
            .WithMessage("*completion*");
    }

    [Fact]
    public void ServiceJob_Schedule_Throws_WhenNotInValidState()
    {
        var job = CreateTestJob();
        job.ReceiveVehicle(50000, "Notes", null, Guid.NewGuid());

        var act = () => job.Schedule(DateTime.UtcNow, DateTime.UtcNow.AddHours(2), Guid.NewGuid());

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*Cannot schedule job in 'VehicleReceived' state*");
    }

    [Fact]
    public void ServiceJob_ReceiveVehicle_TransitionsToVehicleReceived_SetsMileageAndTimestamps()
    {
        var job = CreateTestJob();
        var userId = Guid.NewGuid();

        job.ReceiveVehicle(45200, "Minor scratch on bumper.", "Checked in at reception.", userId);

        job.Status.Should().Be(ServiceJobStatus.VehicleReceived);
        job.CurrentMileageKm.Should().Be(45200);
        job.ActualVehicleReceivedAtUtc.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(2));
        job.GarageInternalNotes.Should().Be("Minor scratch on bumper.");
        job.CustomerFacingNotes.Should().Be("Checked in at reception.");
        job.UpdatedByUserId.Should().Be(userId);
    }

    [Fact]
    public void ServiceJob_ReceiveVehicle_Throws_WhenMileageIsNegative()
    {
        var job = CreateTestJob();

        var act = () => job.ReceiveVehicle(-10, "Note", null, Guid.NewGuid());

        act.Should().Throw<ArgumentException>()
            .WithMessage("*Current mileage cannot be negative.*");
    }

    [Fact]
    public void ServiceJob_StartInspection_TransitionsToInspection_FromVehicleReceived()
    {
        var job = CreateTestJob();
        job.ReceiveVehicle(30000, null, null, Guid.NewGuid());

        job.StartInspection(Guid.NewGuid());

        job.Status.Should().Be(ServiceJobStatus.Inspection);
    }

    [Fact]
    public void ServiceJob_StartInspection_Throws_WhenNotInVehicleReceivedState()
    {
        var job = CreateTestJob();

        var act = () => job.StartInspection(Guid.NewGuid());

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*Cannot start inspection in 'BookingConfirmed' state*");
    }

    [Fact]
    public void ServiceJob_CompleteInspection_Succeeds_WhenInInspectionState()
    {
        var job = CreateTestJob();
        job.ReceiveVehicle(20000, null, null, Guid.NewGuid());
        job.StartInspection(Guid.NewGuid());

        job.CompleteInspection(Guid.NewGuid());

        job.Status.Should().Be(ServiceJobStatus.Inspection);
    }

    [Fact]
    public void ServiceJob_CompleteInspection_Throws_WhenNotInInspectionState()
    {
        var job = CreateTestJob();

        var act = () => job.CompleteInspection(Guid.NewGuid());

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*Cannot complete inspection in 'BookingConfirmed' state*");
    }

    [Fact]
    public void ServiceJob_StartWork_TransitionsToWorkStarted()
    {
        var job = CreateTestJob();
        job.ReceiveVehicle(15000, null, null, Guid.NewGuid());
        job.StartInspection(Guid.NewGuid());
        job.CompleteInspection(Guid.NewGuid());

        job.StartWork(Guid.NewGuid());

        job.Status.Should().Be(ServiceJobStatus.WorkStarted);
        job.ActualWorkStartedAtUtc.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(2));
    }

    [Fact]
    public void ServiceJob_UpdateProgress_TransitionsToWorkInProgress_AndLogsNotes()
    {
        var job = CreateTestJob();
        job.ReceiveVehicle(15000, null, null, Guid.NewGuid());
        job.StartWork(Guid.NewGuid());

        job.UpdateProgress("Mechanic disassembled front suspension.", "Brake pad replacement underway.", Guid.NewGuid());

        job.Status.Should().Be(ServiceJobStatus.WorkInProgress);
        job.GarageInternalNotes.Should().Be("Mechanic disassembled front suspension.");
        job.CustomerFacingNotes.Should().Be("Brake pad replacement underway.");
    }

    [Fact]
    public void ServiceJob_CompleteWork_TransitionsToWorkCompleted()
    {
        var job = CreateTestJob();
        job.ReceiveVehicle(15000, null, null, Guid.NewGuid());
        job.StartWork(Guid.NewGuid());
        job.UpdateProgress(null, "Work in progress", Guid.NewGuid());

        job.CompleteWork(Guid.NewGuid());

        job.Status.Should().Be(ServiceJobStatus.WorkCompleted);
        job.ActualWorkCompletedAtUtc.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(2));
    }

    [Fact]
    public void ServiceJob_MarkVehicleReady_TransitionsToVehicleReady_FromWorkCompleted()
    {
        var job = CreateTestJob();
        job.ReceiveVehicle(15000, null, null, Guid.NewGuid());
        job.StartWork(Guid.NewGuid());
        job.CompleteWork(Guid.NewGuid());

        job.MarkVehicleReady("Vehicle washed, vacuumed and tested.", Guid.NewGuid());

        job.Status.Should().Be(ServiceJobStatus.VehicleReady);
        job.VehicleReadyAtUtc.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(2));
        job.CustomerFacingNotes.Should().Be("Vehicle washed, vacuumed and tested.");
    }

    [Fact]
    public void ServiceJob_MarkVehicleReady_Throws_WhenWorkNotCompleted()
    {
        var job = CreateTestJob();
        job.ReceiveVehicle(15000, null, null, Guid.NewGuid());
        job.StartWork(Guid.NewGuid());

        var act = () => job.MarkVehicleReady("Ready", Guid.NewGuid());

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*Cannot mark vehicle ready in 'WorkStarted' state*");
    }

    [Fact]
    public void ServiceJob_HandOverVehicle_TransitionsToHandedOver_FromVehicleReady()
    {
        var job = CreateTestJob();
        job.ReceiveVehicle(15000, null, null, Guid.NewGuid());
        job.StartWork(Guid.NewGuid());
        job.CompleteWork(Guid.NewGuid());
        job.MarkVehicleReady("Ready", Guid.NewGuid());

        job.HandOverVehicle("Handed keys to customer after road test.", Guid.NewGuid());

        job.Status.Should().Be(ServiceJobStatus.HandedOver);
        job.HandedOverAtUtc.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(2));
    }

    [Fact]
    public void ServiceJob_CloseJob_TransitionsToClosed_FromHandedOver()
    {
        var job = CreateTestJob();
        job.ReceiveVehicle(15000, null, null, Guid.NewGuid());
        job.StartWork(Guid.NewGuid());
        job.CompleteWork(Guid.NewGuid());
        job.MarkVehicleReady("Ready", Guid.NewGuid());
        job.HandOverVehicle("Handed over", Guid.NewGuid());

        job.CloseJob("All payment reconciled and warranty registered.", Guid.NewGuid());

        job.Status.Should().Be(ServiceJobStatus.Closed);
        job.ClosedAtUtc.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(2));
    }

    [Fact]
    public void ServiceJob_CloseJob_Throws_WhenNotHandedOver()
    {
        var job = CreateTestJob();
        job.ReceiveVehicle(15000, null, null, Guid.NewGuid());
        job.StartWork(Guid.NewGuid());
        job.CompleteWork(Guid.NewGuid());
        job.MarkVehicleReady("Ready", Guid.NewGuid());

        var act = () => job.CloseJob("Close", Guid.NewGuid());

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*Cannot close job in 'VehicleReady' state. Allowed only when 'HandedOver'*");
    }

    [Fact]
    public void ServiceJob_Cancel_Succeeds_BeforePhysicalIntake()
    {
        var job = CreateTestJob();

        job.Cancel("Customer had an emergency and cannot bring vehicle today.", Guid.NewGuid());

        job.Status.Should().Be(ServiceJobStatus.Cancelled);
        job.CancellationReason.Should().Be("Customer had an emergency and cannot bring vehicle today.");
        job.CancelledAtUtc.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(2));
    }

    [Fact]
    public void ServiceJob_Cancel_Throws_AfterVehicleReceived()
    {
        var job = CreateTestJob();
        job.ReceiveVehicle(20000, null, null, Guid.NewGuid());

        var act = () => job.Cancel("Cancel now", Guid.NewGuid());

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*Cancellation is permitted only before physical vehicle intake*");
    }

    [Fact]
    public void ServiceInspection_Segregates_InternalFindings_FromCustomerSummary()
    {
        var jobId = Guid.NewGuid();
        var inspectorId = Guid.NewGuid();

        var inspection = new ServiceInspection(jobId, inspectorId, InspectionSeverity.Medium);
        inspection.Complete(
            findings: "Internal mechanical: Transmission seal showing early weep, 15% brake pad lining left.",
            recommendations: "Replace front brake pads during this visit; monitor transmission seal at next 5,000 km.",
            customerVisibleSummary: "General mechanical check completed. Brake pads will be replaced as planned.",
            severity: InspectionSeverity.Medium
        );

        inspection.ServiceJobId.Should().Be(jobId);
        inspection.InspectorUserId.Should().Be(inspectorId);
        inspection.OverallSeverity.Should().Be(InspectionSeverity.Medium);
        inspection.Findings.Should().Contain("Transmission seal showing early weep");
        inspection.Recommendations.Should().Contain("monitor transmission seal");
        inspection.CustomerVisibleSummary.Should().Be("General mechanical check completed. Brake pads will be replaced as planned.");
        inspection.CustomerVisibleSummary.Should().NotContain("Transmission seal");
        inspection.InspectionCompletedAtUtc.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(2));
    }

    [Fact]
    public void AdditionalWorkRequest_ApproveAndReject_FollowsLifecycle()
    {
        var jobId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var advisorId = Guid.NewGuid();

        var req = new AdditionalWorkRequest(
            jobId,
            "Auxiliary serpentine belt replacement",
            2450.00m,
            "Severe micro-cracking observed during intake inspection.",
            userId
        );

        req.Status.Should().Be(AdditionalWorkStatus.PendingAdvisorReview);
        req.EstimatedAdditionalAmount.Should().Be(2450.00m);

        req.Approve(advisorId, "Confirmed necessary safety repair.");
        req.Status.Should().Be(AdditionalWorkStatus.Approved);
        req.ReviewedByAdvisorId.Should().Be(advisorId);
        req.AdvisorRemarks.Should().Be("Confirmed necessary safety repair.");
        req.ReviewedAtUtc.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(2));

        // Invariant: cannot reject once approved
        var act = () => req.Reject(advisorId, "Too late");
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*Cannot reject additional work request in 'Approved' state*");
    }
}
