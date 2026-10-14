using System.ComponentModel.DataAnnotations;
using BroCoMod.Application.Common;
using BroCoMod.Application.DTOs;
using FluentAssertions;
using Xunit;

namespace BroCoMod.UnitTests.ValidationTests;

public class IndianMobileTests
{
    [Theory]
    [InlineData("+91 98765 43210")]
    [InlineData("+919876543210")]
    [InlineData("919876543210")]
    [InlineData("09876543210")]
    [InlineData("9876543210")]
    [InlineData("98765-43210")]
    [InlineData("+91-98765-43210")]
    [InlineData("(+91) 98765 43210")]
    [InlineData("+91 (98765) 43210")]
    [InlineData("  98765 43210  ")]
    [InlineData("+91 98765 43210")]
    public void Normalize_AcceptsCommonWaysOfWritingTheSameNumber(string input)
    {
        IndianMobile.IsValid(input).Should().BeTrue();
        IndianMobile.Normalize(input).Should().Be("+91 98765 43210");
        IndianMobile.NationalNumber(input).Should().Be("9876543210");
    }

    [Theory]
    [InlineData("6000000000", "+91 60000 00000")]
    [InlineData("7012345678", "+91 70123 45678")]
    [InlineData("8123456789", "+91 81234 56789")]
    // A number that itself starts with 91 is not mistaken for a country code.
    [InlineData("9191234567", "+91 91912 34567")]
    [InlineData("91 91912 34567", "+91 91912 34567")]
    public void Normalize_KeepsAllValidStartingDigits(string input, string expected)
    {
        IndianMobile.Normalize(input).Should().Be(expected);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("12345")]
    [InlineData("987654321")]          // 9 digits
    [InlineData("98765432101")]        // 11 digits without a leading 0
    [InlineData("5876543210")]         // mobiles start with 6-9
    [InlineData("0123456789")]
    [InlineData("+91 40 4000 1234")]   // Hyderabad landline
    [InlineData("+1 555 123 9999")]    // other country
    [InlineData("+15559998888")]
    [InlineData("+44 7911 123456")]
    [InlineData("+91 98765 4321O")]    // letter O
    [InlineData("98765 43210 ext 2")]
    [InlineData("98765+43210")]
    [InlineData("++91 98765 43210")]
    [InlineData("98765.43210")]
    public void Normalize_RejectsAnythingThatIsNotAnIndianMobile(string? input)
    {
        IndianMobile.IsValid(input).Should().BeFalse();
        IndianMobile.Normalize(input).Should().BeNull();
    }

    [Fact]
    public void Attribute_LeavesNullToRequired_AndRejectsEmptyUnlessAllowed()
    {
        var attribute = new IndianMobileAttribute();
        attribute.IsValid(null).Should().BeTrue();
        attribute.IsValid("").Should().BeFalse();
        attribute.IsValid("98765 43210").Should().BeTrue();
        attribute.IsValid("+1 555 123 9999").Should().BeFalse();
        attribute.IsValid(9876543210L).Should().BeFalse();
        attribute.FormatErrorMessage("PhoneNumber").Should().Be(IndianMobile.InvalidMessage);

        var optional = new IndianMobileAttribute { AllowEmpty = true };
        optional.IsValid("").Should().BeTrue();
        optional.IsValid("  ").Should().BeTrue();
        optional.IsValid("12345").Should().BeFalse();
    }

    [Theory]
    [InlineData("phone", "Phone")]
    [InlineData("WHATSAPP", "WhatsApp")]
    [InlineData(" sms ", "SMS")]
    [InlineData("Email", "Email")]
    public void ContactMethods_Normalize_ReturnsCanonicalSpelling(string input, string expected)
    {
        ContactMethods.Normalize(input).Should().Be(expected);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("Pigeon")]
    public void ContactMethods_Normalize_RejectsUnknownValues(string? input)
    {
        ContactMethods.Normalize(input).Should().BeNull();
    }

    [Theory]
    [InlineData("A", "9876543210", null, false)]
    [InlineData("  A  ", "9876543210", null, false)]
    [InlineData("Asha Rao", "9876543210", "Pigeon", false)]
    [InlineData("Asha Rao", "9876543210", "whatsapp", true)]
    [InlineData("Asha Rao", "9876543210", null, true)]
    public void UpdateCustomerProfileRequest_ObjectRules(string name, string phone, string? contact, bool expectedValid)
    {
        var request = new UpdateCustomerProfileRequest(name, phone, null, contact);

        var errors = request.Validate(new ValidationContext(request)).ToList();

        (errors.Count == 0).Should().Be(expectedValid);
    }
}
