using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Enums;
using FluentAssertions;
using NetTopologySuite.Geometries;
using Xunit;

namespace BroCoMod.UnitTests.ServiceBooking;

public class ServiceBookingUnitTests
{
    [Theory]
    [InlineData(12.9716, 77.5946)] // Bangalore
    [InlineData(0.0, 0.0)]
    [InlineData(-90.0, -180.0)]
    [InlineData(90.0, 180.0)]
    public void ServiceLocation_ValidCoordinates_CreatesSuccessfully(double lat, double lon)
    {
        // Act
        var location = new ServiceLocation(
            addressLine1: "123 Main St",
            addressLine2: null,
            city: "Bengaluru",
            state: "Karnataka",
            pincode: "560001",
            latitude: lat,
            longitude: lon);

        // Assert
        location.Latitude.Should().Be(lat);
        location.Longitude.Should().Be(lon);
        location.Location.X.Should().Be(lon);
        location.Location.Y.Should().Be(lat);
        location.Location.SRID.Should().Be(4326);
    }

    [Theory]
    [InlineData(90.1, 77.0)]
    [InlineData(-90.1, 77.0)]
    [InlineData(12.0, 180.1)]
    [InlineData(12.0, -180.1)]
    [InlineData(double.NaN, 77.0)]
    [InlineData(12.0, double.PositiveInfinity)]
    public void ServiceLocation_InvalidCoordinates_ThrowsArgumentOutOfRangeException(double lat, double lon)
    {
        // Act
        Action act = () => new ServiceLocation(
            addressLine1: "123 Main St",
            addressLine2: null,
            city: "Bengaluru",
            state: "Karnataka",
            pincode: "560001",
            latitude: lat,
            longitude: lon);

        // Assert
        act.Should().Throw<ArgumentOutOfRangeException>();
    }

    [Fact]
    public void ServiceRequest_StateTransitions_ExecuteInValidOrder()
    {
        // Arrange
        var request = new ServiceRequest(
            requestNumber: "BM-100001",
            customerId: Guid.NewGuid(),
            customerVehicleId: Guid.NewGuid(),
            vehicleMake: "BMW",
            vehicleModel: "3 Series",
            vehicleYear: 2022,
            vehicleLicensePlate: "KA-01-AB-1234",
            serviceLocationId: Guid.NewGuid(),
            customerLocation: new Point(77.5946, 12.9716) { SRID = 4326 },
            problemDescription: "High-speed brake vibration and noise.",
            serviceCategory: "Brakes");

        request.Status.Should().Be(ServiceRequestStatus.New);

        // Act & Assert 1: Assign Advisor
        var advisorId = Guid.NewGuid();
        request.AssignAdvisor(advisorId);
        request.Status.Should().Be(ServiceRequestStatus.AssignedToAdvisor);
        request.AssignedAdvisorId.Should().Be(advisorId);

        // Act & Assert 2: Start Review
        request.StartReview();
        request.Status.Should().Be(ServiceRequestStatus.UnderReview);

        // Act & Assert 3: Start Garage Matching
        request.StartGarageMatching();
        request.Status.Should().Be(ServiceRequestStatus.GarageMatching);

        // Act & Assert 4: Garages Notified
        request.MarkGaragesNotified();
        request.Status.Should().Be(ServiceRequestStatus.GaragesNotified);
    }

    [Fact]
    public void ServiceRequest_InvalidTransition_ThrowsInvalidOperationException()
    {
        // Arrange
        var request = new ServiceRequest(
            requestNumber: "BM-100002",
            customerId: Guid.NewGuid(),
            customerVehicleId: Guid.NewGuid(),
            vehicleMake: "Audi",
            vehicleModel: "A4",
            vehicleYear: 2021,
            vehicleLicensePlate: "KA-02-CD-5678",
            serviceLocationId: Guid.NewGuid(),
            customerLocation: new Point(77.5946, 12.9716) { SRID = 4326 },
            problemDescription: "Check engine warning light active.",
            serviceCategory: "Diagnostics");

        // Act: Try to start review directly from New without assigning advisor
        Action act = () => request.StartReview();

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*Allowed only from*");
    }

