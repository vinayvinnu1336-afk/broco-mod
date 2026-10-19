using System.Net;
using System.Text;
using BroCoMod.Application.Interfaces;

namespace BroCoMod.Infrastructure.Services.Messaging;

public enum EmailKind
{
    PasswordResetCode,
    MobileVerificationCode,
    BookingConfirmed,
    QuoteReady,
    PaymentReceipt,
    CommissionDue,
    Generic,
}

/// <summary>A rendered email: subject, HTML (inline styles only, so every mail app shows it the same) and plain text.</summary>
public sealed record RenderedEmail(string Subject, string Html, string Text);

/// <summary>
/// BroCo's transactional emails. One plain, mobile-friendly layout (single 560 px column, table-based, inline
/// styles, no images so nothing is blocked) with the BroCo wordmark, a heading, a short paragraph, optional
/// detail rows, an optional code box and an optional button. Every value is HTML-encoded.
/// </summary>
public static class EmailTemplates
{
    // Notification types (Notification.Type) that have their own email.
    public const string PasswordResetType = "PASSWORD_RESET";
    public const string MobileVerificationType = "MOBILE_VERIFICATION";
    public const string BookingConfirmedType = "BookingConfirmed";
    public const string QuoteReadyType = "CustomerQuotation";
    public const string PaymentReceivedType = "PAYMENT_RECEIVED";
    public const string CommissionPaidType = "COMMISSION_PAID";
    public const string CommissionDueType = "COMMISSION_DUE";

    private const string Blue = "#0433BF";
    private const string Ink = "#0F1B3D";
    private const string Muted = "#5B6785";
    private const string Line = "#E3E8F2";

    public static EmailKind KindFor(string? notificationType) => notificationType switch
    {
        PasswordResetType => EmailKind.PasswordResetCode,
        MobileVerificationType => EmailKind.MobileVerificationCode,
        BookingConfirmedType => EmailKind.BookingConfirmed,
        QuoteReadyType => EmailKind.QuoteReady,
        PaymentReceivedType or CommissionPaidType => EmailKind.PaymentReceipt,
        CommissionDueType => EmailKind.CommissionDue,
        _ => EmailKind.Generic,
    };

    /// <summary>The email for an in-app notification, using its title/message and the template values in <c>Data</c>.</summary>
    public static RenderedEmail ForNotification(NotificationMessage message, string? recipientName, string? siteUrl)
    {
        var data = message.Data ?? new Dictionary<string, string>();
        string? Get(string key) => data.TryGetValue(key, out var v) && !string.IsNullOrWhiteSpace(v) ? v : null;
        var greeting = string.IsNullOrWhiteSpace(recipientName) ? "Hello," : $"Hi {FirstName(recipientName)},";

        switch (KindFor(message.Type))
        {
            case EmailKind.PasswordResetCode:
                return Render(
                    subject: "Your BroCo password reset code",
                    preheader: "Use this code to set a new password. It expires in 10 minutes.",
                    heading: "Reset your password",
                    greeting: greeting,
                    paragraphs: new[] { "Use this code on the BroCo password reset page to set a new password. It expires in 10 minutes." },
                    code: Get("code"),
                    rows: null,
                    button: null,
                    footnote: "If you did not ask to reset your password, you can ignore this email. Your password stays the same. Never share this code with anyone, including BroCo staff.");

            case EmailKind.MobileVerificationCode:
                return Render(
                    subject: "Your BroCo verification code",
                    preheader: "Use this code to verify your mobile number. It expires in 10 minutes.",
                    heading: "Verify your mobile number",
                    greeting: greeting,
                    paragraphs: new[] { "Enter this code in BroCo to confirm your mobile number. It expires in 10 minutes." },
                    code: Get("code"),
                    rows: null,
                    button: null,
                    footnote: "If you did not request this, you can ignore this email. Never share this code with anyone.");

            case EmailKind.BookingConfirmed:
                return Render(
                    subject: Get("requestNumber") is { } n ? $"Booking confirmed: {n}" : "Your BroCo booking is confirmed",
                    preheader: message.Message,
                    heading: "Your booking is confirmed",
                    greeting: greeting,
                    paragraphs: new[] { message.Message },
                    code: null,
                    rows: Rows(("Booking", Get("requestNumber")), ("Car", Get("vehicle")), ("Garage", Get("garageName"))),
                    button: Link(siteUrl, "/customer/requests", "View booking"),
                    footnote: "We will keep you posted at every step. Reply to this email if anything looks wrong.");

            case EmailKind.QuoteReady:
                return Render(
                    subject: Get("requestNumber") is { } q ? $"Your quotation is ready: {q}" : "Your BroCo quotation is ready",
                    preheader: message.Message,
                    heading: "Your quotation is ready",
                    greeting: greeting,
                    paragraphs: new[] { message.Message, "Review the items and price, then accept it to confirm the work." },
                    code: null,
                    rows: Rows(("Booking", Get("requestNumber")), ("Quotation", Get("quotationNumber"))),
                    button: Link(siteUrl, "/customer/quotes", "Review quotation"),
                    footnote: null);

            case EmailKind.PaymentReceipt:
                return Render(
                    subject: Get("paymentNumber") is { } p ? $"Payment received: {p}" : "Payment received",
                    preheader: message.Message,
                    heading: "Payment received",
                    greeting: greeting,
                    paragraphs: new[] { message.Message },
                    code: null,
                    rows: Rows(("Amount", Get("amount") is { } a ? $"₹{a}" : null), ("Payment", Get("paymentNumber")),
                        ("For", Get("purpose")), ("Paid on", Get("paidOn"))),
                    button: null,
                    footnote: "Keep this email as your receipt. Thank you for choosing BroCo.");

            case EmailKind.CommissionDue:
                return Render(
                    subject: message.Title,
                    preheader: message.Message,
                    heading: message.Title,
                    greeting: greeting,
                    paragraphs: new[] { message.Message },
                    code: null,
                    rows: Rows(("Amount", Get("amount") is { } amt ? $"₹{amt}" : null), ("Job", Get("jobNumber")),
                        ("Reference", Get("commissionNumber")), ("Due", Get("dueText"))),
                    button: Link(siteUrl, "/garage/commission", "Pay now"),
                    footnote: null);

            default:
                return Generic(message.Title, message.Message, recipientName, siteUrl);
        }
    }

