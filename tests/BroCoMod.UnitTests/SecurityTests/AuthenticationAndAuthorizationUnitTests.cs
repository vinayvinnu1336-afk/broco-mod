using System.Security.Claims;
using BroCoMod.Application.Authorization;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Constants;
using BroCoMod.Domain.Entities.Identity;
using BroCoMod.Domain.Exceptions;
using BroCoMod.Infrastructure.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Configuration;
using Moq;
using Xunit;

namespace BroCoMod.UnitTests.SecurityTests;

public class AuthenticationAndAuthorizationUnitTests
{
    private readonly PasswordHasher _passwordHasher = new();
    private readonly JwtTokenService _jwtTokenService;

    public AuthenticationAndAuthorizationUnitTests()
    {
        var configMock = new Mock<IConfiguration>();
        configMock.Setup(c => c["Jwt:Secret"]).Returns("BroCoMod-Super-Secret-Production-Grade-Key-2026-Security-First!");
        configMock.Setup(c => c["Jwt:Issuer"]).Returns("BroCoMod");
        configMock.Setup(c => c["Jwt:Audience"]).Returns("BroCoModApp");
        configMock.Setup(c => c["Jwt:ExpiryMinutes"]).Returns("60");

        _jwtTokenService = new JwtTokenService(configMock.Object);
    }

    [Fact]
    public void PasswordHasher_GeneratesUniqueSaltAndVerifiesCorrectly()
    {
        // Arrange
        const string password = "StrongPassword123!";

        // Act
        var hash1 = _passwordHasher.HashPassword(password, out var salt1);
        var hash2 = _passwordHasher.HashPassword(password, out var salt2);

        // Assert
        salt1.Should().NotBe(salt2, "cryptographic salt must be randomized per hash");
        hash1.Should().NotBe(hash2);

        _passwordHasher.VerifyPassword(password, hash1, salt1).Should().BeTrue();
        _passwordHasher.VerifyPassword(password, hash2, salt2).Should().BeTrue();
        _passwordHasher.VerifyPassword("WrongPassword!", hash1, salt1).Should().BeFalse();
    }

    [Fact]
    public void JwtTokenService_GeneratesAccessToken_WithRequiredClaims()
    {
        // Arrange
        var user = new User("customer@test.com", "John Doe", "+1234567890", "hash", "salt");
        var roles = new[] { AppRoles.Customer };
        var permissions = new[] { AppPermissions.CustomerRequestCreate, AppPermissions.CustomerQuoteView };
        var customerId = Guid.NewGuid();

        // Act
        var token = _jwtTokenService.GenerateAccessToken(user, roles, permissions, customerId: customerId);

        // Assert
        token.Should().NotBeNullOrWhiteSpace();
        var rawRefresh = _jwtTokenService.GenerateRefreshToken();
        rawRefresh.Should().NotBeNullOrWhiteSpace();
        var hashedRefresh = _jwtTokenService.HashToken(rawRefresh);
        hashedRefresh.Should().NotBe(rawRefresh);
        _jwtTokenService.HashToken(rawRefresh).Should().Be(hashedRefresh, "SHA256 must be deterministic");
    }

    [Fact]
    public async Task PermissionAuthorizationHandler_GrantsAccess_WhenUserHasRequiredPermission()
    {
        // Arrange
        var handler = new PermissionAuthorizationHandler();
        var requirement = new PermissionRequirement(AppPermissions.GarageQuoteCreate);

        var claims = new[]
        {
            new Claim("permission", AppPermissions.GarageQuoteCreate),
            new Claim(ClaimTypes.Role, AppRoles.GarageOwner)
        };
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"));
        var context = new AuthorizationHandlerContext(new[] { requirement }, principal, null);

        // Act
        await handler.HandleAsync(context);

        // Assert
        context.HasSucceeded.Should().BeTrue();
    }

    [Fact]
    public async Task PermissionAuthorizationHandler_DeniesAccess_WhenUserLacksRequiredPermission()
    {
        // Arrange
        var handler = new PermissionAuthorizationHandler();
        var requirement = new PermissionRequirement(AppPermissions.AdminUsersManage);

        var claims = new[]
        {
            new Claim("permission", AppPermissions.CustomerRequestView),
            new Claim(ClaimTypes.Role, AppRoles.Customer)
        };
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"));
        var context = new AuthorizationHandlerContext(new[] { requirement }, principal, null);

        // Act
        await handler.HandleAsync(context);

        // Assert
        context.HasSucceeded.Should().BeFalse();
    }

    [Fact]
    public void DataIsolationGuards_CustomerAccess_EnforcesStrictIdentity()
    {
        // Arrange
        var customer1 = Guid.NewGuid();
        var customer2 = Guid.NewGuid();

        var mockCurrentCustomer = new Mock<ICurrentUserService>();
        mockCurrentCustomer.Setup(s => s.CustomerId).Returns(customer1);
        mockCurrentCustomer.Setup(s => s.Roles).Returns(new[] { AppRoles.Customer });

        // Act & Assert
        // Same customer matches
        Action actSame = () => DataIsolationGuards.AssertCustomerAccess(mockCurrentCustomer.Object, customer1);
        actSame.Should().NotThrow();

        // Mismatched customer throws
        Action actDifferent = () => DataIsolationGuards.AssertCustomerAccess(mockCurrentCustomer.Object, customer2);
        actDifferent.Should().Throw<DataIsolationViolationException>()
            .WithMessage("*Data Isolation Violation*");
    }

    [Fact]
    public void DataIsolationGuards_GarageAccess_EnforcesStrictIdentity()
    {
        // Arrange
        var garage1 = Guid.NewGuid();
        var garage2 = Guid.NewGuid();

        var mockGarageUser = new Mock<ICurrentUserService>();
        mockGarageUser.Setup(s => s.GarageId).Returns(garage1);
        mockGarageUser.Setup(s => s.Roles).Returns(new[] { AppRoles.GarageOwner });

        // Act & Assert
        // Same garage matches
        Action actSame = () => DataIsolationGuards.AssertGarageAccess(mockGarageUser.Object, garage1);
        actSame.Should().NotThrow();

        // Mismatched garage throws
        Action actDifferent = () => DataIsolationGuards.AssertGarageAccess(mockGarageUser.Object, garage2);
        actDifferent.Should().Throw<DataIsolationViolationException>()
            .WithMessage("*Data Isolation Violation*");
    }
}
