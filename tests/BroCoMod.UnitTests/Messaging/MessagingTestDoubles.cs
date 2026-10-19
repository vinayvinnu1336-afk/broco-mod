using System.Collections.Concurrent;
using System.Net;
using System.Text;
using BroCoMod.Application.Common;
using BroCoMod.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace BroCoMod.UnitTests.Messaging;

/// <summary>Answers every request with a canned response and keeps what was sent. Nothing leaves the machine.</summary>
internal sealed class FakeHttpHandler : HttpMessageHandler
{
    private readonly Func<HttpRequestMessage, HttpResponseMessage> _respond;

    public FakeHttpHandler(HttpStatusCode status, string body, string mediaType = "application/json")
        : this(_ => new HttpResponseMessage(status) { Content = new StringContent(body, Encoding.UTF8, mediaType) }) { }

    public FakeHttpHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) => _respond = respond;

    public List<(HttpRequestMessage Request, string Body)> Requests { get; } = new();

    public HttpRequestMessage LastRequest => Requests[^1].Request;
    public string LastBody => Requests[^1].Body;

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var body = request.Content == null ? string.Empty : await request.Content.ReadAsStringAsync(cancellationToken);
        Requests.Add((request, body));
        return _respond(request);
    }

    public static FakeHttpHandler Throwing() => new(_ => throw new HttpRequestException("Connection refused"));
}

/// <summary>Collects every formatted log line, so tests can assert that no secret or code was logged.</summary>
internal sealed class CapturingLogger<T> : ILogger<T>
{
    public ConcurrentQueue<string> Lines { get; } = new();
    public string All => string.Join("\n", Lines);

    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
    public bool IsEnabled(LogLevel logLevel) => true;

    public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
    {
        Lines.Enqueue($"{logLevel}: {formatter(state, exception)} {exception?.Message}");
    }
}

internal static class TestConfig
{
    public static IConfiguration Of(params (string Key, string? Value)[] values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values.Select(v => new KeyValuePair<string, string?>(v.Key, v.Value))).Build();
}

internal sealed class StubSmsSender : ISmsSender
{
    private readonly Func<MessageSendResult> _result;
    public StubSmsSender(bool configured, Func<MessageSendResult> result) { IsConfigured = configured; _result = result; }
    public bool IsConfigured { get; }
    public List<(string Mobile, SmsTemplateKind Kind, IReadOnlyList<string?> Values)> Sent { get; } = new();

    public Task<MessageSendResult> SendAsync(string mobile, SmsTemplateKind template, IReadOnlyList<string?> values, CancellationToken cancellationToken = default)
    {
        Sent.Add((mobile, template, values));
        return Task.FromResult(_result());
    }
}

internal sealed class StubWhatsAppSender : IWhatsAppSender
{
    private readonly Func<MessageSendResult> _result;
    public StubWhatsAppSender(bool configured, Func<MessageSendResult> result) { IsConfigured = configured; _result = result; }
    public bool IsConfigured { get; }
    public List<(string Mobile, string Code)> Sent { get; } = new();

    public Task<MessageSendResult> SendOtpAsync(string mobile, string code, CancellationToken cancellationToken = default)
    {
        Sent.Add((mobile, code));
        return Task.FromResult(_result());
    }
}
