using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using BroCoMod.Application.DTOs;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace BroCoMod.IntegrationTests;

/// <summary>
/// Filters on the staff list screens (search, status, date range, service type, city ...) are applied by the
/// API before paging, and bad filter input is a 400. Each test books its own requests for a new customer and
/// narrows every list to them with a search, so other tests' data never changes the counts.
/// </summary>
public class ListFiltersIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private const string CentralMetro = "Central Metro Motors";
    private const string CentralMetroOwner = "garage.owner@centralmetro.com";

    private readonly WebApplicationFactory<Program> _factory;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public ListFiltersIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    // ---------- helpers ----------

    private sealed record Customer(HttpClient Client, string Email, string MobileDigits, Guid VehicleId, string Plate);

    private async Task<HttpClient> SignedInAsync(string email, string password = "Password123!")
    {
        var client = _factory.CreateClient();
        var res = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, password));
        res.EnsureSuccessStatusCode();
        var body = await res.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body!.Data!.AccessToken);
        return client;
    }

    private async Task<Customer> NewCustomerAsync()
    {
        var anon = _factory.CreateClient();
        var email = $"filters_{Guid.NewGuid():N}@brocomod.com";
        var mobile = $"9{Random.Shared.Next(100000000, 999999999)}";
        var phone = $"+91 {mobile[..5]} {mobile[5..]}";
        var register = await anon.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest(email, "Password123!", "Filter Test Customer", phone));
        register.IsSuccessStatusCode.Should().BeTrue(await register.Content.ReadAsStringAsync());
        var customer = await SignedInAsync(email);

        var makes = await customer.GetFromJsonAsync<ApiResponse<List<VehicleManufacturerDto>>>("/api/v1/vehicle-manufacturers", JsonOptions);
        var maruti = makes!.Data!.Single(m => m.Name == "Maruti Suzuki");
        var models = await customer.GetFromJsonAsync<ApiResponse<List<VehicleModelDto>>>($"/api/v1/vehicle-manufacturers/{maruti.Id}/models", JsonOptions);
        var swift = models!.Data!.Single(m => m.Name == "Swift");

        var plate = $"TS-11-FL-{Random.Shared.Next(1000, 9999)}";
        var json = $$"""
        { "manufacturerId": "{{maruti.Id}}", "modelId": "{{swift.Id}}", "year": 2021, "fuelType": "Petrol",
          "transmission": "Manual", "licensePlate": "{{plate}}", "mileage": 30000, "color": "Red" }
        """;
        var res = await customer.PostAsync("/api/v1/customer/vehicles", new StringContent(json, Encoding.UTF8, "application/json"));
        res.IsSuccessStatusCode.Should().BeTrue(await res.Content.ReadAsStringAsync());
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        return new Customer(customer, email, mobile, doc.RootElement.GetProperty("data").GetProperty("id").GetGuid(), plate);
    }

    /// <summary>Banjara Hills, Hyderabad, next to the demo garage Central Metro Motors.</summary>
    private static async Task<ServiceRequestDetailDto> BookAsync(Customer customer, string? package)
    {
        var booking = new CreateServiceBookingRequest(
            customer.VehicleId, "Plot 12, Road No. 2", "Banjara Hills", "Hyderabad", "Telangana", "500034", "India", 17.4126, 78.4482,
            ProblemDescription: package == null ? "Clutch slipping on slopes" : "",
            ServiceCategory: package == null ? "Clutch & Transmission" : null,
            PackageCode: package);
        var res = await customer.Client.PostAsJsonAsync("/api/v1/customer/requests", booking);
        var raw = await res.Content.ReadAsStringAsync();
        res.StatusCode.Should().Be(HttpStatusCode.Created, raw);
        return (await res.Content.ReadFromJsonAsync<ApiResponse<ServiceRequestDetailDto>>(JsonOptions))!.Data!;
    }

    private static async Task PayAdvanceAsync(HttpClient customer, Guid requestId)
    {
        var pay = await customer.PostAsJsonAsync($"/api/v1/customer/requests/{requestId}/advance/pay", new InitiateAdvancePaymentRequest(null));
        pay.IsSuccessStatusCode.Should().BeTrue(await pay.Content.ReadAsStringAsync());
        var checkout = (await pay.Content.ReadFromJsonAsync<ApiResponse<InitiatePaymentResponseDto>>(JsonOptions))!.Data!;
        var verify = await customer.PostAsJsonAsync("/api/v1/customer/payments/verify",
            new VerifyPaymentRequestDto(checkout.PaymentId, $"pay_filters_{Guid.NewGuid():N}", "sig_fake_valid", checkout.GatewayOrderId));
        verify.IsSuccessStatusCode.Should().BeTrue(await verify.Content.ReadAsStringAsync());
    }

    /// <summary>Only BroCo cancels once the advance is paid, so tests tidy up through the admin cancel.</summary>
    private async Task CancelAsync(Customer customer, Guid requestId)
    {
        var admin = await SignedInAsync("admin@brocomod.com");
        (await admin.PostAsJsonAsync($"/api/v1/admin/requests/{requestId}/cancel", new AdminCancelBookingRequest("Test finished")))
            .EnsureSuccessStatusCode();
    }

    /// <summary>The list in `data` (a plain array, or `data.items` for a paged result).</summary>
    private static async Task<List<JsonElement>> ListAsync(HttpClient client, string url)
    {
        var res = await client.GetAsync(url);
        var raw = await res.Content.ReadAsStringAsync();
        res.StatusCode.Should().Be(HttpStatusCode.OK, $"{url} -> {raw}");
        using var doc = JsonDocument.Parse(raw);
        var data = doc.RootElement.GetProperty("data");
        var list = data.ValueKind == JsonValueKind.Array ? data : data.GetProperty("items");
        return list.EnumerateArray().Select(e => e.Clone()).ToList();
    }

    private static async Task<string> BadRequestAsync(HttpClient client, string url)
    {
        var res = await client.GetAsync(url);
        var raw = await res.Content.ReadAsStringAsync();
        res.StatusCode.Should().Be(HttpStatusCode.BadRequest, $"{url} -> {raw}");
        return raw;
    }

    private static string Iso(DateTime utc) => Uri.EscapeDataString(utc.ToString("O"));

    private static string Str(JsonElement e, string name) => e.GetProperty(name).GetString() ?? string.Empty;

    // ---------- tests ----------

    [Fact]
    public async Task AdminRequests_FilterByServiceTypeCategoryCityPhoneAndDate_AndRejectBadInput()
    {
        var customer = await NewCustomerAsync();
        var package = await BookAsync(customer, "STANDARD");
        var repair = await BookAsync(customer, null);
        var admin = await SignedInAsync("admin@brocomod.com");
        var mine = $"/api/v1/admin/requests?pageSize=100&search={Uri.EscapeDataString(customer.Email)}";

        try
        {
            (await ListAsync(admin, mine)).Select(r => Str(r, "requestNumber"))
                .Should().BeEquivalentTo(new[] { package.RequestNumber, repair.RequestNumber });

            (await ListAsync(admin, $"{mine}&serviceType=package")).Select(r => Str(r, "requestNumber"))
                .Should().Equal(package.RequestNumber);
            (await ListAsync(admin, $"{mine}&serviceType=quote")).Select(r => Str(r, "requestNumber"))
                .Should().Equal(repair.RequestNumber);
            (await ListAsync(admin, $"{mine}&category=clutch")).Select(r => Str(r, "requestNumber"))
                .Should().Equal(repair.RequestNumber);

            (await ListAsync(admin, $"{mine}&city=hyderabad")).Should().HaveCount(2);
            (await ListAsync(admin, $"{mine}&city=Mumbai")).Should().BeEmpty();

            var now = DateTime.UtcNow;
            (await ListAsync(admin, $"{mine}&fromDateUtc={Iso(now.AddHours(-1))}&toDateUtc={Iso(now.AddHours(1))}")).Should().HaveCount(2);
            (await ListAsync(admin, $"{mine}&fromDateUtc={Iso(now.AddHours(1))}")).Should().BeEmpty();
            (await ListAsync(admin, $"{mine}&toDateUtc={Iso(now.AddDays(-1))}")).Should().BeEmpty();

            // The customer's mobile number without spaces or +91, and the number plate, find the same requests
            (await ListAsync(admin, $"/api/v1/admin/requests?pageSize=100&search={customer.MobileDigits}")).Should().HaveCount(2);
            (await ListAsync(admin, $"/api/v1/admin/requests?pageSize=100&search={Uri.EscapeDataString(customer.Plate)}&serviceType=quote"))
                .Select(r => Str(r, "requestNumber")).Should().Equal(repair.RequestNumber);

            (await BadRequestAsync(admin, $"{mine}&serviceType=bike")).Should().Contain("not a valid service type");
            (await BadRequestAsync(admin, $"{mine}&fromDateUtc={Iso(now)}&toDateUtc={Iso(now.AddDays(-2))}")).Should().Contain("start date");
            (await BadRequestAsync(admin, $"{mine}&fromDateUtc={Iso(now.AddDays(-400))}&toDateUtc={Iso(now)}")).Should().Contain("366 days");
            await BadRequestAsync(admin, $"/api/v1/admin/requests?search={new string('x', 101)}");
        }
        finally
        {
            await CancelAsync(customer, package.Id);
            await CancelAsync(customer, repair.Id);
        }
    }

    [Fact]
    public async Task AdvisorRequests_FilterBySearchStatusAndServiceType()
    {
        var customer = await NewCustomerAsync();
        var package = await BookAsync(customer, "BASIC");
        var repair = await BookAsync(customer, null);
        await CancelAsync(customer, repair.Id);
        var advisor = await SignedInAsync("advisor@brocomod.com");
        var mine = $"/api/v1/advisor/requests?pageSize=50&search={Uri.EscapeDataString(customer.Email)}";

        try
        {
            (await ListAsync(advisor, mine)).Should().HaveCount(2);
            (await ListAsync(advisor, $"{mine}&serviceType=package")).Select(r => Str(r, "requestNumber")).Should().Equal(package.RequestNumber);

            // Status as the enum name or as the list shows it
            (await ListAsync(advisor, $"{mine}&status=Cancelled")).Select(r => Str(r, "requestNumber")).Should().Equal(repair.RequestNumber);
            var cancelled = await ListAsync(advisor, $"{mine}&status=CANCELLED");
            cancelled.Select(r => Str(r, "status")).Should().Equal("CANCELLED");
            (await ListAsync(advisor, $"{mine}&status=Cancelled&serviceType=package")).Should().BeEmpty();

            (await ListAsync(advisor, $"{mine}&city=Hyderabad&fromDateUtc={Iso(DateTime.UtcNow.AddMinutes(-30))}")).Should().HaveCount(2);
            (await ListAsync(advisor, $"{mine}&fromDateUtc={Iso(DateTime.UtcNow.AddHours(1))}")).Should().BeEmpty();

            (await BadRequestAsync(advisor, $"{mine}&status=Lost")).Should().Contain("not a valid request status");
            await BadRequestAsync(advisor, $"{mine}&status=12");
        }
        finally
        {
            await CancelAsync(customer, package.Id);
        }
    }

    [Fact]
    public async Task GarageRequests_FilterBySearchStatusAndDate()
    {
        var customer = await NewCustomerAsync();
        var repair = await BookAsync(customer, null);
        var garage = await SignedInAsync(CentralMetroOwner);
        var mine = $"/api/v1/garage/requests?pageSize=50&search={Uri.EscapeDataString(repair.RequestNumber)}";

        try
        {
            var rows = await ListAsync(garage, mine);
            rows.Should().ContainSingle("the repair went to Central Metro, next door");
            var status = Str(rows[0], "status");

            (await ListAsync(garage, $"{mine}&status={status}")).Should().ContainSingle();
            (await ListAsync(garage, $"{mine}&status={(status == "DECLINED" ? "Expired" : "Declined")}")).Should().BeEmpty();
            (await ListAsync(garage, $"{mine}&fromDateUtc={Iso(DateTime.UtcNow.AddMinutes(-30))}&toDateUtc={Iso(DateTime.UtcNow.AddMinutes(5))}"))
                .Should().ContainSingle();
            (await ListAsync(garage, $"{mine}&toDateUtc={Iso(DateTime.UtcNow.AddDays(-1))}")).Should().BeEmpty();

            // Garages don't see customer details, so the customer's email finds nothing
            (await ListAsync(garage, $"/api/v1/garage/requests?pageSize=50&search={Uri.EscapeDataString(customer.Email)}")).Should().BeEmpty();
            // The car's number plate does
            (await ListAsync(garage, $"/api/v1/garage/requests?pageSize=50&search={Uri.EscapeDataString(customer.Plate)}"))
                .Select(r => Str(r, "requestNumber")).Should().Equal(repair.RequestNumber);

            (await BadRequestAsync(garage, $"{mine}&status=Maybe")).Should().Contain("not a valid request status");
        }
        finally
        {
            await CancelAsync(customer, repair.Id);
        }
    }

    [Fact]
    public async Task PaidAndAssignedPackage_ShowsInFilteredPaymentAndJobLists()
    {
        var customer = await NewCustomerAsync();
        var request = await BookAsync(customer, "STANDARD");
        await PayAdvanceAsync(customer.Client, request.Id);
        var admin = await SignedInAsync("admin@brocomod.com");

        // ----- Admin payments -----
        var payments = $"/api/v1/admin/finance/payments?pageSize=100&search={Uri.EscapeDataString(request.RequestNumber)}";
        var paid = await ListAsync(admin, payments);
        paid.Should().ContainSingle("the booking advance is the only payment for this request");
        var method = Str(paid[0], "paymentMethod");
        Str(paid[0], "purpose").Should().Be("BookingAdvance");

        (await ListAsync(admin, $"{payments}&purpose=BookingAdvance&status=Paid&method={method}")).Should().ContainSingle();
        (await ListAsync(admin, $"{payments}&purpose=booking_advance")).Should().ContainSingle();
        (await ListAsync(admin, $"{payments}&purpose=GarageCommission")).Should().BeEmpty();
        (await ListAsync(admin, $"{payments}&method={(method == "Upi" ? "Card" : "Upi")}")).Should().BeEmpty();
        (await ListAsync(admin, $"{payments}&fromDate={Iso(DateTime.UtcNow.AddHours(1))}")).Should().BeEmpty();
        (await ListAsync(admin, $"/api/v1/admin/finance/payments?pageSize=100&search={Uri.EscapeDataString(Str(paid[0], "paymentNumber"))}"))
            .Should().ContainSingle();
        (await BadRequestAsync(admin, $"{payments}&purpose=Tip")).Should().Contain("not a valid payment purpose");
        (await BadRequestAsync(admin, $"{payments}&method=Cash")).Should().Contain("not a valid payment method");

        // ----- Assign Central Metro: the booking becomes a job -----
        var advisor = await SignedInAsync("advisor@brocomod.com");
        var candidates = await ListAsync(advisor, $"/api/v1/advisor/requests/{request.Id}/package-garages");
        var garageId = candidates.First(g => Str(g, "name") == CentralMetro).GetProperty("garageId").GetGuid();
        var assign = await advisor.PostAsJsonAsync($"/api/v1/advisor/requests/{request.Id}/package-assignment", new AssignPackageGarageRequest(garageId, "Nearest"));
        assign.IsSuccessStatusCode.Should().BeTrue(await assign.Content.ReadAsStringAsync());

        // ----- Garage jobs -----
        var garage = await SignedInAsync(CentralMetroOwner);
        var garageJobs = $"/api/v1/garage/jobs?search={Uri.EscapeDataString(request.RequestNumber)}";
        var jobs = await ListAsync(garage, garageJobs);
        jobs.Should().ContainSingle();
        var jobNumber = Str(jobs[0], "jobNumber");
        (await ListAsync(garage, $"/api/v1/garage/jobs?search={Uri.EscapeDataString(customer.Plate)}")).Should().ContainSingle();
        (await ListAsync(garage, $"{garageJobs}&status=Closed")).Should().BeEmpty();
        (await ListAsync(garage, $"{garageJobs}&fromDateUtc={Iso(DateTime.UtcNow.AddMinutes(-30))}")).Should().ContainSingle();
        (await ListAsync(garage, $"{garageJobs}&fromDateUtc={Iso(DateTime.UtcNow.AddHours(1))}")).Should().BeEmpty();
        await BadRequestAsync(garage, $"{garageJobs}&fromDateUtc={Iso(DateTime.UtcNow)}&toDateUtc={Iso(DateTime.UtcNow.AddDays(-1))}");

        // ----- Advisor and admin job lists -----
        (await ListAsync(advisor, $"/api/v1/advisor/jobs?search={jobNumber}&garageId={garageId}")).Should().ContainSingle();
        (await ListAsync(advisor, $"/api/v1/advisor/jobs?search={jobNumber}&toDateUtc={Iso(DateTime.UtcNow.AddDays(-1))}")).Should().BeEmpty();

        var adminJobs = $"/api/v1/admin/jobs?search={jobNumber}";
        (await ListAsync(admin, $"{adminJobs}&serviceType=package&garageId={garageId}")).Should().ContainSingle();
        (await ListAsync(admin, $"{adminJobs}&serviceType=quote")).Should().BeEmpty();
        (await ListAsync(admin, $"{adminJobs}&fromDateUtc={Iso(DateTime.UtcNow.AddHours(1))}")).Should().BeEmpty();
        (await ListAsync(admin, $"/api/v1/admin/jobs?search={customer.MobileDigits}")).Should().ContainSingle();

        // The job is left before handover, so no BroCo commission is created by this test.
    }

    [Fact]
    public async Task AdminLists_RejectUnknownFilterValues_AndGarageCityMatchesTheAddress()
    {
        var admin = await SignedInAsync("admin@brocomod.com");

        (await BadRequestAsync(admin, "/api/v1/admin/garages?dues=sometimes")).Should().Contain("not a valid dues filter");
        await BadRequestAsync(admin, "/api/v1/admin/assignments?status=Lost");
        await BadRequestAsync(admin, "/api/v1/admin/customer-quotations?status=Lost");
        await BadRequestAsync(admin, "/api/v1/admin/finance/ledger?entryType=Lost");

        var central = Uri.EscapeDataString(CentralMetro);
        (await ListAsync(admin, $"/api/v1/admin/garages?search={central}&city=Hyderabad")).Select(g => Str(g, "name")).Should().Contain(CentralMetro);
        (await ListAsync(admin, $"/api/v1/admin/garages?search={central}&city=Mumbai")).Should().BeEmpty();

        // Every garage either owes commission or doesn't
        var all = (await ListAsync(admin, "/api/v1/admin/garages?pageSize=100")).Select(g => Str(g, "id")).ToHashSet();
        var owing = (await ListAsync(admin, "/api/v1/admin/garages?pageSize=100&dues=any")).Select(g => Str(g, "id")).ToList();
        var clear = (await ListAsync(admin, "/api/v1/admin/garages?pageSize=100&dues=none")).Select(g => Str(g, "id")).ToList();
        owing.Should().NotIntersectWith(clear);
        owing.Concat(clear).Should().OnlyContain(id => all.Contains(id));
        clear.Should().NotBeEmpty();
    }
}
