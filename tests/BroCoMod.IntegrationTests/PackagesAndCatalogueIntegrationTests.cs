using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using BroCoMod.Application.DTOs;
using BroCoMod.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BroCoMod.IntegrationTests;

/// <summary>
/// Basic / Standard / Premium packages: public prices per car, Hyderabad-only booking, the 10% advance,
/// advisor garage assignment, plus admin catalogue management and website enquiries.
/// </summary>
public class PackagesAndCatalogueIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public PackagesAndCatalogueIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    private async Task<HttpClient> SignedInAsync(string email, string password = "Password123!")
    {
        var client = _factory.CreateClient();
        var res = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, password));
        res.EnsureSuccessStatusCode();
        var body = await res.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body!.Data!.AccessToken);
        return client;
    }

    private async Task<(Guid MakeId, Guid ModelId)> SwiftAsync(HttpClient client)
    {
        var makes = await client.GetFromJsonAsync<ApiResponse<List<VehicleManufacturerDto>>>("/api/v1/vehicle-manufacturers", JsonOptions);
        var maruti = makes!.Data!.Single(m => m.Name == "Maruti Suzuki");
        var models = await client.GetFromJsonAsync<ApiResponse<List<VehicleModelDto>>>($"/api/v1/vehicle-manufacturers/{maruti.Id}/models", JsonOptions);
        var swift = models!.Data!.Single(m => m.Name == "Swift");
        return (maruti.Id, swift.Id);
    }

    private async Task<(HttpClient Client, Guid VehicleId, Guid ModelId)> NewCustomerWithSwiftAsync()
    {
        var anon = _factory.CreateClient();
        var email = $"pkg_{Guid.NewGuid():N}@brocomod.com";
        (await anon.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest(email, "Password123!", "Package Customer", "+91 90000 77777")))
            .EnsureSuccessStatusCode();
        var customer = await SignedInAsync(email);
        var (makeId, modelId) = await SwiftAsync(customer);

        var json = $$"""
        { "manufacturerId": "{{makeId}}", "modelId": "{{modelId}}", "year": 2022, "fuelType": "Petrol",
          "transmission": "Manual", "licensePlate": "TS-09-{{Random.Shared.Next(1000, 9999)}}", "mileage": 18000, "color": "Red" }
        """;
        var res = await customer.PostAsync("/api/v1/customer/vehicles", new StringContent(json, Encoding.UTF8, "application/json"));
        res.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        return (customer, doc.RootElement.GetProperty("data").GetProperty("id").GetGuid(), modelId);
    }

    private static CreateServiceBookingRequest Booking(Guid vehicleId, string? package, double lat = 17.4126, double lng = 78.4482, string pincode = "500034") =>
        new(vehicleId, "Plot 7, Road No. 3", "Banjara Hills", "Hyderabad", "Telangana", pincode, "India", lat, lng,
            ProblemDescription: package == null ? "AC not cooling" : "", ServiceCategory: package == null ? "AC Service & Repair" : null, PackageCode: package);

    [Fact]
    public async Task PublicCatalogue_ListsPopularBrandsWithLogos_PackagesAndPricesPerCar()
    {
        var anon = _factory.CreateClient();

        var areas = await anon.GetFromJsonAsync<ApiResponse<List<ServiceAreaDto>>>("/api/v1/service-areas", JsonOptions);
        areas!.Data.Should().ContainSingle(a => a.IsLive).Which.City.Should().Be("Hyderabad");

        var makes = await anon.GetFromJsonAsync<ApiResponse<List<VehicleManufacturerDto>>>("/api/v1/vehicle-manufacturers", JsonOptions);
        makes!.Data!.Count.Should().BeGreaterThan(30);
        makes.Data.Where(m => m.IsPopular).Should().Contain(m => m.Name == "Maruti Suzuki" && m.LogoUrl == "/brands/maruti-suzuki.svg");

        var packages = await anon.GetFromJsonAsync<ApiResponse<List<ServicePackageDto>>>("/api/v1/service-packages", JsonOptions);
        packages!.Data!.Select(p => p.Code).Should().ContainInOrder("BASIC", "STANDARD", "PREMIUM");

        var (_, swiftId) = await SwiftAsync(anon);
        var offers = await anon.GetFromJsonAsync<ApiResponse<PackageOffersResponse>>($"/api/v1/service-packages/offers?modelId={swiftId}&fuelType=Petrol", JsonOptions);
        offers!.Data!.Offers.Should().HaveCount(3).And.OnlyContain(o => o.Price > 0);
        var basic = offers.Data.Offers.Single(o => o.Package.Code == "BASIC");
        basic.AdvanceAmount.Should().Be(Math.Round(basic.Price!.Value * 0.10m, 0, MidpointRounding.AwayFromZero));
        basic.PayAtGarageAmount.Should().Be(basic.Price - basic.AdvanceAmount);
        offers.Data.Offers.Single(o => o.Package.Code == "PREMIUM").Price.Should().BeGreaterThan(basic.Price!.Value);
    }

    [Fact]
    public async Task Booking_OutsideHyderabad_OrWithNonHyderabadPincode_IsRejected()
    {
        var (customer, vehicleId, _) = await NewCustomerWithSwiftAsync();

        var bengaluru = await customer.PostAsJsonAsync("/api/v1/customer/requests", Booking(vehicleId, "BASIC", 12.9716, 77.5946, "560001"));
        bengaluru.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await bengaluru.Content.ReadAsStringAsync()).Should().Contain("Hyderabad");

        var wrongPincode = await customer.PostAsJsonAsync("/api/v1/customer/requests", Booking(vehicleId, "BASIC", pincode: "560001"));
        wrongPincode.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await wrongPincode.Content.ReadAsStringAsync()).Should().Contain("560001");
    }

    [Fact]
    public async Task PackageBooking_PaysAdvance_ThenAdvisorAssignsGarage_AndJobIsConfirmedAtTheFixedPrice()
    {
        var (customer, vehicleId, modelId) = await NewCustomerWithSwiftAsync();
        var offers = await customer.GetFromJsonAsync<ApiResponse<PackageOffersResponse>>($"/api/v1/service-packages/offers?modelId={modelId}&fuelType=Petrol", JsonOptions);
        var standard = offers!.Data!.Offers.Single(o => o.Package.Code == "STANDARD");

        // Book: price comes from the server, not the client
        var booking = await customer.PostAsJsonAsync("/api/v1/customer/requests", Booking(vehicleId, "STANDARD"));
        var raw = await booking.Content.ReadAsStringAsync();
        booking.IsSuccessStatusCode.Should().BeTrue(raw);
        var request = (await booking.Content.ReadFromJsonAsync<ApiResponse<ServiceRequestDetailDto>>(JsonOptions))!.Data!;
        request.ServicePackageCode.Should().Be("STANDARD");
        request.PackagePrice.Should().Be(standard.Price);
        request.AdvanceAmountDue.Should().Be(standard.AdvanceAmount);
        request.ServiceCategory.Should().Be("Periodic Service");

        // Advisor can't assign before the advance is paid
        var advisor = await SignedInAsync("advisor@brocomod.com");
        var candidates = await advisor.GetFromJsonAsync<ApiResponse<List<PackageGarageCandidateDto>>>($"/api/v1/advisor/requests/{request.Id}/package-garages", JsonOptions);
        var garage = candidates!.Data!.First(g => g.Name == "Central Metro Motors");
        var early = await advisor.PostAsJsonAsync($"/api/v1/advisor/requests/{request.Id}/package-assignment", new AssignPackageGarageRequest(garage.GarageId, null));
        early.IsSuccessStatusCode.Should().BeFalse();

        // Customer pays 10%
        var pay = await customer.PostAsJsonAsync($"/api/v1/customer/requests/{request.Id}/advance/pay", new InitiateAdvancePaymentRequest(null));
        pay.EnsureSuccessStatusCode();
        var payBody = (await pay.Content.ReadFromJsonAsync<ApiResponse<InitiatePaymentResponseDto>>(JsonOptions))!.Data!;
        payBody.Amount.Should().Be(standard.AdvanceAmount);
        (await customer.PostAsJsonAsync("/api/v1/customer/payments/verify",
            new VerifyPaymentRequestDto(payBody.PaymentId, $"pay_pkg_{Guid.NewGuid():N}", "sig_fake_valid", payBody.GatewayOrderId)))
            .EnsureSuccessStatusCode();

        // Advisor assigns -> job confirmed at the package price
        var assign = await advisor.PostAsJsonAsync($"/api/v1/advisor/requests/{request.Id}/package-assignment", new AssignPackageGarageRequest(garage.GarageId, "Closest workshop"));
        var assignRaw = await assign.Content.ReadAsStringAsync();
        assign.IsSuccessStatusCode.Should().BeTrue(assignRaw);
        var result = (await assign.Content.ReadFromJsonAsync<ApiResponse<PackageAssignmentResultDto>>(JsonOptions))!.Data!;
        result.JobNumber.Should().StartWith("JOB-");
        result.PackagePrice.Should().Be(standard.Price);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var quotation = await db.CustomerQuotations.AsNoTracking().FirstAsync(q => q.Id == result.CustomerQuotationId);
        quotation.CustomerTotal.Should().Be(standard.Price!.Value);
        quotation.Status.Should().Be(BroCoMod.Domain.Enums.CustomerQuotationStatus.Accepted);
        var advance = await db.Payments.AsNoTracking().FirstAsync(p => p.Id == payBody.PaymentId);
        advance.GarageId.Should().Be(garage.GarageId);
        advance.ServiceJobId.Should().Be(result.ServiceJobId);

        // Garage can start right away (advance already paid)
        var garageClient = await SignedInAsync("garage.owner@centralmetro.com");
        var receive = await garageClient.PostAsJsonAsync($"/api/v1/garage/jobs/{result.ServiceJobId}/receive", new ReceiveVehicleRequest(18000, "Package car"));
        receive.IsSuccessStatusCode.Should().BeTrue(await receive.Content.ReadAsStringAsync());

        // A second assignment is refused
        var again = await advisor.PostAsJsonAsync($"/api/v1/advisor/requests/{request.Id}/package-assignment", new AssignPackageGarageRequest(garage.GarageId, null));
        again.IsSuccessStatusCode.Should().BeFalse();
    }

    [Fact]
    public async Task Admin_AddsBrandWithLogo_AndModel_ThenSetsItsPrices()
    {
        var admin = await SignedInAsync("admin@brocomod.com");
        var name = $"Testmotors {Guid.NewGuid():N}"[..20];

        var created = await admin.PostAsJsonAsync("/api/v1/admin/catalogue/manufacturers", new UpsertManufacturerRequest(name, "India", 60, true, false));
        created.StatusCode.Should().Be(HttpStatusCode.Created);
        var brand = (await created.Content.ReadFromJsonAsync<ApiResponse<VehicleManufacturerDto>>(JsonOptions))!.Data!;

        var duplicate = await admin.PostAsJsonAsync("/api/v1/admin/catalogue/manufacturers", new UpsertManufacturerRequest(name.ToUpperInvariant(), "India", 61));
        duplicate.IsSuccessStatusCode.Should().BeFalse();

        // Logo upload (PNG header bytes are enough for the API)
        var png = new ByteArrayContent(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3 });
        png.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        var form = new MultipartFormDataContent { { png, "file", "logo.png" } };
        var upload = await admin.PostAsync($"/api/v1/admin/catalogue/manufacturers/{brand.Id}/logo", form);
        upload.EnsureSuccessStatusCode();
        var withLogo = (await upload.Content.ReadFromJsonAsync<ApiResponse<VehicleManufacturerDto>>(JsonOptions))!.Data!;
        withLogo.LogoUrl.Should().StartWith($"/api/v1/vehicle-manufacturers/{brand.Id}/logo");
        var logo = await _factory.CreateClient().GetAsync(withLogo.LogoUrl);
        logo.StatusCode.Should().Be(HttpStatusCode.OK);
        logo.Content.Headers.ContentType!.MediaType.Should().Be("image/png");

        // Scripted SVGs are refused
        var svg = new StringContent("<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>", Encoding.UTF8);
        svg.Headers.ContentType = new MediaTypeHeaderValue("image/svg+xml");
        var badUpload = await admin.PostAsync($"/api/v1/admin/catalogue/manufacturers/{brand.Id}/logo", new MultipartFormDataContent { { svg, "file", "logo.svg" } });
        badUpload.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // Model with segment + fuels
        var modelRes = await admin.PostAsJsonAsync($"/api/v1/admin/catalogue/manufacturers/{brand.Id}/models",
            new UpsertVehicleModelRequest("Zoom", "Hatchback", "Hatchback", new List<string> { "Petrol", "CNG" }, 2020, null));
        modelRes.StatusCode.Should().Be(HttpStatusCode.Created);
        var model = (await modelRes.Content.ReadFromJsonAsync<ApiResponse<VehicleModelDto>>(JsonOptions))!.Data!;
        model.Fuels.Should().BeEquivalentTo(new[] { "Petrol", "CNG" });

        // Prices
        var setPrices = await admin.PutAsJsonAsync($"/api/v1/admin/catalogue/models/{model.Id}/prices", new SetModelPricesRequest(new List<PackagePriceCellDto>
        {
            new("BASIC", "Petrol", 1999m), new("STANDARD", "Petrol", 2999m), new("PREMIUM", "Petrol", 4499m),
        }));
        setPrices.EnsureSuccessStatusCode();
        var offers = await _factory.CreateClient().GetFromJsonAsync<ApiResponse<PackageOffersResponse>>($"/api/v1/service-packages/offers?modelId={model.Id}&fuelType=Petrol", JsonOptions);
        offers!.Data!.Offers.Single(o => o.Package.Code == "STANDARD").Price.Should().Be(2999m);
        var cng = await _factory.CreateClient().GetFromJsonAsync<ApiResponse<PackageOffersResponse>>($"/api/v1/service-packages/offers?modelId={model.Id}&fuelType=CNG", JsonOptions);
        cng!.Data!.Offers.Should().OnlyContain(o => o.Price == null);

        // The public list picks the new brand up straight away (cache invalidated)
        var makes = await _factory.CreateClient().GetFromJsonAsync<ApiResponse<List<VehicleManufacturerDto>>>("/api/v1/vehicle-manufacturers", JsonOptions);
        makes!.Data.Should().Contain(m => m.Id == brand.Id);
    }

    [Fact]
    public async Task CatalogueAdministration_IsAdminOnly()
    {
        var customer = await SignedInAsync("customer@brocomod.com");
        var res = await customer.PostAsJsonAsync("/api/v1/admin/catalogue/manufacturers", new UpsertManufacturerRequest("Nope", "India", 1));
        res.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task WebsiteEnquiry_IsStored_ForTheAdminCallBackList()
    {
        var anon = _factory.CreateClient();
        var (_, swiftId) = await SwiftAsync(anon);
        var mobile = $"98{Random.Shared.Next(10000000, 99999999)}";

        var bad = await anon.PostAsJsonAsync("/api/v1/leads", new CreateLeadRequest("12345", "Hyderabad", swiftId, "Petrol", "STANDARD"));
        bad.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var ok = await anon.PostAsJsonAsync("/api/v1/leads", new CreateLeadRequest(mobile, "Hyderabad", swiftId, "Petrol", "STANDARD"));
        ok.EnsureSuccessStatusCode();

        var admin = await SignedInAsync("admin@brocomod.com");
        var leads = await admin.GetFromJsonAsync<ApiResponse<PagedResult<LeadDto>>>("/api/v1/admin/leads?pageSize=50", JsonOptions);
        var lead = leads!.Data!.Items.First(l => l.MobileNumber.EndsWith(mobile));
        lead.VehicleSummary.Should().Be("Maruti Suzuki Swift");
        lead.Status.Should().Be("New");

        var updated = await admin.PutAsJsonAsync($"/api/v1/admin/leads/{lead.Id}", new UpdateLeadRequest("Contacted", "Called, booking tomorrow"));
        updated.EnsureSuccessStatusCode();
    }
}
