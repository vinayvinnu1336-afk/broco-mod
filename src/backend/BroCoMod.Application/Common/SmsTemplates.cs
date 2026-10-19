using System.Text;
using System.Text.RegularExpressions;

namespace BroCoMod.Application.Common;

/// <summary>Every kind of SMS BroCo sends. Each needs its own template registered on the DLT portal.</summary>
public enum SmsTemplateKind
{
    Otp,
    BookingConfirmed,
    QuoteReady,
    PaymentReceived,
    CommissionReminder,
}

/// <param name="EnvVariable">The .env name holding the DLT template id the operator gave for <paramref name="Text"/>.</param>
/// <param name="ConfigKey">The same setting inside appsettings (docker compose maps the .env value here).</param>
/// <param name="Text">The exact text to register on DLT. Each <c>{#var#}</c> is filled in when sending.</param>
/// <param name="Variables">What each <c>{#var#}</c> holds, in order (used by the docs and by callers).</param>
public sealed record SmsTemplate(
    SmsTemplateKind Kind,
    string EnvVariable,
    string ConfigKey,
    string Text,
    IReadOnlyList<string> Variables,
    string Purpose)
{
    public int VariableCount => Variables.Count;
}

/// <summary>
/// The one place that defines BroCo's SMS texts. Indian operators (TRAI DLT) drop any SMS that does not match
/// a registered template character for character, so code never builds SMS text any other way: it picks a
/// template here and supplies the variable values. docs/integrations-setup.md lists these same texts for the
/// owner to register; a unit test keeps the two in step.
/// </summary>
public static class SmsTemplates
{
    public const string Variable = "{#var#}";

    /// <summary>DLT allows up to 30 characters per variable.</summary>
    public const int MaxVariableLength = 30;

    public static readonly SmsTemplate Otp = new(
        SmsTemplateKind.Otp,
        "DLT_TEMPLATE_OTP",
        "Sms:DltTemplates:Otp",
        "{#var#} is your BroCo verification code. It is valid for 10 minutes. Do not share it with anyone. - BroCo",
        new[] { "6-digit code" },
        "Password reset and mobile verification codes (Service Implicit / OTP category)");

    public static readonly SmsTemplate BookingConfirmed = new(
        SmsTemplateKind.BookingConfirmed,
        "DLT_TEMPLATE_BOOKING",
        "Sms:DltTemplates:BookingConfirmed",
        "Your BroCo booking {#var#} for your {#var#} is confirmed. We will keep you updated. - BroCo",
        new[] { "booking number, e.g. SR-20261019-0001", "car, e.g. Maruti Swift" },
        "Customer: a booking is confirmed with a garage (Service Implicit)");

    public static readonly SmsTemplate QuoteReady = new(
        SmsTemplateKind.QuoteReady,
        "DLT_TEMPLATE_QUOTE",
        "Sms:DltTemplates:QuoteReady",
        "Your BroCo quotation for booking {#var#} is ready. Open the BroCo app to review and accept it. - BroCo",
        new[] { "booking number" },
        "Customer: the advisor sent a quotation (Service Implicit)");

    public static readonly SmsTemplate PaymentReceived = new(
        SmsTemplateKind.PaymentReceived,
        "DLT_TEMPLATE_PAYMENT",
        "Sms:DltTemplates:PaymentReceived",
        "We have received Rs {#var#} for {#var#}. Thank you for choosing BroCo. - BroCo",
        new[] { "amount, e.g. 1,250", "what it was for, e.g. booking SR-20261019-0001" },
        "Customer: payment receipt (Service Implicit)");

    public static readonly SmsTemplate CommissionReminder = new(
        SmsTemplateKind.CommissionReminder,
        "DLT_TEMPLATE_COMMISSION_REMINDER",
        "Sms:DltTemplates:CommissionReminder",
        "Reminder: BroCo commission of Rs {#var#} for job {#var#} is {#var#}. Please pay it from the Garage portal. - BroCo",
        new[] { "amount, e.g. 1,250", "job number", "\"due\" or \"overdue\"" },
        "Garage: commission due or overdue (Service Implicit)");

    public static IReadOnlyList<SmsTemplate> All { get; } = new[] { Otp, BookingConfirmed, QuoteReady, PaymentReceived, CommissionReminder };

    public static SmsTemplate For(SmsTemplateKind kind) => All.First(t => t.Kind == kind);

    /// <summary>
    /// The template text with each <c>{#var#}</c> replaced, in order. Values are put on one line and cut to
    /// 30 characters, because a longer or multi-line value would make the SMS fail the DLT match.
    /// </summary>
    public static string Render(SmsTemplate template, IReadOnlyList<string?> values)
    {
        if (values.Count != template.VariableCount)
        {
            throw new ArgumentException(
                $"SMS template {template.Kind} needs {template.VariableCount} value(s) but got {values.Count}.", nameof(values));
        }

        var parts = template.Text.Split(Variable);
        var text = new StringBuilder(parts[0]);
        for (var i = 1; i < parts.Length; i++)
        {
            text.Append(CleanValue(values[i - 1])).Append(parts[i]);
        }
        return text.ToString();
    }

    /// <summary>True when <paramref name="text"/> is <paramref name="template"/> with each variable 1-30 characters long.</summary>
    public static bool Matches(SmsTemplate template, string text)
    {
        var pattern = "^" + string.Join($".{{1,{MaxVariableLength}}}", template.Text.Split(Variable).Select(Regex.Escape)) + "$";
        return Regex.IsMatch(text, pattern, RegexOptions.Singleline);
    }

    private static string CleanValue(string? value)
    {
        var oneLine = Regex.Replace(value ?? string.Empty, @"\s+", " ").Trim();
        if (oneLine.Length == 0) oneLine = "-";
        return oneLine.Length <= MaxVariableLength ? oneLine : oneLine[..MaxVariableLength].TrimEnd();
    }
}
