using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Constants;
using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Entities.Identity;
using BroCoMod.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BroCoMod.IntegrationTests;

/// <summary>
/// Admins and advisors chase garages for unpaid BroCo commission: they see every garage's dues and can
/// remind a garage on demand (at most once an hour per due), one due or all overdue dues at once.
/// Each test owns a garage far from every booking, bills it commission, and waives it at the end.
/// </summary>
public class GarageDuesRemindersIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private const string Password = "Password123!";
    private const string AdvisorEmail = "advisor@brocomod.com";
    private const string AdminEmail = "admin@brocomod.com";

    private readonly WebApplicationFactory<Program> _factory;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public GarageDuesRemindersIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Advisor_SeesAGaragesDues_AndCanRemindOnce_ThenIsThrottled()
    {
        var garage = await CreateGarageAsync();
        var dueAt = DateTime.UtcNow.AddHours(20);
        var commissionId = await BillGarageAsync(garage.GarageId, dueAt);
        var advisor = await SignedInAsync(AdvisorEmail);
        var admin = await SignedInAsync(AdminEmail);
        try
        {
            // The list finds it by garage name, with the garage's phone and the job, and honours the filters.
            var list = await GetDuesAsync(advisor, $"/api/v1/advisor/commissions?search={Uri.EscapeDataString(garage.Name)}&status=Due");
            var due = list.Items.Should().ContainSingle(c => c.Id == commissionId).Subject;
            due.GarageName.Should().Be(garage.Name);
            due.GaragePhone.Should().Be(garage.Phone);
            due.JobNumber.Should().StartWith("JOB-");
            due.TotalDue.Should().Be(500m, "10% of ₹5,000");
            due.IsOverdue.Should().BeFalse();
            due.DaysOverdue.Should().Be(0);
            due.GarageBlocked.Should().BeFalse();
            due.NextManualReminderAtUtc.Should().BeNull();

            (await GetDuesAsync(advisor, $"/api/v1/advisor/commissions?search={Uri.EscapeDataString(garage.Name)}&status=Overdue"))
                .Items.Should().BeEmpty("the due date has not passed");
            (await GetDuesAsync(advisor, $"/api/v1/advisor/commissions?garageId={garage.GarageId}&dueFrom={Iso(dueAt.AddDays(1))}"))
                .Items.Should().BeEmpty("it is due before that date");
            (await GetDuesAsync(advisor, $"/api/v1/advisor/commissions?garageId={garage.GarageId}&dueFrom={Iso(dueAt.AddHours(-1))}&dueTo={Iso(dueAt.AddHours(1))}"))
                .Items.Should().ContainSingle(c => c.Id == commissionId);
            (await GetDuesAsync(advisor, $"/api/v1/advisor/commissions?search={due.JobNumber}&status=All"))
                .Items.Should().Contain(c => c.Id == commissionId);

            var garages = await advisor.GetFromJsonAsync<ApiResponse<List<GarageDuesSummaryDto>>>("/api/v1/advisor/commissions/garages", JsonOptions);
            var summary = garages!.Data!.Should().ContainSingle(g => g.GarageId == garage.GarageId).Subject;
            summary.OutstandingAmount.Should().Be(500m);
            summary.OutstandingCount.Should().Be(1);
            summary.OverdueCount.Should().Be(0);

            var overview = await advisor.GetFromJsonAsync<ApiResponse<GarageDuesOverviewDto>>("/api/v1/advisor/commissions/overview", JsonOptions);
            overview!.Data!.OutstandingCount.Should().BeGreaterThan(0);

            // Remind now: the garage's users get it, the count goes up and the audit trail says who sent it.
            var before = await LoadAsync(commissionId);
            var notificationsBefore = await GarageNotificationCountAsync(garage.OwnerId, commissionId);

            var remind = await advisor.PostAsync($"/api/v1/advisor/commissions/{commissionId}/remind", null);
            remind.StatusCode.Should().Be(HttpStatusCode.OK, await remind.Content.ReadAsStringAsync());
            var result = (await remind.Content.ReadFromJsonAsync<ApiResponse<CommissionReminderResultDto>>(JsonOptions))!.Data!;
            result.Sent.Should().BeTrue();
            result.Commission.RemindersSent.Should().Be(before.RemindersSent + 1);
            result.Commission.NextManualReminderAtUtc.Should().BeAfter(DateTime.UtcNow.AddMinutes(55));

            var after = await LoadAsync(commissionId);
            after.RemindersSent.Should().Be(before.RemindersSent + 1);
            after.LastReminderAtUtc.Should().BeAfter(before.LastReminderAtUtc ?? DateTime.MinValue);
            (await GarageNotificationCountAsync(garage.OwnerId, commissionId)).Should().Be(notificationsBefore + 1);

            using (var scope = _factory.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                var advisorId = await db.Users.Where(u => u.Email == AdvisorEmail).Select(u => u.Id).FirstAsync();
                (await db.AuditLogs.AnyAsync(a => a.Action == "GARAGE_COMMISSION_REMINDER_SENT" && a.EntityId == commissionId.ToString() && a.UserId == advisorId))
                    .Should().BeTrue();
            }

            // A second reminder straight away is refused, whoever sends it, and nothing is sent.
            var again = await advisor.PostAsync($"/api/v1/advisor/commissions/{commissionId}/remind", null);
            again.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
            var againBody = await again.Content.ReadFromJsonAsync<ApiResponse<CommissionReminderResultDto>>(JsonOptions);
            againBody!.Success.Should().BeFalse();
            againBody.Message.Should().Contain("another reminder in");
            var byAdmin = await admin.PostAsync($"/api/v1/admin/commissions/{commissionId}/remind", null);
            byAdmin.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
            (await LoadAsync(commissionId)).RemindersSent.Should().Be(before.RemindersSent + 1);
            (await GarageNotificationCountAsync(garage.OwnerId, commissionId)).Should().Be(notificationsBefore + 1);

            // The admin list carries the same staff fields.
            var adminList = await GetDuesAsync(admin, $"/api/v1/admin/commissions?garageId={garage.GarageId}");
            adminList.Items.Should().ContainSingle(c => c.Id == commissionId).Which.NextManualReminderAtUtc.Should().NotBeNull();
        }
        finally
        {
            await WaiveAsync(admin, commissionId);
        }
    }

    [Fact]
    public async Task GaragesAndCustomers_CannotSeeOrSendStaffReminders()
    {
        var garage = await CreateGarageAsync();
        var commissionId = await BillGarageAsync(garage.GarageId, DateTime.UtcNow.AddHours(20));
        var admin = await SignedInAsync(AdminEmail);
        try
        {
            var garageClient = await SignedInAsync(garage.OwnerEmail);
            var customer = await NewCustomerAsync();

            foreach (var client in new[] { garageClient, customer })
            {
                (await client.GetAsync("/api/v1/advisor/commissions")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
                (await client.GetAsync("/api/v1/advisor/commissions/overview")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
                (await client.PostAsync($"/api/v1/advisor/commissions/{commissionId}/remind", null)).StatusCode.Should().Be(HttpStatusCode.Forbidden);
                (await client.PostAsJsonAsync("/api/v1/advisor/commissions/remind-overdue", new RemindOverdueCommissionsRequest(null))).StatusCode.Should().Be(HttpStatusCode.Forbidden);
                (await client.GetAsync("/api/v1/admin/commissions")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
                (await client.PostAsync($"/api/v1/admin/commissions/{commissionId}/remind", null)).StatusCode.Should().Be(HttpStatusCode.Forbidden);
                (await client.PostAsJsonAsync("/api/v1/admin/commissions/remind-overdue", new RemindOverdueCommissionsRequest(null))).StatusCode.Should().Be(HttpStatusCode.Forbidden);
            }

            // Advisors can chase garages but recording payments stays with admins.
            var advisor = await SignedInAsync(AdvisorEmail);
            (await advisor.PostAsJsonAsync($"/api/v1/admin/commissions/{commissionId}/waive", new WaiveCommissionRequest("Not allowed")))
                .StatusCode.Should().Be(HttpStatusCode.Forbidden);
            (await LoadAsync(commissionId)).RemindersSent.Should().Be(1, "only the bill itself was sent");
        }
        finally
        {
            await WaiveAsync(admin, commissionId);
        }
    }

    [Fact]
    public async Task RemindAllOverdue_SendsTheGarageOneReminderForAllItsOverdueDues_AndStaffAreAlertedOnce()
    {
        var garage = await CreateGarageAsync();
        // Overdue for longer than the blocking threshold, so the garage is also paused for new jobs.
        var first = await BillGarageAsync(garage.GarageId, DateTime.UtcNow.AddDays(-5));
        var second = await BillGarageAsync(garage.GarageId, DateTime.UtcNow.AddDays(-4));
        var notYetDue = await BillGarageAsync(garage.GarageId, DateTime.UtcNow.AddHours(10));
        var admin = await SignedInAsync(AdminEmail);
        var advisor = await SignedInAsync(AdvisorEmail);
        try
        {
            var overdueList = await GetDuesAsync(advisor, $"/api/v1/advisor/commissions?garageId={garage.GarageId}&status=Overdue&sort=garage");
            overdueList.Items.Select(c => c.Id).Should().BeEquivalentTo(new[] { first, second });
            overdueList.Items.Should().OnlyContain(c => c.IsOverdue && c.DaysOverdue >= 4 && c.GarageBlocked);

            var ownerNotificationsBefore = await GarageNotificationCountAsync(garage.OwnerId, null);
            var res = await advisor.PostAsJsonAsync("/api/v1/advisor/commissions/remind-overdue", new RemindOverdueCommissionsRequest(garage.GarageId));
            res.StatusCode.Should().Be(HttpStatusCode.OK, await res.Content.ReadAsStringAsync());
            var bulk = (await res.Content.ReadFromJsonAsync<ApiResponse<BulkCommissionReminderResultDto>>(JsonOptions))!.Data!;
            bulk.DuesReminded.Should().Be(2);
            bulk.GaragesReminded.Should().Be(1);
            bulk.SkippedRecentlyReminded.Should().Be(0);

            (await LoadAsync(first)).RemindersSent.Should().Be(2);
            (await LoadAsync(second)).RemindersSent.Should().Be(2);
            (await LoadAsync(notYetDue)).RemindersSent.Should().Be(1, "it is not overdue");
            (await GarageNotificationCountAsync(garage.OwnerId, null)).Should().Be(ownerNotificationsBefore + 1, "one message covers both dues");

            // Straight away again: both were just reminded, so nothing goes out.
            var again = await admin.PostAsJsonAsync("/api/v1/admin/commissions/remind-overdue", new RemindOverdueCommissionsRequest(garage.GarageId));
            again.StatusCode.Should().Be(HttpStatusCode.OK);
            var againBulk = (await again.Content.ReadFromJsonAsync<ApiResponse<BulkCommissionReminderResultDto>>(JsonOptions))!.Data!;
            againBulk.DuesReminded.Should().Be(0);
            againBulk.SkippedRecentlyReminded.Should().Be(2);
            (await GarageNotificationCountAsync(garage.OwnerId, null)).Should().Be(ownerNotificationsBefore + 1);

            // Staff hear about an overdue due once, however often the reminder sweep runs.
            using (var scope = _factory.Services.CreateScope())
            {
                var dues = scope.ServiceProvider.GetRequiredService<ICommissionDuesService>();
                await dues.NotifyStaffOfOverdueDuesAsync();
                await dues.NotifyStaffOfOverdueDuesAsync();
            }
            using (var scope = _factory.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                var advisorId = await db.Users.Where(u => u.Email == AdvisorEmail).Select(u => u.Id).FirstAsync();
                var adminId = await db.Users.Where(u => u.Email == AdminEmail).Select(u => u.Id).FirstAsync();
                foreach (var staffId in new[] { advisorId, adminId })
                {
                    (await db.Notifications.CountAsync(n => n.UserId == staffId && n.Type == "COMMISSION_OVERDUE_STAFF" && n.ReferenceId == first)).Should().Be(1);
                    (await db.Notifications.CountAsync(n => n.UserId == staffId && n.Type == "COMMISSION_OVERDUE_STAFF" && n.ReferenceId == second)).Should().Be(1);
                }
                (await db.Notifications.AnyAsync(n => n.Type == "COMMISSION_OVERDUE_STAFF" && n.ReferenceId == notYetDue)).Should().BeFalse();
            }
        }
        finally
        {
            await WaiveAsync(admin, first, second, notYetDue);
        }
    }

    // ---------- helpers ----------

    private sealed record OwnGarage(Guid GarageId, string Name, string Phone, Guid OwnerId, string OwnerEmail);

    /// <summary>A garage in the Arabian Sea, so no booking in any other test is ever sent to it.</summary>
    private async Task<OwnGarage> CreateGarageAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var phone = $"+91 9{Random.Shared.Next(1000, 9999)} {Random.Shared.Next(10000, 99999)}";
        // Listed in Hyderabad, where the demo advisor works, so the advisor sees its dues; matching goes by the pin.
        var garage = new Garage($"Dues Test Motors {suffix}", $"dues_{suffix}@garage.test", phone, "1 Test Road", 68.0, 12.0, city: "Hyderabad");
        db.Garages.Add(garage);

        var hash = scope.ServiceProvider.GetRequiredService<IPasswordHasher>().HashPassword(Password, out var salt);
        var ownerEmail = $"dues.owner.{suffix}@test.com";
        var owner = new User(ownerEmail, "Dues Test Owner", phone, hash, salt);
        db.Users.Add(owner);
        await db.SaveChangesAsync();

        var role = await db.Roles.FirstAsync(r => r.Name == AppRoles.GarageOwner);
        db.UserRoles.Add(new UserRole { UserId = owner.Id, RoleId = role.Id });
        db.GarageUsers.Add(new GarageUser(owner.Id, garage.Id, AppRoles.GarageOwner, "Owner"));
        await db.SaveChangesAsync();
        return new OwnGarage(garage.Id, garage.Name, phone, owner.Id, ownerEmail);
    }

    /// <summary>
    /// Bills the garage ₹500 (10% of ₹5,000) the way handover does, including the first notice.
    /// A commission needs a real job, so a fresh customer's package booking is assigned and its job is used.
    /// </summary>
    private async Task<Guid> BillGarageAsync(Guid garageId, DateTime dueAtUtc)
    {
        var (jobId, requestId) = await CreateJobAsync();
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var commission = new GarageCommission($"COM-T{Guid.NewGuid():N}"[..20], garageId, jobId, requestId, 5000m, 500m, 10m, dueAtUtc);
        commission.RecordReminder(DateTime.UtcNow);
        db.GarageCommissions.Add(commission);
        await db.SaveChangesAsync();
        return commission.Id;
    }

    private async Task<(Guid JobId, Guid RequestId)> CreateJobAsync()
    {
        var customer = await NewCustomerAsync();
        var vehicleId = await AddSwiftAsync(customer);
        var booking = new CreateServiceBookingRequest(vehicleId, "Plot 12, Road No. 2", "Banjara Hills", "Hyderabad", "Telangana", "500034", "India", 17.4126, 78.4482,
            ProblemDescription: "", ServiceCategory: null, PackageCode: "STANDARD");
        var res = await customer.PostAsJsonAsync("/api/v1/customer/requests", booking);
        res.StatusCode.Should().Be(HttpStatusCode.Created, await res.Content.ReadAsStringAsync());
        var request = (await res.Content.ReadFromJsonAsync<ApiResponse<ServiceRequestDetailDto>>(JsonOptions))!.Data!;

        var pay = await customer.PostAsJsonAsync($"/api/v1/customer/requests/{request.Id}/advance/pay", new InitiateAdvancePaymentRequest(null));
        pay.EnsureSuccessStatusCode();
        var checkout = (await pay.Content.ReadFromJsonAsync<ApiResponse<InitiatePaymentResponseDto>>(JsonOptions))!.Data!;
        (await customer.PostAsJsonAsync("/api/v1/customer/payments/verify",
            new VerifyPaymentRequestDto(checkout.PaymentId, $"pay_dues_{Guid.NewGuid():N}", "sig_fake_valid", checkout.GatewayOrderId)))
            .EnsureSuccessStatusCode();

        var advisor = await SignedInAsync(AdvisorEmail);
        var candidates = await advisor.GetFromJsonAsync<ApiResponse<List<PackageGarageCandidateDto>>>($"/api/v1/advisor/requests/{request.Id}/package-garages", JsonOptions);
        var garage = candidates!.Data!.First(g => !g.IsBlocked);
        var assign = await advisor.PostAsJsonAsync($"/api/v1/advisor/requests/{request.Id}/package-assignment", new AssignPackageGarageRequest(garage.GarageId, "Dues test"));
        assign.IsSuccessStatusCode.Should().BeTrue(await assign.Content.ReadAsStringAsync());
        var result = (await assign.Content.ReadFromJsonAsync<ApiResponse<PackageAssignmentResultDto>>(JsonOptions))!.Data!;
        return (result.ServiceJobId, request.Id);
    }

    private async Task<HttpClient> NewCustomerAsync()
    {
        var anon = _factory.CreateClient();
        var email = $"dues_cust_{Guid.NewGuid():N}@brocomod.com";
        (await anon.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest(email, Password, "Dues Test Customer", TestMobiles.New())))
            .EnsureSuccessStatusCode();
        return await SignedInAsync(email);
    }

    private static async Task<Guid> AddSwiftAsync(HttpClient customer)
    {
        var makes = await customer.GetFromJsonAsync<ApiResponse<List<VehicleManufacturerDto>>>("/api/v1/vehicle-manufacturers", JsonOptions);
        var maruti = makes!.Data!.Single(m => m.Name == "Maruti Suzuki");
        var models = await customer.GetFromJsonAsync<ApiResponse<List<VehicleModelDto>>>($"/api/v1/vehicle-manufacturers/{maruti.Id}/models", JsonOptions);
        var swift = models!.Data!.Single(m => m.Name == "Swift");
        var json = $$"""
        { "manufacturerId": "{{maruti.Id}}", "modelId": "{{swift.Id}}", "year": 2022, "fuelType": "Petrol",
          "transmission": "Manual", "licensePlate": "TS-11-{{Random.Shared.Next(1000, 9999)}}", "mileage": 18000, "color": "Red" }
        """;
        var res = await customer.PostAsync("/api/v1/customer/vehicles", new StringContent(json, Encoding.UTF8, "application/json"));
        res.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("data").GetProperty("id").GetGuid();
    }

    private async Task<HttpClient> SignedInAsync(string email)
    {
        var client = _factory.CreateClient();
        var res = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, Password));
        res.EnsureSuccessStatusCode();
        var body = await res.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body!.Data!.AccessToken);
        return client;
    }

    private static async Task<PagedResult<GarageCommissionDto>> GetDuesAsync(HttpClient client, string url)
    {
        var res = await client.GetAsync(url);
        res.StatusCode.Should().Be(HttpStatusCode.OK, await res.Content.ReadAsStringAsync());
        return (await res.Content.ReadFromJsonAsync<ApiResponse<PagedResult<GarageCommissionDto>>>(JsonOptions))!.Data!;
    }

    private async Task<GarageCommission> LoadAsync(Guid commissionId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await db.GarageCommissions.AsNoTracking().FirstAsync(c => c.Id == commissionId);
    }

    private async Task<int> GarageNotificationCountAsync(Guid userId, Guid? commissionId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await db.Notifications.CountAsync(n => n.UserId == userId && n.Type == "COMMISSION_DUE" &&
                                                      (commissionId == null || n.ReferenceId == commissionId));
    }

    private static async Task WaiveAsync(HttpClient admin, params Guid[] commissionIds)
    {
        foreach (var id in commissionIds)
        {
            (await admin.PostAsJsonAsync($"/api/v1/admin/commissions/{id}/waive", new WaiveCommissionRequest("Integration test clean-up")))
                .EnsureSuccessStatusCode();
        }
    }

    private static string Iso(DateTime utc) => Uri.EscapeDataString(utc.ToString("O"));
}
