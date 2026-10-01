using BroCoMod.Domain.Entities;
using FluentAssertions;
using Xunit;

namespace BroCoMod.UnitTests.DomainTests;

public class SpatialDomainTests
{
    [Fact]
    public void Garage_Creation_AssignsWgs84Srid4326Location()
    {
        // Arrange & Act
        var garage = new Garage(
            "Central Metro Auto Care",
            "info@centralmetro.com",
            "+1-555-0199",
            "123 Innovation Way, Tech District",
            longitude: -122.4194,
            latitude: 37.7749
        );

        // Assert
        garage.Location.Should().NotBeNull();
        garage.Location.SRID.Should().Be(4326);
        garage.Location.X.Should().Be(-122.4194);
        garage.Location.Y.Should().Be(37.7749);
        garage.IsActive.Should().BeTrue();
    }

    [Fact]
    public void ServiceRequest_Creation_DefaultsTo10KmRadius()
    {
        // Arrange & Act
        var request = new ServiceRequest(
            Guid.NewGuid(),
            "Toyota",
            "Camry",
            2022,
            "Engine sputtering under acceleration",
            longitude: -122.4000,
            latitude: 37.7800
        );

        // Assert
        request.RadiusKm.Should().Be(10.0);
        request.CustomerLocation.SRID.Should().Be(4326);
        request.Status.Should().Be(Domain.Enums.ServiceRequestStatus.Submitted);
    }
}
