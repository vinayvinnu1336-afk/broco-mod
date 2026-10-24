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
using BroCoMod.Domain.Enums;
using BroCoMod.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BroCoMod.IntegrationTests;

/// <summary>
/// The garage doing a job gets the customer's exact location (address, pin, distance from the workshop) and the
/// job's item list for sharing; garages that only quoted, and other garages, never do. Garage photos keep the
/// Before / After stage they were uploaded with, which the galleries group by.
/// Every test owns its booking at Central Metro and leaves it before handover (no commission).
/// </summary>
public class GarageJobLocationAndShareIntegrationTests : IClassFixture<MediaTestFactory>
{
    private const string Password = "Password123!";
    private const string CentralMetro = "Central Metro Motors";
    private const string CentralMetroOwner = "garage.owner@centralmetro.com";
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    private static readonly byte[] TinyPng = Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");

    private readonly MediaTestFactory _factory;

    public GarageJobLocationAndShareIntegrationTests(MediaTestFactory factory)
    {
        _factory = factory;
    }

    // ---------- helpers ----------

    private async Task<HttpClient> SignedInAsync(string email)
    {
        var client = _factory.CreateClient();
        var res = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, Password));
        res.EnsureSuccessStatusCode();
        var body = await res.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body!.Data!.AccessToken);
        return client;
    }

    private async Task<(HttpClient Customer, string Phone, Guid VehicleId)> NewCustomerWithCarAsync()
    {
        var anon = _factory.CreateClient();
        var email = $"garage_loc_{Guid.NewGuid():N}@brocomod.com";
        var phone = TestMobiles.New();
        (await anon.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest(email, Password, "Location Test Customer", phone)))
            .EnsureSuccessStatusCode();
        var customer = await SignedInAsync(email);

        var makes = await customer.GetFromJsonAsync<ApiResponse<List<VehicleManufacturerDto>>>("/api/v1/vehicle-manufacturers", JsonOptions);
        var maruti = makes!.Data!.Single(m => m.Name == "Maruti Suzuki");
        var models = await customer.GetFromJsonAsync<ApiResponse<List<VehicleModelDto>>>($"/api/v1/vehicle-manufacturers/{maruti.Id}/models", JsonOptions);
        var swift = models!.Data!.Single(m => m.Name == "Swift");
        var added = await customer.PostAsJsonAsync("/api/v1/customer/vehicles", new CreateCustomerVehicleRequest(
            maruti.Id, swift.Id, null, 2022, FuelType.Petrol, "Manual", $"TS-09-{Guid.NewGuid():N}"[..12].ToUpper(), "", 18000, "Red"));
        added.EnsureSuccessStatusCode();
        var vehicle = (await added.Content.ReadFromJsonAsync<ApiResponse<CustomerVehicleDetailDto>>(JsonOptions))!.Data!;
        return (customer, phone, vehicle.Id);
    }

    private static CreateServiceBookingRequest Booking(Guid vehicleId, string? packageCode, IReadOnlyList<string>? categories = null) => new(
        VehicleId: vehicleId,
        AddressLine1: "Plot 12, Road No. 2",
        AddressLine2: "Banjara Hills, Near GVK One",
        City: "Hyderabad",
        State: "Telangana",
        Pincode: "500034",
        Country: "India",
        Latitude: 17.4180,
        Longitude: 78.4500,
        ProblemDescription: packageCode == null ? "AC is not cooling." : "",
        ServiceCategory: null,
        PreferredServiceDate: DateTime.UtcNow.Date.AddDays(2),
        PackageCode: packageCode,
        ServiceCategories: categories,
        NeedsPickup: true,
        PickupNotes: "Gate 2, call on arrival",
        PickupSlot: "Afternoon 12-3");

    private async Task<ServiceRequestDetailDto> BookAsync(HttpClient customer, CreateServiceBookingRequest booking)
    {
        var res = await customer.PostAsJsonAsync("/api/v1/customer/requests", booking);
        res.StatusCode.Should().Be(HttpStatusCode.Created, await res.Content.ReadAsStringAsync());
        return (await res.Content.ReadFromJsonAsync<ApiResponse<ServiceRequestDetailDto>>(JsonOptions))!.Data!;
    }

    /// <summary>A paid STANDARD package booking the advisor assigned to Central Metro (so it has a job).</summary>
    private async Task<(HttpClient Customer, string Phone, Guid RequestId, Guid JobId)> PackageJobAtCentralMetroAsync()
    {
        var (customer, phone, vehicleId) = await NewCustomerWithCarAsync();
        var request = await BookAsync(customer, Booking(vehicleId, "STANDARD"));

        var pay = await customer.PostAsJsonAsync($"/api/v1/customer/requests/{request.Id}/advance/pay", new InitiateAdvancePaymentRequest(null));
        pay.EnsureSuccessStatusCode();
        var checkout = (await pay.Content.ReadFromJsonAsync<ApiResponse<InitiatePaymentResponseDto>>(JsonOptions))!.Data!;
        (await customer.PostAsJsonAsync("/api/v1/customer/payments/verify",
            new VerifyPaymentRequestDto(checkout.PaymentId, $"pay_loc_{Guid.NewGuid():N}", "sig_fake_valid", checkout.GatewayOrderId)))
            .EnsureSuccessStatusCode();

        var advisor = await SignedInAsync("advisor@brocomod.com");
        var candidates = await advisor.GetFromJsonAsync<ApiResponse<List<PackageGarageCandidateDto>>>($"/api/v1/advisor/requests/{request.Id}/package-garages", JsonOptions);
        var garage = candidates!.Data!.First(g => g.Name == CentralMetro);
        var assign = await advisor.PostAsJsonAsync($"/api/v1/advisor/requests/{request.Id}/package-assignment", new AssignPackageGarageRequest(garage.GarageId, "Nearest"));
        assign.IsSuccessStatusCode.Should().BeTrue(await assign.Content.ReadAsStringAsync());
        var result = (await assign.Content.ReadFromJsonAsync<ApiResponse<PackageAssignmentResultDto>>(JsonOptions))!.Data!;
        return (customer, phone, request.Id, result.ServiceJobId);
    }

    /// <summary>A garage owner at a test-only garage far from every service area, so no booking is ever sent to it.</summary>
    private async Task<HttpClient> OtherGarageOwnerAsync()
    {
        var email = $"loc_other_garage_{Guid.NewGuid():N}@garage.com";
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var garage = new Garage("Location Test Other Garage", "other@location-test.garage", "+91 91111 55555", "Test only", 70.0, 5.0);
            db.Garages.Add(garage);
            var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
            var hash = hasher.HashPassword(Password, out var salt);
            var user = new User(email, "Other Garage Owner", "+91 91111 55556", hash, salt);
            db.Users.Add(user);
            await db.SaveChangesAsync();

            var role = await db.Roles.FirstAsync(r => r.Name == AppRoles.GarageOwner);
            db.UserRoles.Add(new BroCoMod.Domain.Entities.Identity.UserRole { UserId = user.Id, RoleId = role.Id });
            db.GarageUsers.Add(new GarageUser(user.Id, garage.Id, AppRoles.GarageOwner, "Owner"));
            await db.SaveChangesAsync();
        }
        return await SignedInAsync(email);
    }

    private static async Task<T> DataAsync<T>(HttpResponseMessage res)
    {
        res.StatusCode.Should().Be(HttpStatusCode.OK, await res.Content.ReadAsStringAsync());
        return (await res.Content.ReadFromJsonAsync<ApiResponse<T>>(JsonOptions))!.Data!;
    }

    private static MultipartFormDataContent PhotoForm(string fileName, string stage)
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(TinyPng);
        file.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        form.Add(file, "file", fileName);
        form.Add(new StringContent(stage), "stage");
        return form;
    }

    // ---------- tests ----------

    [Fact]
    public async Task Assigned_garage_gets_the_customer_location_and_package_items_and_other_garages_get_nothing()
    {
        var (_, phone, _, jobId) = await PackageJobAtCentralMetroAsync();
        var garage = await SignedInAsync(CentralMetroOwner);

        var job = await DataAsync<GarageServiceJobDetailDto>(await garage.GetAsync($"/api/v1/garage/jobs/{jobId}"));

        job.CustomerLocation.Should().NotBeNull();
        var location = job.CustomerLocation!;
        location.AddressLine1.Should().Be("Plot 12, Road No. 2");
        location.AddressLine2.Should().Be("Banjara Hills, Near GVK One");
        location.City.Should().Be("Hyderabad");
        location.Pincode.Should().Be("500034");
        location.Latitude.Should().BeApproximately(17.4180, 0.0001);
        location.Longitude.Should().BeApproximately(78.4500, 0.0001);
        // Central Metro's seeded pin is 17.4126, 78.4482: about 0.6 km away.
        location.WorkshopLatitude.Should().NotBeNull();
        location.WorkshopLongitude.Should().NotBeNull();
        location.DistanceKm.Should().NotBeNull();
        location.DistanceKm!.Value.Should().BeInRange(0.1, 5);

        job.CustomerPhone.Should().Be(phone);
        job.NeedsPickup.Should().BeTrue();
        job.PickupSlot.Should().Be("Afternoon 12-3");
        job.PickupNotes.Should().Be("Gate 2, call on arrival");
        job.PreferredServiceDate.Should().NotBeNull();
        job.VehicleFuel.Should().Be("Petrol");
        job.ServiceValue.Should().BeGreaterThan(0);

        // Package jobs list the catalogue items of the package (what the share text puts on "* item" lines).
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var includes = await db.ServicePackages.AsNoTracking().Where(p => p.Code == "STANDARD").Select(p => p.Includes).SingleAsync();
            job.ServiceItems.Should().Equal(includes);
        }

        // Another garage can't open the job at all.
        var otherGarage = await OtherGarageOwnerAsync();
        var other = await otherGarage.GetAsync($"/api/v1/garage/jobs/{jobId}");
        other.StatusCode.Should().BeOneOf(HttpStatusCode.Forbidden, HttpStatusCode.NotFound);
        (await other.Content.ReadAsStringAsync()).Should().NotContain("Plot 12").And.NotContain(phone);
    }

    [Fact]
    public async Task Quoting_garage_sees_only_the_area_until_the_customer_pays_the_advance_then_the_request_and_job_show_the_location()
    {
        var (customer, phone, vehicleId) = await NewCustomerWithCarAsync();
        var request = await BookAsync(customer, Booking(vehicleId, packageCode: null, categories: new[] { "AC Service & Repair" }));

        Guid garageId, garageRequestId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            garageId = (await db.GarageUsers.Include(gu => gu.User).FirstAsync(gu => gu.User.Email == CentralMetroOwner)).GarageId;
            garageRequestId = (await db.GarageRequests.AsNoTracking().FirstAsync(r => r.ServiceRequestId == request.Id && r.GarageId == garageId)).Id;
        }

        // While quoting: area and distance only, no address, no contact.
        var garage = await SignedInAsync(CentralMetroOwner);
        var beforeRes = await garage.GetAsync($"/api/v1/garage/requests/{garageRequestId}");
        var beforeJson = await beforeRes.Content.ReadAsStringAsync();
        var before = await DataAsync<GarageIncomingRequestDetailDto>(beforeRes);
        before.ServiceJobId.Should().BeNull();
        before.CustomerLocation.Should().BeNull();
        before.CustomerName.Should().BeNull();
        before.CustomerPhone.Should().BeNull();
        beforeJson.Should().NotContain("Plot 12").And.NotContain(phone);

        // Quote -> advisor assigns and sends the quotation -> customer accepts (this creates the job).
        var draft = await garage.PostAsJsonAsync("/api/v1/garage/quotes/draft", new CreateGarageQuoteRequest(
            GarageRequestId: garageRequestId,
            Currency: "INR",
            EstimatedCompletionHours: 3,
            EstimatedCompletionDays: 1,
            ValidUntil: DateTime.UtcNow.AddDays(7),
            GarageRemarks: "Gas refill and filter.",
            LineItems: new List<CreateQuoteLineItemRequest>
            {
                new(QuoteLineType.Service, "AC gas refill", 1, 1800m, 0m, 1),
                new(QuoteLineType.Part, "Cabin filter", 1, 600m, 0m, 2),
            }));
        draft.EnsureSuccessStatusCode();
        var garageQuoteId = (await draft.Content.ReadFromJsonAsync<ApiResponse<GarageQuoteDetailDto>>(JsonOptions))!.Data!.Id;
        (await garage.PostAsJsonAsync($"/api/v1/garage/quotes/{garageQuoteId}/submit", new SubmitGarageQuoteCommand())).EnsureSuccessStatusCode();

        var advisor = await SignedInAsync("advisor@brocomod.com");
        (await advisor.PostAsJsonAsync($"/api/v1/advisor/requests/{request.Id}/assignment",
            new AssignGarageRequest(garageId, garageQuoteId, "Closest garage."))).EnsureSuccessStatusCode();
        var cq = await advisor.PostAsJsonAsync($"/api/v1/advisor/requests/{request.Id}/customer-quotation", new CreateCustomerQuotationRequest(
            ScopeSummary: "AC gas refill and cabin filter",
            AdvisorRemarks: null,
            ValidUntilUtc: DateTime.UtcNow.AddDays(7),
            CustomerDiscount: 0m,
            Currency: "INR",
            LineItems: new List<CustomerQuotationLineItemInputDto>
            {
                new(QuoteLineType.Service, "AC gas refill", 1, 1800m, 0m, 1),
                new(QuoteLineType.Part, "Cabin filter", 1, 600m, 0m, 2),
            }));
        cq.EnsureSuccessStatusCode();
        var quotationId = (await cq.Content.ReadFromJsonAsync<ApiResponse<CustomerQuotationDto>>(JsonOptions))!.Data!.Id;
        (await advisor.PostAsJsonAsync($"/api/v1/advisor/customer-quotations/{quotationId}/ready", new { })).EnsureSuccessStatusCode();
        (await advisor.PostAsJsonAsync($"/api/v1/advisor/customer-quotations/{quotationId}/send", new { })).EnsureSuccessStatusCode();
        (await customer.PostAsJsonAsync($"/api/v1/customer/quotes/{quotationId}/accept", new AcceptQuotationRequest(CustomerRemarks: null)))
            .EnsureSuccessStatusCode();

        // The garage now holds the job, but until the 10% advance is paid it still gets no address or contact.
        var accepted = await garage.GetAsync($"/api/v1/garage/requests/{garageRequestId}");
        var acceptedJson = await accepted.Content.ReadAsStringAsync();
        var unpaid = await DataAsync<GarageIncomingRequestDetailDto>(accepted);
        unpaid.ServiceJobId.Should().NotBeNull();
        unpaid.CustomerLocation.Should().BeNull();
        unpaid.CustomerName.Should().BeNull();
        unpaid.CustomerPhone.Should().BeNull();
        acceptedJson.Should().NotContain("Plot 12").And.NotContain(phone);
        var unpaidJob = await DataAsync<GarageServiceJobDetailDto>(await garage.GetAsync($"/api/v1/garage/jobs/{unpaid.ServiceJobId}"));
        unpaidJob.CustomerLocation.Should().BeNull();
        unpaidJob.CustomerPhone.Should().BeEmpty();
        unpaidJob.CustomerName.Should().Be("Customer");

        // A quote booking's 10% advance is paid against the accepted quotation.
        var pay = await customer.PostAsJsonAsync("/api/v1/customer/payments/initiate", new InitiatePaymentRequestDto(quotationId));
        pay.EnsureSuccessStatusCode();
        var checkout = (await pay.Content.ReadFromJsonAsync<ApiResponse<InitiatePaymentResponseDto>>(JsonOptions))!.Data!;
        (await customer.PostAsJsonAsync("/api/v1/customer/payments/verify",
            new VerifyPaymentRequestDto(checkout.PaymentId, $"pay_loc_{Guid.NewGuid():N}", "sig_fake_valid", checkout.GatewayOrderId)))
            .EnsureSuccessStatusCode();

        // Advance paid: the request sheet links to the job and shows where the car is and who to call.
        var after = await DataAsync<GarageIncomingRequestDetailDto>(await garage.GetAsync($"/api/v1/garage/requests/{garageRequestId}"));
        after.ServiceJobId.Should().NotBeNull();
        after.ServiceJobNumber.Should().NotBeNullOrEmpty();
        after.CustomerLocation.Should().NotBeNull();
        after.CustomerLocation!.AddressLine1.Should().Be("Plot 12, Road No. 2");
        after.CustomerLocation.DistanceKm.Should().NotBeNull();
        after.CustomerPhone.Should().Be(phone);
        after.CustomerName.Should().Be("Location Test Customer");

        // The job lists the quotation's lines as its items.
        var job = await DataAsync<GarageServiceJobDetailDto>(await garage.GetAsync($"/api/v1/garage/jobs/{after.ServiceJobId}"));
        job.ServiceItems.Should().Equal("AC gas refill", "Cabin filter");
        job.CustomerLocation!.Pincode.Should().Be("500034");
        job.ServiceCategory.Should().Be("AC Service & Repair");

        var otherGarage = await OtherGarageOwnerAsync();
        (await otherGarage.GetAsync($"/api/v1/garage/jobs/{after.ServiceJobId}")).StatusCode
            .Should().BeOneOf(HttpStatusCode.Forbidden, HttpStatusCode.NotFound);
        (await otherGarage.GetAsync($"/api/v1/garage/requests/{garageRequestId}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Garage_photos_keep_their_before_and_after_stage_for_the_grouped_gallery()
    {
        var (customer, _, requestId, jobId) = await PackageJobAtCentralMetroAsync();
        var garage = await SignedInAsync(CentralMetroOwner);

        foreach (var (name, stage) in new[] { ("b1.png", "Before"), ("b2.png", "before"), ("a1.png", "After"), ("i1.png", "Inspection") })
        {
            var res = await garage.PostAsync($"/api/v1/media/jobs/{jobId}", PhotoForm(name, stage));
            res.StatusCode.Should().Be(HttpStatusCode.Created, await res.Content.ReadAsStringAsync());
        }

        var garageList = await DataAsync<ServiceMediaListDto>(await garage.GetAsync($"/api/v1/media/jobs/{jobId}"));
        garageList.Items.GroupBy(i => i.Stage).ToDictionary(g => g.Key, g => g.Count())
            .Should().BeEquivalentTo(new Dictionary<string, int> { ["Before"] = 2, ["After"] = 1, ["Inspection"] = 1 });

        // Advisors and the customer get the same stages on the request (what their galleries group by).
        var advisor = await SignedInAsync("advisor@brocomod.com");
        var advisorList = await DataAsync<ServiceMediaListDto>(await advisor.GetAsync($"/api/v1/media/requests/{requestId}"));
        advisorList.Items.Count(i => i.Stage == "Before").Should().Be(2);
        advisorList.Items.Count(i => i.Stage == "After").Should().Be(1);
        var customerList = await DataAsync<ServiceMediaListDto>(await customer.GetAsync($"/api/v1/media/requests/{requestId}"));
        customerList.Items.Select(i => i.Stage).Should().BeEquivalentTo(new[] { "Before", "Before", "After", "Inspection" });

        // Moving a photo between groups is a stage edit (advisors and admins edit).
        var after = advisorList.Items.Single(i => i.Stage == "After");
        var patch = await advisor.PatchAsJsonAsync($"/api/v1/media/{after.Id}", new { stage = "Before" });
        (await DataAsync<ServiceMediaDto>(patch)).Stage.Should().Be("Before");
    }
}