    public static RenderedEmail Generic(string title, string body, string? recipientName, string? siteUrl) =>
        Render(
            subject: title,
            preheader: body,
            heading: title,
            greeting: string.IsNullOrWhiteSpace(recipientName) ? "Hello," : $"Hi {FirstName(recipientName)},",
            paragraphs: new[] { body },
            code: null,
            rows: null,
            button: Link(siteUrl, "/", "Open BroCo"),
            footnote: null);

    /// <summary>
    /// Welcome email for an advisor account created by an administrator, with the sign-in mobile and first password.
    /// Sent straight to the email sender (never stored as a notification) because it carries the password.
    /// </summary>
    public static RenderedEmail AdvisorWelcome(string fullName, string loginMobile, string email, string password, string? siteUrl)
    {
        var signIn = Link(siteUrl, "/login", "Sign in to BroCo");
        return Render(
            subject: "Your BroCo advisor account is ready",
            preheader: "Sign in with your mobile number and the password in this email.",
            heading: "Welcome to BroCo",
            greeting: $"Hi {FirstName(fullName)},",
            paragraphs: new[]
            {
                "An administrator has created your BroCo advisor account. Sign in with your mobile number and the password below.",
                signIn is { } link ? $"Sign in at {link.Url}" : string.Empty,
            },
            code: null,
            rows: Rows(("Mobile number", loginMobile), ("Email", email), ("Password", password)),
            button: signIn,
            footnote: "Keep this password safe and do not share it with anyone. You can change it any time with \"Forgot password\" on the sign-in page.");
    }

