using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Enums;
using BroCoMod.Infrastructure.Persistence;
using BroCoMod.Infrastructure.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Xunit;

namespace BroCoMod.IntegrationTests;

/// <summary>
/// Basic / Standard / Premium bookings have a fixed price, so they never go out to garages for quotes:
/// nothing is dispatched at booking, garages can't quote them (even old ones that were dispatched before
/// this rule), and the advisor assigns a nearby garage directly once the advance is paid.
/// Quote-based repairs keep going to every nearby garage as before.
/// </summary>
public class PackageBookingWithoutQuotesIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private const string CentralMetro = "Central Metro Motors";
    private const string CentralMetroOwner = "garage.owner@centralmetro.com";

    private readonly WebApplicationFactory<Program> _factory;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public PackageBookingWithoutQuotesIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    // ---------- helpers ----------

    private async Task<HttpClient> SignedInAsync(string email, string password = "Password123!")
    {
        var client = _factory.CreateClient();
        var res = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, password));
        res.EnsureSuccessStatusCode();
        var body = await res.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body!.Data!.AccessToken);
        return client;
    }

    private async Task<(HttpClient Client, Guid VehicleId)> NewCustomerWithSwiftAsync()
    {
        var anon = _factory.CreateClient();
        var email = $"noquote_{Guid.NewGuid():N}@brocomod.com";
        (await anon.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest(email, "Password123!", "No Quote Customer", TestMobiles.New())))
            .EnsureSuccessStatusCode();
        var customer = await SignedInAsync(email);

        var makes = await customer.GetFromJsonAsync<ApiResponse<List<VehicleManufacturerDto>>>("/api/v1/vehicle-manufacturers", JsonOptions);
        var maruti = makes!.Data!.Single(m => m.Name == "Maruti Suzuki");
        var models = await customer.GetFromJsonAsync<ApiResponse<List<VehicleModelDto>>>($"/api/v1/vehicle-manufacturers/{maruti.Id}/models", JsonOptions);
        var swift = models!.Data!.Single(m => m.Name == "Swift");

        var json = $$"""
        { "manufacturerId": "{{maruti.Id}}", "modelId": "{{swift.Id}}", "year": 2022, "fuelType": "Petrol",
          "transmission": "Manual", "licensePlate": "TS-10-{{Random.Shared.Next(1000, 9999)}}", "mileage": 21000, "color": "White" }
        """;
        var res = await customer.PostAsync("/api/v1/customer/vehicles", new StringContent(json, Encoding.UTF8, "application/json"));
        res.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        return (customer, doc.RootElement.GetProperty("data").GetProperty("id").GetGuid());
    }

    /// <summary>Banjara Hills, next to the demo garage Central Metro Motors.</summary>
    private static CreateServiceBookingRequest Booking(Guid vehicleId, string? package) =>
        new(vehicleId, "Plot 12, Road No. 2", "Banjara Hills", "Hyderabad", "Telangana", "500034", "India", 17.4126, 78.4482,
            ProblemDescription: package == null ? "Clutch slipping on slopes" : "",
            ServiceCategory: package == null ? "Clutch & Transmission" : null,
            PackageCode: package);

    private async Task<(HttpClient Customer, ServiceRequestDetailDto Request)> BookAsync(string? package)
    {
        var (customer, vehicleId) = await NewCustomerWithSwiftAsync();
        var res = await customer.PostAsJsonAsync("/api/v1/customer/requests", Booking(vehicleId, package));
        var raw = await res.Content.ReadAsStringAsync();
        res.StatusCode.Should().Be(HttpStatusCode.Created, raw);
        var request = (await res.Content.ReadFromJsonAsync<ApiResponse<ServiceRequestDetailDto>>(JsonOptions))!.Data!;
        return (customer, request);
    }

    private static async Task<decimal> PayAdvanceAsync(HttpClient customer, Guid requestId)
    {
        var pay = await customer.PostAsJsonAsync($"/api/v1/customer/requests/{requestId}/advance/pay", new InitiateAdvancePaymentRequest(null));
        pay.EnsureSuccessStatusCode();
        var checkout = (await pay.Content.ReadFromJsonAsync<ApiResponse<InitiatePaymentResponseDto>>(JsonOptions))!.Data!;
        (await customer.PostAsJsonAsync("/api/v1/customer/payments/verify",
            new VerifyPaymentRequestDto(checkout.PaymentId, $"pay_noquote_{Guid.NewGuid():N}", "sig_fake_valid", checkout.GatewayOrderId)))
            .EnsureSuccessStatusCode();
        return checkout.Amount;
    }

    /// <summary>Leaves the shared queues tidy: an open, paid package booking would sit in every advisor's queue.</summary>
    private static async Task CancelAsync(HttpClient customer, Guid requestId) =>
        (await customer.PostAsJsonAsync($"/api/v1/customer/requests/{requestId}/cancel", new CancelServiceRequestCommand("Test finished")))
            .EnsureSuccessStatusCode();

    private async Task<Guid> CentralMetroIdAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await db.GarageUsers.AsNoTracking()
            .Where(gu => gu.User.Email == CentralMetroOwner)
            .Select(gu => gu.GarageId)
            .FirstAsync();
    }

    private async Task<AdvisorWorkQueueDto> AdminWorkQueueAsync()
    {
        // A super admin has no advisor profile, so the queue covers every advisor's requests.
        var admin = await SignedInAsync("admin@brocomod.com");
        var res = await admin.GetFromJsonAsync<ApiResponse<AdvisorWorkQueueDto>>("/api/v1/advisor/work-queue", JsonOptions);
        return res!.Data!;
    }

    // ---------- tests ----------

    [Fact]
    public async Task PackageBooking_GoesToNoGarage_AndTheOwningAdvisorIsAskedToAssignOnceTheAdvanceIsPaid()
    {
        var (customer, request) = await BookAsync("STANDARD");

        request.Status.Should().Be("NEW");
        request.MatchedGaragesCount.Should().Be(0);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            (await db.GarageRequests.CountAsync(gr => gr.ServiceRequestId == request.Id)).Should().Be(0);

            var requestId = request.Id.ToString();
            var garageUserIds = await db.GarageUsers.AsNoTracking().Select(gu => gu.UserId).ToListAsync();
            (await db.Notifications.CountAsync(n => garageUserIds.Contains(n.UserId) &&
                (n.ReferenceId == request.Id || (n.MetadataJson != null && n.MetadataJson.Contains(requestId)))))
                .Should().Be(0, "no garage is told about a package booking before it is assigned");

            var advisorNotes = await db.Notifications.AsNoTracking()
                .Where(n => n.ReferenceId == request.Id && n.Type == "SERVICE_REQUEST_CREATED")
                .ToListAsync();
            advisorNotes.Should().NotBeEmpty();
            advisorNotes.Should().OnlyContain(n => n.Title == $"New package booking: {request.RequestNumber}");
            advisorNotes.Should().OnlyContain(n => !n.Message.Contains("quote", StringComparison.OrdinalIgnoreCase));
        }

        // Not in the "new requests, no quotes yet" list, and not ready to assign until the advance is paid
        var before = await AdminWorkQueueAsync();
        before.NewRequests.Should().NotContain(r => r.Id == request.Id);
        (before.PackageBookingsToAssign ?? new List<AdvisorPackageBookingQueueItemDto>()).Should().NotContain(r => r.Id == request.Id);

        var advance = await PayAdvanceAsync(customer, request.Id);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var stored = await db.ServiceRequests.AsNoTracking().FirstAsync(r => r.Id == request.Id);
            stored.Status.Should().Be(ServiceRequestStatus.New, "a paid package waits for the advisor, not for garages");
            (await db.GarageRequests.CountAsync(gr => gr.ServiceRequestId == request.Id)).Should().Be(0);

            var ask = await db.Notifications.AsNoTracking()
                .Where(n => n.ReferenceId == request.Id && n.Type == "PACKAGE_ADVANCE_PAID")
                .ToListAsync();
            ask.Should().NotBeEmpty();
            ask.Should().OnlyContain(n => n.Title == $"Assign a garage: {request.RequestNumber}");
            if (stored.AssignedAdvisorId.HasValue)
            {
                var ownerUserId = await db.AdvisorProfiles.Where(a => a.Id == stored.AssignedAdvisorId.Value).Select(a => a.UserId).FirstAsync();
                ask.Select(n => n.UserId).Should().Equal(ownerUserId);
            }
        }

        var after = await AdminWorkQueueAsync();
        var queued = after.PackageBookingsToAssign.Should().ContainSingle(r => r.Id == request.Id).Subject;
        queued.PackageName.Should().Be(request.ServicePackageName);
        queued.PackagePrice.Should().Be(request.PackagePrice!.Value);
        queued.AdvancePaidAmount.Should().Be(advance);
        after.NewRequests.Should().NotContain(r => r.Id == request.Id);
        after.QuotesToReview.Should().NotContain(r => r.Id == request.Id);

        await CancelAsync(customer, request.Id);
        (await AdminWorkQueueAsync()).PackageBookingsToAssign.Should().NotContain(r => r.Id == request.Id);
    }

    [Fact]
    public async Task Garage_CannotQuoteAPackageRequest_EvenWithADispatchRowFromBeforeTheRule()
    {
        var (customer, request) = await BookAsync("BASIC");
        var garageId = await CentralMetroIdAsync();

        // Package booked before this change: it was dispatched to the garage, which even started a draft.
        Guid legacyRequestId, legacyQuoteId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var numbers = scope.ServiceProvider.GetRequiredService<IQuoteNumberGenerator>();
            var legacy = new GarageRequest(request.Id, garageId, 0.4, GarageRequestStatus.Notified);
            db.GarageRequests.Add(legacy);
            var draft = new GarageQuote(legacy.Id, garageId, request.Id, await numbers.GenerateNextQuoteNumberAsync(), "INR", DateTime.UtcNow.AddDays(5));
            draft.AddLineItem(QuoteLineType.Service, "Basic service", 1, 2999m);
            db.GarageQuotes.Add(draft);
            await db.SaveChangesAsync();
            (legacyRequestId, legacyQuoteId) = (legacy.Id, draft.Id);
        }

        var garage = await SignedInAsync(CentralMetroOwner);

        // Lists leave it out
        var list = await garage.GetFromJsonAsync<ApiResponse<PagedResult<GarageIncomingRequestDto>>>("/api/v1/garage/requests?page=1&pageSize=50", JsonOptions);
        list!.Data!.Items.Should().NotContain(r => r.ServiceRequestId == request.Id);
        var quotes = await garage.GetFromJsonAsync<ApiResponse<List<GarageQuoteSummaryDto>>>("/api/v1/garage/quotes", JsonOptions);
        quotes!.Data!.Should().NotContain(q => q.ServiceRequestId == request.Id);
        var quotesForRequest = await garage.GetFromJsonAsync<ApiResponse<List<GarageQuoteSummaryDto>>>($"/api/v1/garage/requests/{legacyRequestId}/quotes", JsonOptions);
        quotesForRequest!.Data!.Should().BeEmpty();

        // Opening the old dispatch row explains why there is nothing to quote
        var detail = await garage.GetAsync($"/api/v1/garage/requests/{legacyRequestId}");
        detail.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await detail.Content.ReadAsStringAsync()).Should().Contain("fixed-price BroCo package");

        // Every quote action is refused with the same clear message
        var create = await garage.PostAsJsonAsync("/api/v1/garage/quotes/draft", new CreateGarageQuoteRequest(
            legacyRequestId, ValidUntil: DateTime.UtcNow.AddDays(7),
            LineItems: new List<CreateQuoteLineItemRequest> { new(QuoteLineType.Service, "Basic service", 1, 2500m) }));
        var update = await garage.PutAsJsonAsync($"/api/v1/garage/quotes/{legacyQuoteId}/draft", new UpdateGarageQuoteDraftRequest(
            ValidUntil: DateTime.UtcNow.AddDays(7),
            LineItems: new List<CreateQuoteLineItemRequest> { new(QuoteLineType.Service, "Basic service", 1, 2400m) }));
        var submit = await garage.PostAsJsonAsync($"/api/v1/garage/quotes/{legacyQuoteId}/submit", new SubmitGarageQuoteCommand(null));
        var revise = await garage.PostAsync($"/api/v1/garage/quotes/{legacyQuoteId}/revision", null);
        var withdraw = await garage.PostAsJsonAsync($"/api/v1/garage/quotes/{legacyQuoteId}/withdraw", new WithdrawGarageQuoteCommand("No longer needed"));

        foreach (var res in new[] { create, update, submit, revise, withdraw })
        {
            var body = await res.Content.ReadAsStringAsync();
            res.StatusCode.Should().Be(HttpStatusCode.BadRequest, body);
            body.Should().Contain($"{request.RequestNumber} is a fixed-price BroCo package, so garages don't quote for it");
        }

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            (await db.GarageQuotes.CountAsync(q => q.ServiceRequestId == request.Id)).Should().Be(1, "no new quote was created");
            (await db.GarageQuotes.AsNoTracking().FirstAsync(q => q.Id == legacyQuoteId)).Status.Should().Be(QuoteStatus.Draft);
            (await db.ServiceRequests.AsNoTracking().FirstAsync(r => r.Id == request.Id)).Status.Should().Be(ServiceRequestStatus.New);
        }

        await CancelAsync(customer, request.Id);
    }

    [Fact]
    public async Task AdvisorAssignment_CreatesTheJob_AndThePackageOnlyEverShowsUpAsAJob()
    {
        var (customer, request) = await BookAsync("STANDARD");
        await PayAdvanceAsync(customer, request.Id);

        var advisor = await SignedInAsync("advisor@brocomod.com");
        var candidates = await advisor.GetFromJsonAsync<ApiResponse<List<PackageGarageCandidateDto>>>($"/api/v1/advisor/requests/{request.Id}/package-garages", JsonOptions);
        var garage = candidates!.Data!.First(g => g.Name == CentralMetro);

        var assign = await advisor.PostAsJsonAsync($"/api/v1/advisor/requests/{request.Id}/package-assignment", new AssignPackageGarageRequest(garage.GarageId, "Nearest"));
        assign.IsSuccessStatusCode.Should().BeTrue(await assign.Content.ReadAsStringAsync());
        var result = (await assign.Content.ReadFromJsonAsync<ApiResponse<PackageAssignmentResultDto>>(JsonOptions))!.Data!;
        result.JobNumber.Should().StartWith("JOB-");
        result.PackagePrice.Should().Be(request.PackagePrice);

        // Advisor screens show the garage and the job, and no dispatch list
        var detail = (await advisor.GetFromJsonAsync<ApiResponse<AdvisorServiceRequestDetailDto>>($"/api/v1/advisor/requests/{request.Id}", JsonOptions))!.Data!;
        detail.AssignedGarageName.Should().Be(CentralMetro);
        detail.ServiceJobId.Should().Be(result.ServiceJobId);
        detail.ServiceJobNumber.Should().Be(result.JobNumber);
        detail.DispatchedGarages.Should().BeEmpty();
        var comparison = (await advisor.GetFromJsonAsync<ApiResponse<QuoteComparisonDto>>($"/api/v1/advisor/requests/{request.Id}/quotes", JsonOptions))!.Data!;
        comparison.ActiveAssignment.Should().NotBeNull("a confirmed package assignment is the active one");
        comparison.ActiveAssignment!.GarageName.Should().Be(CentralMetro);
        (await AdminWorkQueueAsync()).PackageBookingsToAssign.Should().NotContain(r => r.Id == request.Id);

        // Garage: a job, never a request or a quote
        var garageClient = await SignedInAsync(CentralMetroOwner);
        var jobs = await garageClient.GetFromJsonAsync<ApiResponse<List<ServiceJobSummaryDto>>>("/api/v1/garage/jobs", JsonOptions);
        jobs!.Data!.Should().Contain(j => j.Id == result.ServiceJobId && j.RequestNumber == request.RequestNumber);
        var requests = await garageClient.GetFromJsonAsync<ApiResponse<PagedResult<GarageIncomingRequestDto>>>("/api/v1/garage/requests?page=1&pageSize=50", JsonOptions);
        requests!.Data!.Items.Should().NotContain(r => r.ServiceRequestId == request.Id);
        var garageQuotes = await garageClient.GetFromJsonAsync<ApiResponse<List<GarageQuoteSummaryDto>>>("/api/v1/garage/quotes", JsonOptions);
        garageQuotes!.Data!.Should().NotContain(q => q.ServiceRequestId == request.Id);
        var dashboard = await garageClient.GetFromJsonAsync<ApiResponse<GarageDashboardDto>>("/api/v1/garage/dashboard", JsonOptions);
        dashboard!.Data!.SubmittedQuotes.Should().NotContain(q => q.ServiceRequestId == request.Id);
        dashboard.Data.AvailableRequests.Should().NotContain(r => r.ServiceRequestId == request.Id);

        // Customer: no quote to accept
        var customerQuotes = await customer.GetFromJsonAsync<ApiResponse<List<CustomerFacingQuotationDto>>>("/api/v1/customer/quotes", JsonOptions);
        customerQuotes!.Data!.Should().NotContain(q => q.ServiceRequestId == request.Id);

        // The job is left before handover, so no BroCo commission is created by this test.
    }

    [Fact]
    public async Task CandidateGarages_AreALiveNearestFirstSearch_LeavingOutGaragesPausedForOverdueCommission()
    {
        var (customer, request) = await BookAsync("PREMIUM");
        var centralMetroId = await CentralMetroIdAsync();

        using (var scope = _factory.Services.CreateScope())
        {
            var sp = scope.ServiceProvider;
            var live = await sp.GetRequiredService<IPackageBookingService>().GetCandidateGaragesAsync(request.Id);
            live.Should().Contain(g => g.GarageId == centralMetroId);
            live.Select(g => g.DistanceKm).Should().BeInAscendingOrder();
            live.Should().OnlyContain(g => !g.IsBlocked && g.DistanceKm >= 0 && g.DistanceKm <= 10.0);
            var central = live.Single(g => g.GarageId == centralMetroId);
            central.DistanceKm.Should().Be(Math.Round(central.DistanceKm, 1));

            // Same search with Central Metro paused for overdue commission (no shared data is changed)
            var paused = new PackageBookingService(
                sp.GetRequiredService<ApplicationDbContext>(),
                sp.GetRequiredService<IQuoteNumberGenerator>(),
                sp.GetRequiredService<ICustomerQuotationNumberGenerator>(),
                sp.GetRequiredService<IServiceJobNumberGenerator>(),
                new PausedGaragesCommissionService(sp.GetRequiredService<ICommissionService>(), centralMetroId),
                sp.GetRequiredService<INotificationService>(),
                sp.GetRequiredService<IAuditService>(),
                sp.GetRequiredService<ILogger<PackageBookingService>>(),
                sp.GetRequiredService<IGarageMatchingService>());
            var withoutPaused = await paused.GetCandidateGaragesAsync(request.Id);
            withoutPaused.Should().NotContain(g => g.GarageId == centralMetroId);
            withoutPaused.Select(g => g.GarageId).Should().BeSubsetOf(live.Select(g => g.GarageId));
        }

        await CancelAsync(customer, request.Id);
    }

    [Fact]
    public async Task QuoteBasedBooking_StillGoesToNearbyGaragesForQuotes()
    {
        var (customer, request) = await BookAsync(package: null);
        var garageId = await CentralMetroIdAsync();

        request.Status.Should().Be("GARAGES_NOTIFIED");
        request.MatchedGaragesCount.Should().BeGreaterThanOrEqualTo(1);

        Guid garageRequestId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var dispatched = await db.GarageRequests.AsNoTracking().Where(gr => gr.ServiceRequestId == request.Id).ToListAsync();
            dispatched.Should().HaveCount(request.MatchedGaragesCount);
            var mine = dispatched.Single(gr => gr.GarageId == garageId);
            mine.Status.Should().Be(GarageRequestStatus.Notified);
            garageRequestId = mine.Id;

            var ownerId = await db.Users.Where(u => u.Email == CentralMetroOwner).Select(u => u.Id).FirstAsync();
            var told = await db.Notifications.AsNoTracking()
                .Where(n => n.UserId == ownerId && n.ReferenceId == garageRequestId)
                .ToListAsync();
            told.Should().ContainSingle(n => n.Type == "GARAGE_REQUEST_DISPATCHED" && n.Title == $"New Job Request: {request.RequestNumber}");

            (await db.Notifications.AnyAsync(n => n.ReferenceId == request.Id && n.Title == $"New Service Request: {request.RequestNumber}"))
                .Should().BeTrue();
        }

        var garage = await SignedInAsync(CentralMetroOwner);
        var list = await garage.GetFromJsonAsync<ApiResponse<PagedResult<GarageIncomingRequestDto>>>("/api/v1/garage/requests?page=1&pageSize=50", JsonOptions);
        list!.Data!.Items.Should().Contain(r => r.GarageRequestId == garageRequestId);
        (await garage.GetAsync($"/api/v1/garage/requests/{garageRequestId}")).StatusCode.Should().Be(HttpStatusCode.OK);

        var draft = await garage.PostAsJsonAsync("/api/v1/garage/quotes/draft", new CreateGarageQuoteRequest(
            garageRequestId, ValidUntil: DateTime.UtcNow.AddDays(7),
            LineItems: new List<CreateQuoteLineItemRequest> { new(QuoteLineType.Labour, "Clutch plate replacement", 1, 3800m) }));
        draft.StatusCode.Should().Be(HttpStatusCode.Created, await draft.Content.ReadAsStringAsync());

        await CancelAsync(customer, request.Id);
    }

    /// <summary>The real commission service, except that the given garages count as paused for overdue commission.</summary>
    private sealed class PausedGaragesCommissionService : ICommissionService
    {
        private readonly ICommissionService _inner;
        private readonly HashSet<Guid> _paused;

        public PausedGaragesCommissionService(ICommissionService inner, params Guid[] paused)
        {
            _inner = inner;
            _paused = paused.ToHashSet();
        }

        public Task<bool> IsGarageBlockedForNewJobsAsync(Guid garageId, CancellationToken ct = default) =>
            _paused.Contains(garageId) ? Task.FromResult(true) : _inner.IsGarageBlockedForNewJobsAsync(garageId, ct);

        public Task<GarageCommissionDto?> CreateForJobAsync(Guid serviceJobId, CancellationToken ct = default) => _inner.CreateForJobAsync(serviceJobId, ct);
        public Task<IReadOnlyList<GarageCommissionDto>> GetGarageCommissionsAsync(Guid garageId, string? status, CancellationToken ct = default) => _inner.GetGarageCommissionsAsync(garageId, status, ct);
        public Task<GarageCommissionSummaryDto> GetGarageSummaryAsync(Guid garageId, CancellationToken ct = default) => _inner.GetGarageSummaryAsync(garageId, ct);
        public Task<InitiatePaymentResponseDto> InitiateCommissionPaymentAsync(Guid garageId, Guid payerUserId, PayCommissionsRequest request, CancellationToken ct = default) => _inner.InitiateCommissionPaymentAsync(garageId, payerUserId, request, ct);
        public Task SettleCommissionsForPaymentAsync(Guid paymentId, CancellationToken ct = default) => _inner.SettleCommissionsForPaymentAsync(paymentId, ct);
        public Task<PagedResult<GarageCommissionDto>> GetAdminCommissionsAsync(string? status, Guid? garageId, int page, int pageSize, CancellationToken ct = default) => _inner.GetAdminCommissionsAsync(status, garageId, page, pageSize, ct);
        public Task<AdminCommissionOverviewDto> GetAdminOverviewAsync(CancellationToken ct = default) => _inner.GetAdminOverviewAsync(ct);
        public Task<GarageCommissionDto> MarkReceivedAsync(Guid commissionId, MarkCommissionReceivedRequest request, Guid adminUserId, CancellationToken ct = default) => _inner.MarkReceivedAsync(commissionId, request, adminUserId, ct);
        public Task<GarageCommissionDto> WaiveAsync(Guid commissionId, WaiveCommissionRequest request, Guid adminUserId, CancellationToken ct = default) => _inner.WaiveAsync(commissionId, request, adminUserId, ct);
        public Task<CommissionTermsDto> GetTermsAsync(CancellationToken ct = default) => _inner.GetTermsAsync(ct);
        public Task<CommissionTermsDto> UpdateTermsAsync(UpdateCommissionTermsRequest request, Guid adminUserId, CancellationToken ct = default) => _inner.UpdateTermsAsync(request, adminUserId, ct);
        public Task<int> SendDueRemindersAsync(CancellationToken ct = default) => _inner.SendDueRemindersAsync(ct);
    }
}