    [Fact]
    public void ServiceRequest_Cancel_ValidActiveState_TransitionsToCancelled()
    {
        // Arrange
        var request = new ServiceRequest(
            requestNumber: "BM-100003",
            customerId: Guid.NewGuid(),
            customerVehicleId: Guid.NewGuid(),
            vehicleMake: "Mercedes-Benz",
            vehicleModel: "C-Class",
            vehicleYear: 2020,
            vehicleLicensePlate: "KA-03-EF-9012",
            serviceLocationId: Guid.NewGuid(),
            customerLocation: new Point(77.5946, 12.9716) { SRID = 4326 },
            problemDescription: "Suspension knocking sound over speed bumps.",
            serviceCategory: "Suspension");

        // Act
        request.Cancel("Customer decided to postpone service.");

        // Assert
        request.Status.Should().Be(ServiceRequestStatus.Cancelled);
        request.CancelledAtUtc.Should().NotBeNull();
        request.CancellationReason.Should().Be("Customer decided to postpone service.");
    }

    [Fact]
    public void ServiceRequest_Cancel_WhenAlreadyCancelled_ThrowsInvalidOperationException()
    {
        // Arrange
        var request = new ServiceRequest(
            requestNumber: "BM-100004",
            customerId: Guid.NewGuid(),
            customerVehicleId: Guid.NewGuid(),
            vehicleMake: "Porsche",
            vehicleModel: "Macan",
            vehicleYear: 2023,
            vehicleLicensePlate: "KA-04-GH-3456",
            serviceLocationId: Guid.NewGuid(),
            customerLocation: new Point(77.5946, 12.9716) { SRID = 4326 },
            problemDescription: "Oil service required.",
            serviceCategory: "Periodic Service");

        request.Cancel("Initial cancel");

        // Act
        Action act = () => request.Cancel("Second cancel");

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*already cancelled*");
    }

    [Fact]
    public void GarageRequest_StatusTransitions_OperateCorrectly()
    {
        // Arrange
        var sReqId = Guid.NewGuid();
        var garageId = Guid.NewGuid();
        var garageRequest = new GarageRequest(sReqId, garageId, distanceKm: 4.8, initialStatus: GarageRequestStatus.Notified);

        garageRequest.Status.Should().Be(GarageRequestStatus.Notified);
        garageRequest.DistanceKm.Should().Be(4.8);

        // Act 1: View
        garageRequest.MarkViewed();
        garageRequest.Status.Should().Be(GarageRequestStatus.Viewed);
        garageRequest.ViewedAtUtc.Should().NotBeNull();

        // Act 2: Accept
        garageRequest.Accept();
        garageRequest.Status.Should().Be(GarageRequestStatus.Accepted);
        garageRequest.RespondedAtUtc.Should().NotBeNull();

        // Act 3: Attempting to decline an accepted request throws
        Action actDecline = () => garageRequest.Decline("Too busy");
        actDecline.Should().Throw<InvalidOperationException>()
            .WithMessage("*Cannot decline*");
    }

    [Fact]
    public void GarageRequest_Decline_TransitionsToDeclinedWithReason()
    {
        // Arrange
        var garageRequest = new GarageRequest(Guid.NewGuid(), Guid.NewGuid(), distanceKm: 7.2, initialStatus: GarageRequestStatus.Notified);

        // Act
        garageRequest.Decline("Workshop at full capacity this week.");

        // Assert
        garageRequest.Status.Should().Be(GarageRequestStatus.Declined);
        garageRequest.DeclinedAtUtc.Should().NotBeNull();
        garageRequest.DeclineReason.Should().Be("Workshop at full capacity this week.");
    }
}
