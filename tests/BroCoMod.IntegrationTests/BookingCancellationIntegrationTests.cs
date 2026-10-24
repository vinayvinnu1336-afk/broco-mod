using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using BroCoMod.Application.DTOs;
using BroCoMod.Domain.Enums;
using BroCoMod.Infrastructure.Persistence;
using BroCoMod.Infrastructure.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BroCoMod.IntegrationTests;

/// <summary>
/// Owner's rule: only BroCo cancels a booking once anything is paid. The customer may cancel their own
/// request before paying; garages and advisors never cancel (a garage asks BroCo instead); a super admin
/// cancels at any stage, which ends the job, assignment and quotations, waives a due commission and
/// tells everyone, without refunding automatically.
/// </summary>
public class BookingCancellationIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private const string Password = "Password123!";
    private const string GarageEmail = "garage.owner@centralmetro.com";
    private const string AdvisorEmail = "advisor@brocomod.com";
    private const string AdminEmail = "admin@brocomod.com";
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    private readonly WebApplicationFactory<Program> _factory;

    public BookingCancellationIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    // ---------- helpers ----------

    private async Task<HttpClient> SignInAsync(string email)
    {
        var anon = _factory.CreateClient();
        var response = await anon.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, Password));
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(JsonOptions);
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body!.Data!.AccessToken);
        return client;
    }

    private async Task<(HttpClient Customer, Guid VehicleId)> NewCustomerWithCarAsync()
    {
        var email = $"cancel_{Guid.NewGuid():N}@brocomod.com";
        (await _factory.CreateClient().PostAsJsonAsync("/api/v1/auth/register",
            new RegisterRequest(email, Password, "Cancellation Customer", TestMobiles.New()))).EnsureSuccessStatusCode();
        var customer = await SignInAsync(email);

        var makes = await customer.GetFromJsonAsync<ApiResponse<List<VehicleManufacturerDto>>>("/api/v1/vehicle-manufacturers", JsonOptions);
        var maruti = makes!.Data!.Single(m => m.Name == "Maruti Suzuki");
        var models = await customer.GetFromJsonAsync<ApiResponse<List<VehicleModelDto>>>($"/api/v1/vehicle-manufacturers/{maruti.Id}/models", JsonOptions);
        var swift = models!.Data!.Single(m => m.Name == "Swift");

        var plate = $"TS-12-CX-{Random.Shared.Next(1000, 9999)}";
        var added = await customer.PostAsJsonAsync("/api/v1/customer/vehicles", new CreateCustomerVehicleRequest(
            maruti.Id, swift.Id, null, 2022, FuelType.Petrol, "Manual", plate, "", 20000, "White"));
        added.IsSuccessStatusCode.Should().BeTrue(await added.Content.ReadAsStringAsync());
        var vehicle = await added.Content.ReadFromJsonAsync<ApiResponse<CustomerVehicleDetailDto>>(JsonOptions);
        return (customer, vehicle!.Data!.Id);
    }

    /// <summary>Banjara Hills, Hyderabad, next to the demo garage Central Metro Motors.</summary>
    private static CreateServiceBookingRequest Booking(Guid vehicleId, string? package) =>
        new(vehicleId, "Plot 12, Road No. 2", "Banjara Hills", "Hyderabad", "Telangana", "500034", "India", 17.4126, 78.4482,
            ProblemDescription: package == null ? "Brakes squeal when stopping" : "",
            ServiceCategory: package == null ? "Brakes" : null,
            PackageCode: package);

    private async Task<(HttpClient Customer, ServiceRequestDetailDto Request)> BookAsync(string? package)
    {
        var (customer, vehicleId) = await NewCustomerWithCarAsync();
        var res = await customer.PostAsJsonAsync("/api/v1/customer/requests", Booking(vehicleId, package));
        res.StatusCode.Should().Be(HttpStatusCode.Created, await res.Content.ReadAsStringAsync());
        return (customer, (await res.Content.ReadFromJsonAsync<ApiResponse<ServiceRequestDetailDto>>(JsonOptions))!.Data!);
    }

    private static async Task<decimal> PayPackageAdvanceAsync(HttpClient customer, Guid requestId)
    {
        var pay = await customer.PostAsJsonAsync($"/api/v1/customer/requests/{requestId}/advance/pay", new InitiateAdvancePaymentRequest(null));
        pay.IsSuccessStatusCode.Should().BeTrue(await pay.Content.ReadAsStringAsync());
        var checkout = (await pay.Content.ReadFromJsonAsync<ApiResponse<InitiatePaymentResponseDto>>(JsonOptions))!.Data!;
        (await customer.PostAsJsonAsync("/api/v1/customer/payments/verify",
            new VerifyPaymentRequestDto(checkout.PaymentId, $"pay_cancel_{Guid.NewGuid():N}", "sig_fake_valid", checkout.GatewayOrderId)))
            .EnsureSuccessStatusCode();
        return checkout.Amount;
    }

    private static async Task<decimal> PayQuotationAdvanceAsync(HttpClient customer, Guid quotationId)
    {
        var init = await customer.PostAsJsonAsync("/api/v1/customer/payments/initiate", new InitiatePaymentRequestDto(quotationId));
        init.IsSuccessStatusCode.Should().BeTrue(await init.Content.ReadAsStringAsync());
        var checkout = (await init.Content.ReadFromJsonAsync<ApiResponse<InitiatePaymentResponseDto>>(JsonOptions))!.Data!;
        (await customer.PostAsJsonAsync("/api/v1/customer/payments/verify",
            new VerifyPaymentRequestDto(checkout.PaymentId, $"pay_cancel_q_{Guid.NewGuid():N}", "sig_fake_valid", checkout.GatewayOrderId)))
            .EnsureSuccessStatusCode();
        return checkout.Amount;
    }

    private async Task<Guid> CentralMetroIdAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await db.GarageUsers.AsNoTracking().Where(gu => gu.User.Email == GarageEmail).Select(gu => gu.GarageId).FirstAsync();
    }

    /// <summary>Paid package booking assigned by the advisor to Central Metro: returns the job id.</summary>
    private async Task<Guid> AssignPackageAsync(Guid requestId)
    {
        var garageId = await CentralMetroIdAsync();
        var advisor = await SignInAsync(AdvisorEmail);
        var assign = await advisor.PostAsJsonAsync($"/api/v1/advisor/requests/{requestId}/package-assignment", new AssignPackageGarageRequest(garageId, "Nearest"));
        assign.IsSuccessStatusCode.Should().BeTrue(await assign.Content.ReadAsStringAsync());
        return (await assign.Content.ReadFromJsonAsync<ApiResponse<PackageAssignmentResultDto>>(JsonOptions))!.Data!.ServiceJobId;
    }

    /// <summary>Quote-based request: Central Metro quotes, the advisor assigns it and sends the quotation, the customer accepts.</summary>
    private async Task<(HttpClient Customer, ServiceRequestDetailDto Request, Guid QuotationId, Guid JobId)> AcceptedQuoteBookingAsync()
    {
        var (customer, request) = await BookAsync(package: null);
        var garageId = await CentralMetroIdAsync();
        Guid garageRequestId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            garageRequestId = (await db.GarageRequests.AsNoTracking().FirstAsync(r => r.ServiceRequestId == request.Id && r.GarageId == garageId)).Id;
        }

        var garage = await SignInAsync(GarageEmail);
        var draft = await garage.PostAsJsonAsync("/api/v1/garage/quotes/draft", new CreateGarageQuoteRequest(
            GarageRequestId: garageRequestId,
            Currency: "INR",
            EstimatedCompletionHours: 3,
            EstimatedCompletionDays: 1,
            ValidUntil: DateTime.UtcNow.AddDays(7),
            GarageRemarks: "Brake pads and disc skim.",
            LineItems: new List<CreateQuoteLineItemRequest> { new(QuoteLineType.Part, "Brake pads", 1, 2600m, 0m, 1) }));
        draft.IsSuccessStatusCode.Should().BeTrue(await draft.Content.ReadAsStringAsync());
        var garageQuoteId = (await draft.Content.ReadFromJsonAsync<ApiResponse<GarageQuoteDetailDto>>(JsonOptions))!.Data!.Id;
        (await garage.PostAsJsonAsync($"/api/v1/garage/quotes/{garageQuoteId}/submit", new SubmitGarageQuoteCommand())).EnsureSuccessStatusCode();

        var advisor = await SignInAsync(AdvisorEmail);
        (await advisor.PostAsJsonAsync($"/api/v1/advisor/requests/{request.Id}/assignment",
            new AssignGarageRequest(garageId, garageQuoteId, "Closest garage."))).EnsureSuccessStatusCode();
        var cq = await advisor.PostAsJsonAsync($"/api/v1/advisor/requests/{request.Id}/customer-quotation", new CreateCustomerQuotationRequest(
            ScopeSummary: "Brake pads replacement",
            AdvisorRemarks: null,
            ValidUntilUtc: DateTime.UtcNow.AddDays(7),
            CustomerDiscount: 0m,
            Currency: "INR",
            LineItems: new List<CustomerQuotationLineItemInputDto> { new(QuoteLineType.Part, "Brake pads", 1, 2600m, 0m, 1) }));
        cq.IsSuccessStatusCode.Should().BeTrue(await cq.Content.ReadAsStringAsync());
        var quotationId = (await cq.Content.ReadFromJsonAsync<ApiResponse<CustomerQuotationDto>>(JsonOptions))!.Data!.Id;
        (await advisor.PostAsJsonAsync($"/api/v1/advisor/customer-quotations/{quotationId}/ready", new { })).EnsureSuccessStatusCode();
        (await advisor.PostAsJsonAsync($"/api/v1/advisor/customer-quotations/{quotationId}/send", new { })).EnsureSuccessStatusCode();
        (await customer.PostAsJsonAsync($"/api/v1/customer/quotes/{quotationId}/accept", new AcceptQuotationRequest(null))).EnsureSuccessStatusCode();

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var jobId = (await db.ServiceJobs.AsNoTracking().FirstAsync(j => j.ServiceRequestId == request.Id)).Id;
            return (customer, request, quotationId, jobId);
        }
    }

    private static Task<HttpResponseMessage> CustomerCancelAsync(HttpClient customer, Guid requestId) =>
        customer.PostAsJsonAsync($"/api/v1/customer/requests/{requestId}/cancel", new CancelServiceRequestCommand("Plans changed"));

    private async Task<AdminBookingCancellationDto> AdminCancelAsync(Guid requestId, string reason = "Customer called support to cancel")
    {
        var admin = await SignInAsync(AdminEmail);
        var res = await admin.PostAsJsonAsync($"/api/v1/admin/requests/{requestId}/cancel", new AdminCancelBookingRequest(reason));
        res.StatusCode.Should().Be(HttpStatusCode.OK, await res.Content.ReadAsStringAsync());
        return (await res.Content.ReadFromJsonAsync<ApiResponse<AdminBookingCancellationDto>>(JsonOptions))!.Data!;
    }

    private static async Task ShouldBeConflictAfterPaymentAsync(HttpResponseMessage res)
    {
        var body = await res.Content.ReadAsStringAsync();
        res.StatusCode.Should().Be(HttpStatusCode.Conflict, body);
        body.Should().Contain("This booking can't be cancelled after payment. Please contact BroCo support.");
    }

    private async Task<List<(Guid UserId, string Title)>> CancelNotificationsAsync(Guid referenceId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var rows = await db.Notifications.AsNoTracking()
            .Where(n => n.ReferenceId == referenceId && n.Type == BookingCancellationService.BookingCancelledNotification)
            .Select(n => new { n.UserId, n.Title })
            .ToListAsync();
        return rows.Select(r => (r.UserId, r.Title)).ToList();
    }

    private async Task<(Guid CustomerUserId, Guid? AdvisorUserId, List<Guid> GarageUserIds)> PartiesAsync(Guid requestId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var request = await db.ServiceRequests.AsNoTracking().Include(r => r.CustomerProfile).Include(r => r.AssignedAdvisor).FirstAsync(r => r.Id == requestId);
        var garageId = await CentralMetroIdAsync();
        var garageUsers = await db.GarageUsers.AsNoTracking().Where(gu => gu.GarageId == garageId && gu.User.IsActive).Select(gu => gu.UserId).ToListAsync();
        return (request.CustomerProfile!.UserId, request.AssignedAdvisor?.UserId, garageUsers);
    }

    // ---------- customer ----------

    [Fact]
    public async Task Customer_can_cancel_a_package_booking_before_paying()
    {
        var (customer, request) = await BookAsync("BASIC");

        var res = await CustomerCancelAsync(customer, request.Id);
        res.StatusCode.Should().Be(HttpStatusCode.OK, await res.Content.ReadAsStringAsync());

        var detail = (await customer.GetFromJsonAsync<ApiResponse<ServiceRequestDetailDto>>($"/api/v1/customer/requests/{request.Id}", JsonOptions))!.Data!;
        detail.Status.Should().Be("CANCELLED");
        detail.CancellationReason.Should().Be("Plans changed");
    }

    [Fact]
    public async Task Customer_gets_409_after_paying_the_package_advance_and_admin_cancels_without_refunding()
    {
        var (customer, request) = await BookAsync("STANDARD");
        var advance = await PayPackageAdvanceAsync(customer, request.Id);

        await ShouldBeConflictAfterPaymentAsync(await CustomerCancelAsync(customer, request.Id));

        var admin = await SignInAsync(AdminEmail);
        var preview = (await admin.GetFromJsonAsync<ApiResponse<AdminBookingCancellationDto>>($"/api/v1/admin/requests/{request.Id}/cancellation", JsonOptions))!.Data!;
        preview.CanCancel.Should().BeTrue();
        preview.IsCancelled.Should().BeFalse();
        preview.PaidOnline.Should().Be(advance);
        preview.RefundableNow.Should().Be(advance);
        preview.Payments.Should().ContainSingle(p => p.Purpose == "BookingAdvance" && p.Status == "Paid");
        preview.RefundLink.Should().Be($"/admin/payments?q={request.RequestNumber}");

        var result = await AdminCancelAsync(request.Id);
        result.IsCancelled.Should().BeTrue();
        result.CanCancel.Should().BeFalse();
        result.CancellationReason.Should().Be("Customer called support to cancel");
        result.RefundableNow.Should().Be(advance, "cancelling never refunds by itself");

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        (await db.ServiceRequests.AsNoTracking().FirstAsync(r => r.Id == request.Id)).Status.Should().Be(ServiceRequestStatus.Cancelled);
        (await db.Payments.AsNoTracking().Where(p => p.ServiceRequestId == request.Id).Select(p => p.Status).ToListAsync())
            .Should().OnlyContain(s => s == PaymentStatus.Paid);

        var (customerUserId, _, _) = await PartiesAsync(request.Id);
        var notes = await CancelNotificationsAsync(request.Id);
        notes.Should().Contain(n => n.UserId == customerUserId && n.Title == "Booking cancelled");
        (await db.AuditLogs.AsNoTracking().AnyAsync(a => a.Action == "SERVICE_REQUEST_CANCELLED_BY_ADMIN" && a.EntityId == request.Id.ToString()))
            .Should().BeTrue();

        // A second cancel is refused, and the customer still can't do it
        var again = await admin.PostAsJsonAsync($"/api/v1/admin/requests/{request.Id}/cancel", new AdminCancelBookingRequest("Again"));
        again.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Customer_can_cancel_an_accepted_quote_before_paying_and_the_job_assignment_and_quotation_end_with_it()
    {
        var (customer, request, quotationId, jobId) = await AcceptedQuoteBookingAsync();

        var res = await CustomerCancelAsync(customer, request.Id);
        res.StatusCode.Should().Be(HttpStatusCode.OK, await res.Content.ReadAsStringAsync());

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        (await db.ServiceRequests.AsNoTracking().FirstAsync(r => r.Id == request.Id)).Status.Should().Be(ServiceRequestStatus.Cancelled);
        (await db.ServiceJobs.AsNoTracking().FirstAsync(j => j.Id == jobId)).Status.Should().Be(ServiceJobStatus.Cancelled);
        (await db.CustomerQuotations.AsNoTracking().FirstAsync(q => q.Id == quotationId)).Status.Should().Be(CustomerQuotationStatus.Cancelled);
        (await db.GarageAssignments.AsNoTracking().Where(a => a.ServiceRequestId == request.Id).Select(a => a.Status).ToListAsync())
            .Should().NotContain(s => s == GarageAssignmentStatus.Assigned || s == GarageAssignmentStatus.Confirmed);

        // The garage hears about it
        var (_, _, garageUsers) = await PartiesAsync(request.Id);
        (await CancelNotificationsAsync(jobId)).Select(n => n.UserId).Should().Contain(garageUsers);
    }

    [Fact]
    public async Task After_paying_a_quote_advance_customer_gets_409_garage_gets_403_and_only_the_admin_can_cancel()
    {
        var (customer, request, quotationId, jobId) = await AcceptedQuoteBookingAsync();
        var advance = await PayQuotationAdvanceAsync(customer, quotationId);

        await ShouldBeConflictAfterPaymentAsync(await CustomerCancelAsync(customer, request.Id));

        // Garage: no cancel
        var garage = await SignInAsync(GarageEmail);
        var garageCancel = await garage.PostAsJsonAsync($"/api/v1/garage/jobs/{jobId}/cancel", new CancelJobRequest("Can't do it"));
        garageCancel.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await garageCancel.Content.ReadAsStringAsync()).Should().Contain("Garages can't cancel bookings");

        // Advisor: no cancel route at all, and the admin route is refused
        var advisor = await SignInAsync(AdvisorEmail);
        (await advisor.PostAsJsonAsync($"/api/v1/advisor/requests/{request.Id}/cancel", new CancelServiceRequestCommand("x")))
            .IsSuccessStatusCode.Should().BeFalse();
        (await advisor.PostAsJsonAsync($"/api/v1/admin/requests/{request.Id}/cancel", new AdminCancelBookingRequest("x")))
            .StatusCode.Should().Be(HttpStatusCode.Forbidden);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            (await db.ServiceJobs.AsNoTracking().FirstAsync(j => j.Id == jobId)).Status.Should().Be(ServiceJobStatus.BookingConfirmed);
            (await db.ServiceRequests.AsNoTracking().FirstAsync(r => r.Id == request.Id)).Status.Should().NotBe(ServiceRequestStatus.Cancelled);
        }

        var result = await AdminCancelAsync(request.Id, "Garage unavailable this week");
        result.PaidOnline.Should().Be(advance);
        result.JobStatus.Should().Be("Cancelled");

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var job = await db.ServiceJobs.AsNoTracking().FirstAsync(j => j.Id == jobId);
            job.Status.Should().Be(ServiceJobStatus.Cancelled);
            job.CancellationReason.Should().Be("Garage unavailable this week");
            (await db.CustomerQuotations.AsNoTracking().FirstAsync(q => q.Id == quotationId)).Status.Should().Be(CustomerQuotationStatus.Cancelled);
        }

        var (customerUserId, advisorUserId, garageUsers) = await PartiesAsync(request.Id);
        var requestNotes = await CancelNotificationsAsync(request.Id);
        requestNotes.Should().Contain(n => n.UserId == customerUserId);
        if (advisorUserId.HasValue) requestNotes.Should().Contain(n => n.UserId == advisorUserId.Value);
        (await CancelNotificationsAsync(jobId)).Select(n => n.UserId).Should().Contain(garageUsers);
    }

    // ---------- garage asks BroCo ----------

    [Fact]
    public async Task Garage_can_ask_BroCo_to_reassign_or_cancel_which_notifies_admins_and_the_advisor_without_cancelling()
    {
        var (customer, request) = await BookAsync("BASIC");
        await PayPackageAdvanceAsync(customer, request.Id);
        var jobId = await AssignPackageAsync(request.Id);

        var garage = await SignInAsync(GarageEmail);
        var empty = await garage.PostAsJsonAsync($"/api/v1/garage/jobs/{jobId}/cancellation-request", new GarageCancellationAskRequest(" "));
        empty.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var ask = await garage.PostAsJsonAsync($"/api/v1/garage/jobs/{jobId}/cancellation-request",
            new GarageCancellationAskRequest("Our lift is broken until next week"));
        ask.StatusCode.Should().Be(HttpStatusCode.OK, await ask.Content.ReadAsStringAsync());
        (await ask.Content.ReadFromJsonAsync<ApiResponse<GarageCancellationAskResultDto>>(JsonOptions))!.Data!.NotifiedCount.Should().BeGreaterThan(0);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            (await db.ServiceJobs.AsNoTracking().FirstAsync(j => j.Id == jobId)).Status.Should().Be(ServiceJobStatus.BookingConfirmed, "asking cancels nothing");

            var adminId = await db.Users.AsNoTracking().Where(u => u.Email == AdminEmail).Select(u => u.Id).FirstAsync();
            var asked = await db.Notifications.AsNoTracking()
                .Where(n => n.ReferenceId == request.Id && n.Type == BookingCancellationService.CancellationAskedNotification)
                .ToListAsync();
            asked.Should().Contain(n => n.UserId == adminId && n.Message.Contains("Our lift is broken until next week"));
            var (_, advisorUserId, _) = await PartiesAsync(request.Id);
            if (advisorUserId.HasValue) asked.Should().Contain(n => n.UserId == advisorUserId.Value);
            (await db.AuditLogs.AsNoTracking().AnyAsync(a => a.Action == "SERVICE_JOB_CANCELLATION_REQUESTED" && a.EntityId == jobId.ToString()))
                .Should().BeTrue();
        }

        await AdminCancelAsync(request.Id, "Garage asked to drop the job");
    }

    // ---------- admin at every stage ----------

    [Fact]
    public async Task Admin_can_cancel_before_any_payment()
    {
        var (_, request) = await BookAsync(package: null);

        var result = await AdminCancelAsync(request.Id, "Duplicate booking");
        result.IsCancelled.Should().BeTrue();
        result.PaidOnline.Should().Be(0);
        result.Payments.Should().BeEmpty();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        (await db.GarageRequests.AsNoTracking().Where(gr => gr.ServiceRequestId == request.Id).Select(gr => gr.Status).ToListAsync())
            .Should().OnlyContain(s => s == GarageRequestStatus.Expired, "garages stop seeing a cancelled request as open");
        var (customerUserId, _, _) = await PartiesAsync(request.Id);
        (await CancelNotificationsAsync(request.Id)).Should().Contain(n => n.UserId == customerUserId);
    }

    [Fact]
    public async Task Admin_can_cancel_a_job_in_progress()
    {
        var (customer, request) = await BookAsync("STANDARD");
        await PayPackageAdvanceAsync(customer, request.Id);
        var jobId = await AssignPackageAsync(request.Id);

        var garage = await SignInAsync(GarageEmail);
        (await garage.PostAsJsonAsync($"/api/v1/garage/jobs/{jobId}/receive", new ReceiveVehicleRequest(21000, "At the gate"))).EnsureSuccessStatusCode();
        (await garage.PostAsJsonAsync($"/api/v1/garage/jobs/{jobId}/work/start", new StartWorkRequest("Bay 2"))).EnsureSuccessStatusCode();

        await ShouldBeConflictAfterPaymentAsync(await CustomerCancelAsync(customer, request.Id));

        var result = await AdminCancelAsync(request.Id, "Customer wants the car back unserviced");
        result.JobStatus.Should().Be("Cancelled");

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        (await db.ServiceJobs.AsNoTracking().FirstAsync(j => j.Id == jobId)).Status.Should().Be(ServiceJobStatus.Cancelled);
        (await db.GarageCommissions.AsNoTracking().AnyAsync(c => c.ServiceJobId == jobId)).Should().BeFalse("no commission before handover");

        // A cancelled job can't be moved on by the garage
        (await garage.PostAsJsonAsync($"/api/v1/garage/jobs/{jobId}/work/complete", new CompleteWorkRequest("Done", "Done")))
            .IsSuccessStatusCode.Should().BeFalse();
    }

    [Fact]
    public async Task Admin_cancel_after_handover_waives_the_due_commission()
    {
        var (customer, request) = await BookAsync("BASIC");
        await PayPackageAdvanceAsync(customer, request.Id);
        var jobId = await AssignPackageAsync(request.Id);

        var garage = await SignInAsync(GarageEmail);
        foreach (var (path, body) in new (string, object)[]
                 {
                     ("receive", new ReceiveVehicleRequest(21000, "At the gate")),
                     ("work/start", new StartWorkRequest("Bay 1")),
                     ("work/complete", new CompleteWorkRequest("Done", "Service done")),
                     ("vehicle-ready", new VehicleReadyRequest("Ready")),
                     ("payment-received", new RecordPaymentReceivedRequest(0m, "Cash")),
                     ("handover", new HandOverVehicleRequest("Keys given")),
                 })
        {
            var step = await garage.PostAsJsonAsync($"/api/v1/garage/jobs/{jobId}/{path}", body);
            step.IsSuccessStatusCode.Should().BeTrue($"{path}: {await step.Content.ReadAsStringAsync()}");
        }

        var admin = await SignInAsync(AdminEmail);
        var preview = (await admin.GetFromJsonAsync<ApiResponse<AdminBookingCancellationDto>>($"/api/v1/admin/requests/{request.Id}/cancellation", JsonOptions))!.Data!;
        preview.CommissionStatus.Should().Be("Due");

        var result = await AdminCancelAsync(request.Id, "Customer dispute, goodwill cancellation");
        result.CommissionStatus.Should().Be("Waived");

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var commission = await db.GarageCommissions.AsNoTracking().SingleAsync(c => c.ServiceJobId == jobId);
        commission.Status.Should().Be(GarageCommissionStatus.Waived);
        commission.WaiverReason.Should().Contain(request.RequestNumber);
    }

    [Fact]
    public async Task Only_a_super_admin_can_use_the_admin_cancel()
    {
        var (customer, request) = await BookAsync("BASIC");
        var garage = await SignInAsync(GarageEmail);

        foreach (var client in new[] { customer, garage })
        {
            (await client.PostAsJsonAsync($"/api/v1/admin/requests/{request.Id}/cancel", new AdminCancelBookingRequest("x")))
                .StatusCode.Should().Be(HttpStatusCode.Forbidden);
            (await client.GetAsync($"/api/v1/admin/requests/{request.Id}/cancellation"))
                .StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }
        (await _factory.CreateClient().PostAsJsonAsync($"/api/v1/admin/requests/{request.Id}/cancel", new AdminCancelBookingRequest("x")))
            .StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        // A reason is required
        var admin = await SignInAsync(AdminEmail);
        (await admin.PostAsJsonAsync($"/api/v1/admin/requests/{request.Id}/cancel", new AdminCancelBookingRequest("  ")))
            .StatusCode.Should().Be(HttpStatusCode.BadRequest);

        (await CustomerCancelAsync(customer, request.Id)).EnsureSuccessStatusCode();
    }
}
