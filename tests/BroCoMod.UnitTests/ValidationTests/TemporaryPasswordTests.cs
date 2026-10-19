using BroCoMod.Application.Common;
using BroCoMod.Infrastructure.Services.Messaging;
using FluentAssertions;
using Xunit;

namespace BroCoMod.UnitTests.ValidationTests;

public class TemporaryPasswordTests
{
    [Fact]
    public void Generate_Gives12LettersAndDigits_WithEveryClass_AndNoLookAlikes()
    {
        var seen = new HashSet<string>();
        for (var i = 0; i < 500; i++)
        {
            var password = TemporaryPassword.Generate();

            password.Should().HaveLength(12);
            password.Should().MatchRegex("[A-Z]").And.MatchRegex("[a-z]").And.MatchRegex("[0-9]");
            password.Should().NotContainAny("0", "O", "1", "l", "I");
            password.All(c => TemporaryPassword.Alphabet.Contains(c)).Should().BeTrue();
            PasswordPolicy.Validate(password).Should().BeNull();
            seen.Add(password);
        }
        seen.Should().HaveCount(500);
    }

    [Fact]
    public void AdvisorWelcomeEmail_HasTheSignInLinkMobileAndPassword_Encoded()
    {
        var email = EmailTemplates.AdvisorWelcome("<b>Asha Rao", "+91 98765 43210", "asha@example.in", "Ab3dEf7hJk9m", "https://broco.in/");

        email.Subject.Should().Be("Your BroCo advisor account is ready");
        email.Text.Should().Contain("https://broco.in/login").And.Contain("+91 98765 43210").And.Contain("Ab3dEf7hJk9m");
        email.Html.Should().Contain("href=\"https://broco.in/login\"").And.Contain("Hi &lt;b&gt;Asha,");
        email.Html.Should().NotContain("<b>Asha");
    }
}