    private static string FirstName(string fullName) => fullName.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries)[0];

    private static IReadOnlyList<(string Label, string Value)> Rows(params (string Label, string? Value)[] rows) =>
        rows.Where(r => !string.IsNullOrWhiteSpace(r.Value)).Select(r => (r.Label, r.Value!)).ToList();

    private static (string Url, string Label)? Link(string? siteUrl, string path, string label) =>
        string.IsNullOrWhiteSpace(siteUrl) || !Uri.TryCreate(siteUrl.TrimEnd('/') + path, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp)
            ? null
            : (uri.ToString(), label);

    private static string E(string? value) => WebUtility.HtmlEncode(value ?? string.Empty);

    private static RenderedEmail Render(
        string subject,
        string preheader,
        string heading,
        string greeting,
        IReadOnlyList<string> paragraphs,
        string? code,
        IReadOnlyList<(string Label, string Value)>? rows,
        (string Url, string Label)? button,
        string? footnote)
    {
        var html = new StringBuilder();
        html.Append("<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\">")
            .Append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">")
            .Append("<meta name=\"color-scheme\" content=\"light\"><title>").Append(E(subject)).Append("</title></head>")
            .Append("<body style=\"margin:0;padding:0;background:#F4F6FB;\">")
            // Hidden preview line shown by mail apps next to the subject.
            .Append("<div style=\"display:none;max-height:0;overflow:hidden;opacity:0;\">").Append(E(Truncate(preheader, 140))).Append("</div>")
            .Append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#F4F6FB;\"><tr><td align=\"center\" style=\"padding:24px 12px;\">")
            .Append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:560px;background:#FFFFFF;border:1px solid ").Append(Line).Append(";border-radius:16px;\">")
            // Wordmark
            .Append("<tr><td style=\"padding:20px 24px;border-bottom:1px solid ").Append(Line).Append(";\">")
            .Append("<span style=\"display:inline-block;background:").Append(Blue).Append(";background-image:linear-gradient(135deg,#0130BA,#0389FC 50%,#54CCFE);color:#FFFFFF;font:700 15px/1 Arial,Helvetica,sans-serif;padding:8px 10px;border-radius:8px;\">B</span>")
            .Append("<span style=\"font:800 20px/1 Arial,Helvetica,sans-serif;color:").Append(Ink).Append(";vertical-align:middle;padding-left:8px;\">BroCo</span>")
            .Append("</td></tr>")
            .Append("<tr><td style=\"padding:24px;font:16px/1.55 Arial,Helvetica,sans-serif;color:").Append(Ink).Append(";\">")
            .Append("<h1 style=\"margin:0 0 12px;font:700 22px/1.3 Arial,Helvetica,sans-serif;color:").Append(Ink).Append(";\">").Append(E(heading)).Append("</h1>")
            .Append("<p style=\"margin:0 0 12px;\">").Append(E(greeting)).Append("</p>");

        foreach (var p in paragraphs.Where(p => !string.IsNullOrWhiteSpace(p)))
        {
            html.Append("<p style=\"margin:0 0 12px;\">").Append(E(p)).Append("</p>");
        }

        if (!string.IsNullOrWhiteSpace(code))
        {
            html.Append("<p style=\"margin:16px 0;text-align:center;\"><span style=\"display:inline-block;font:700 30px/1 'Courier New',Courier,monospace;letter-spacing:8px;color:")
                .Append(Ink).Append(";background:#EEF3FF;border:1px solid #C9D6FB;border-radius:12px;padding:14px 18px 14px 26px;\">")
                .Append(E(code)).Append("</span></p>");
        }

        if (rows is { Count: > 0 })
        {
            html.Append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:8px 0 16px;border-top:1px solid ").Append(Line).Append(";\">");
            foreach (var (label, value) in rows)
            {
                html.Append("<tr><td style=\"padding:10px 0;border-bottom:1px solid ").Append(Line).Append(";font:14px/1.4 Arial,Helvetica,sans-serif;color:").Append(Muted).Append(";width:40%;\">")
                    .Append(E(label)).Append("</td><td style=\"padding:10px 0;border-bottom:1px solid ").Append(Line)
                    .Append(";font:600 14px/1.4 Arial,Helvetica,sans-serif;color:").Append(Ink).Append(";text-align:right;\">").Append(E(value)).Append("</td></tr>");
            }
            html.Append("</table>");
        }

        if (button is { } b)
        {
            html.Append("<p style=\"margin:20px 0 8px;\"><a href=\"").Append(E(b.Url)).Append("\" style=\"display:inline-block;background:").Append(Blue)
                .Append(";color:#FFFFFF;text-decoration:none;font:600 16px/1 Arial,Helvetica,sans-serif;padding:14px 22px;border-radius:10px;\">")
                .Append(E(b.Label)).Append("</a></p>");
        }

        if (!string.IsNullOrWhiteSpace(footnote))
        {
            html.Append("<p style=\"margin:16px 0 0;font:14px/1.5 Arial,Helvetica,sans-serif;color:").Append(Muted).Append(";\">").Append(E(footnote)).Append("</p>");
        }

        html.Append("</td></tr>")
            .Append("<tr><td style=\"padding:16px 24px;border-top:1px solid ").Append(Line).Append(";font:12px/1.5 Arial,Helvetica,sans-serif;color:").Append(Muted).Append(";\">")
            .Append("BroCo &middot; Car service, pick-up and drop<br>This is an automatic message about your BroCo account.")
            .Append("</td></tr></table></td></tr></table></body></html>");

        var text = new StringBuilder();
        text.AppendLine("BroCo").AppendLine().AppendLine(heading).AppendLine().AppendLine(greeting).AppendLine();
        foreach (var p in paragraphs.Where(p => !string.IsNullOrWhiteSpace(p))) text.AppendLine(p).AppendLine();
        if (!string.IsNullOrWhiteSpace(code)) text.AppendLine($"Your code: {code}").AppendLine();
        if (rows is { Count: > 0 })
        {
            foreach (var (label, value) in rows) text.AppendLine($"{label}: {value}");
            text.AppendLine();
        }
        if (button is { } link) text.AppendLine($"{link.Label}: {link.Url}").AppendLine();
        if (!string.IsNullOrWhiteSpace(footnote)) text.AppendLine(footnote).AppendLine();
        text.AppendLine("--").AppendLine("BroCo - Car service, pick-up and drop");

        return new RenderedEmail(subject, html.ToString(), text.ToString());
    }

    private static string Truncate(string value, int max) => value.Length <= max ? value : value[..max];
}
