using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using BroCoMod.Application.DTOs;
using BroCoMod.Domain.Enums;
using BroCoMod.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BroCoMod.IntegrationTests;

/// <summary>
/// Several quote-based services in one request, and "pay only after you accept the quote":
/// no payment can start for a quotation that isn't accepted, and the request advance is for packages only.
/// </summary>
public class MultiServiceBookingAndPayAfterQuoteIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private const string Password = "Password123!";
    private const string GarageEmail = "garage.owner@centralmetro.com";
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public MultiServiceBookingAndPayAfterQuoteIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    private async Task<HttpClient> SignInAsync(string email)
    {
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, Password));
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(JsonOptions);
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body!.Data!.AccessToken);
        return client;
    }

    /// <summary>A fresh customer with one car.</summary>
    private async Task<(HttpClient Customer, Guid VehicleId)> NewCustomerWithCarAsync()
    {
        var email = $"multi_svc_{Guid.NewGuid():N}@brocomod.com";
        (await _client.PostAsJsonAsync("/api/v1/auth/register",
            new RegisterRequest(email, Password, "Multi Service Customer", TestMobiles.New()))).EnsureSuccessStatusCode();
        var customer = await SignInAsync(email);

        var makes = await customer.GetFromJsonAsync<ApiResponse<IReadOnlyList<VehicleManufacturerDto>>>("/api/v1/vehicle-manufacturers", JsonOptions);
        var make = makes!.Data!.First();
        var models = await customer.GetFromJsonAsync<ApiResponse<IReadOnlyList<VehicleModelDto>>>($"/api/v1/vehicle-manufacturers/{make.Id}/models", JsonOptions);
        var model = models!.Data!.First(m => m.YearTo == null);

        var plate = $"TS-09-{Guid.NewGuid():N}"[..12].ToUpper();
        var added = await customer.PostAsJsonAsync("/api/v1/customer/vehicles", new CreateCustomerVehicleRequest(
            make.Id, model.Id, null, 2022, FuelType.Petrol, "Manual", plate, "", 20000, "White"));
        added.EnsureSuccessStatusCode();
        var vehicle = await added.Content.ReadFromJsonAsync<ApiResponse<CustomerVehicleDetailDto>>(JsonOptions);
        return (customer, vehicle!.Data!.Id);
    }

    private static CreateServiceBookingRequest Booking(Guid vehicleId, IReadOnlyList<string>? categories, string? packageCode = null) => new(
        VehicleId: vehicleId,
        AddressLine1: "12 Road No. 36, Jubilee Hills",
        AddressLine2: null,
        City: "Hyderabad",
        State: "Telangana",
        Pincode: "500034",
        Country: "India",
        Latitude: 17.4126,
        Longitude: 78.4482,
        ProblemDescription: packageCode == null ? "AC is not cooling and the battery is weak in the mornings." : "",
        ServiceCategory: null,
        PackageCode: packageCode,
        ServiceCategories: categories);

    private async Task<ServiceRequestDetailDto> CreateRequestAsync(HttpClient customer, CreateServiceBookingRequest booking)
    {
        var response = await customer.PostAsJsonAsync("/api/v1/customer/requests", booking);
        response.StatusCode.Should().Be(HttpStatusCode.Created, await response.Content.ReadAsStringAsync());
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<ServiceRequestDetailDto>>(JsonOptions);
        return body!.Data!;
    }

    [Fact]
    public async Task Customer_books_several_services_in_one_request_and_every_side_sees_all_of_them()
    {
        var (customer, vehicleId) = await NewCustomerWithCarAsync();

        // Mixed case and a duplicate: stored once each, in the canonical spelling, in the order picked.
        var created = await CreateRequestAsync(customer, Booking(vehicleId,
            new[] { "ac service & repair", "Batteries", "Tyres & Wheel Care", "Batteries" }));

        const string joined = "AC Service & Repair, Batteries, Tyres & Wheel Care";
        created.ServiceCategory.Should().Be(joined);
        created.ServiceCategories.Should().Equal("AC Service & Repair", "Batteries", "Tyres & Wheel Care");
        created.ServicePackageCode.Should().BeNull();

        var detail = await customer.GetFromJsonAsync<ApiResponse<ServiceRequestDetailDto>>($"/api/v1/customer/requests/{created.Id}", JsonOptions);
        detail!.Data!.ServiceCategories.Should().Equal("AC Service & Repair", "Batteries", "Tyres & Wheel Care");

        var list = await customer.GetFromJsonAsync<ApiResponse<PagedResult<CustomerServiceRequestSummaryDto>>>("/api/v1/customer/requests?page=1&pageSize=10", JsonOptions);
        list!.Data!.Items.Should().ContainSingle(r => r.Id == created.Id).Which.ServiceCategory.Should().Be(joined);

        // Quote-based: it went out to nearby garages, and the garage sees every selected service.
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var stored = await db.ServiceRequests.AsNoTracking().Include(r => r.GarageRequests).FirstAsync(r => r.Id == created.Id);
        stored.ServiceCategory.Should().Be(joined);
        stored.GarageRequests.Should().NotBeEmpty();

        var garageId = (await db.GarageUsers.Include(gu => gu.User).FirstAsync(gu => gu.User.Email == GarageEmail)).GarageId;
        var garageRequest = stored.GarageRequests.Single(gr => gr.GarageId == garageId);
        var garage = await SignInAsync(GarageEmail);
        var incoming = await garage.GetFromJsonAsync<ApiResponse<GarageIncomingRequestDetailDto>>($"/api/v1/garage/requests/{garageRequest.Id}", JsonOptions);
        incoming!.Data!.ServiceCategory.Should().Be(joined);

        // The garage notifications name the services too.
        var garageRequestIds = stored.GarageRequests.Select(gr => gr.Id).ToList();
        var notified = await db.Notifications.AsNoTracking()
            .Where(n => n.ReferenceId.HasValue && garageRequestIds.Contains(n.ReferenceId.Value) && n.Type == "GARAGE_REQUEST_DISPATCHED")
            .Select(n => n.Message)
            .ToListAsync();
        notified.Should().NotBeEmpty().And.OnlyContain(m => m.Contains($"Services: {joined}."));
    }

    [Fact]
    public async Task Unknown_or_too_many_services_and_package_with_services_are_rejected()
    {
        var (customer, vehicleId) = await NewCustomerWithCarAsync();

        var unknown = await customer.PostAsJsonAsync("/api/v1/customer/requests", Booking(vehicleId, new[] { "Batteries", "Rocket boosters" }));
        unknown.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await unknown.Content.ReadAsStringAsync()).Should().Contain("Rocket boosters");

        var nine = new[]
        {
            "AC Service & Repair", "Batteries", "Tyres & Wheel Care", "Denting & Painting", "Detailing & Car Spa",
            "Clutch & Body Parts", "Suspension & Fitments", "Windshields & Lights", "Insurance Claims",
        };
        var tooMany = await customer.PostAsJsonAsync("/api/v1/customer/requests", Booking(vehicleId, nine));
        tooMany.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // A fixed-price package keeps its own flow; quote-based services are booked separately.
        var withPackage = await customer.PostAsJsonAsync("/api/v1/customer/requests", Booking(vehicleId, new[] { "Batteries" }, packageCode: "BASIC"));
        withPackage.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var list = await customer.GetFromJsonAsync<ApiResponse<PagedResult<CustomerServiceRequestSummaryDto>>>("/api/v1/customer/requests?page=1&pageSize=10", JsonOptions);
        list!.Data!.TotalCount.Should().Be(0, "no rejected booking may leave a request behind");
    }

    [Fact]
    public async Task Quote_based_request_is_paid_only_after_the_customer_accepts_the_quotation()
    {
        var (customer, vehicleId) = await NewCustomerWithCarAsync();
        var request = await CreateRequestAsync(customer, Booking(vehicleId, new[] { "AC Service & Repair", "Batteries" }));

        // No request advance for a quote-based request: there is nothing to pay at booking.
        var earlyAdvance = await customer.PostAsJsonAsync($"/api/v1/customer/requests/{request.Id}/advance/pay", new InitiateAdvancePaymentRequest(null));
        earlyAdvance.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await earlyAdvance.Content.ReadAsStringAsync()).Should().Contain("after accepting the quote");

        // Garage quotes, advisor assigns it and sends the customer quotation.
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var garageId = (await db.GarageUsers.Include(gu => gu.User).FirstAsync(gu => gu.User.Email == GarageEmail)).GarageId;
        var garageRequest = await db.GarageRequests.AsNoTracking().FirstAsync(r => r.ServiceRequestId == request.Id && r.GarageId == garageId);

        var garage = await SignInAsync(GarageEmail);
        var draft = await garage.PostAsJsonAsync("/api/v1/garage/quotes/draft", new CreateGarageQuoteRequest(
            GarageRequestId: garageRequest.Id,
            Currency: "INR",
            EstimatedCompletionHours: 4,
            EstimatedCompletionDays: 1,
            ValidUntil: DateTime.UtcNow.AddDays(7),
            GarageRemarks: "AC gas refill and new battery.",
            LineItems: new List<CreateQuoteLineItemRequest>
            {
                new(QuoteLineType.Part, "AC gas refill", 1, 1800m, 18m, 0m, 1),
                new(QuoteLineType.Part, "Battery 35Ah", 1, 4200m, 18m, 0m, 2),
            }));
        draft.EnsureSuccessStatusCode();
        var garageQuoteId = (await draft.Content.ReadFromJsonAsync<ApiResponse<GarageQuoteDetailDto>>(JsonOptions))!.Data!.Id;
        (await garage.PostAsJsonAsync($"/api/v1/garage/quotes/{garageQuoteId}/submit", new SubmitGarageQuoteCommand())).EnsureSuccessStatusCode();

        var advisor = await SignInAsync("advisor@brocomod.com");
        (await advisor.PostAsJsonAsync($"/api/v1/advisor/requests/{request.Id}/assignment",
            new AssignGarageRequest(garageId, garageQuoteId, "Closest garage with the parts in stock."))).EnsureSuccessStatusCode();
        var cq = await advisor.PostAsJsonAsync($"/api/v1/advisor/requests/{request.Id}/customer-quotation", new CreateCustomerQuotationRequest(
            ScopeSummary: "AC gas refill and battery replacement",
            AdvisorRemarks: null,
            ValidUntilUtc: DateTime.UtcNow.AddDays(7),
            CustomerDiscount: 0m,
            Currency: "INR",
            LineItems: new List<CustomerQuotationLineItemInputDto>
            {
                new(QuoteLineType.Part, "AC gas refill", 1, 1800m, 18m, 0m, 1),
                new(QuoteLineType.Part, "Battery 35Ah", 1, 4200m, 18m, 0m, 2),
            }));
        cq.EnsureSuccessStatusCode();
        var quotationId = (await cq.Content.ReadFromJsonAsync<ApiResponse<CustomerQuotationDto>>(JsonOptions))!.Data!.Id;

        // Draft / ready: not even visible to the customer, and certainly not payable.
        var payDraft = await customer.PostAsJsonAsync("/api/v1/customer/payments/initiate", new InitiatePaymentRequestDto(quotationId));
        payDraft.IsSuccessStatusCode.Should().BeFalse();

        (await advisor.PostAsJsonAsync($"/api/v1/advisor/customer-quotations/{quotationId}/ready", new { })).EnsureSuccessStatusCode();
        (await advisor.PostAsJsonAsync($"/api/v1/advisor/customer-quotations/{quotationId}/send", new { })).EnsureSuccessStatusCode();

        // Sent but not accepted: both pay endpoints refuse with a clear message, and no payment is created.
        var payBeforeAccept = await customer.PostAsJsonAsync("/api/v1/customer/payments/initiate", new InitiatePaymentRequestDto(quotationId));
        payBeforeAccept.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await payBeforeAccept.Content.ReadAsStringAsync()).Should().Contain("Accept the quote first");

        var quickPayBeforeAccept = await customer.PostAsync($"/api/v1/customer/quotes/{quotationId}/pay", null);
        quickPayBeforeAccept.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        (await db.Payments.AsNoTracking().AnyAsync(p => p.CustomerQuotationId == quotationId)).Should().BeFalse();

        // Accepted: the 10% advance can now be paid.
        (await customer.PostAsJsonAsync($"/api/v1/customer/quotes/{quotationId}/accept", new AcceptQuotationRequest(CustomerRemarks: null)))
            .EnsureSuccessStatusCode();

        var pay = await customer.PostAsJsonAsync("/api/v1/customer/payments/initiate", new InitiatePaymentRequestDto(quotationId));
        pay.StatusCode.Should().Be(HttpStatusCode.OK, await pay.Content.ReadAsStringAsync());
        var checkout = (await pay.Content.ReadFromJsonAsync<ApiResponse<InitiatePaymentResponseDto>>(JsonOptions))!.Data!;
        checkout.Amount.Should().BeGreaterThan(0);

        // Still no request-level advance for a quote-based request, even after acceptance.
        var lateAdvance = await customer.PostAsJsonAsync($"/api/v1/customer/requests/{request.Id}/advance/pay", new InitiateAdvancePaymentRequest(null));
        lateAdvance.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Pickup_choice_is_stored_and_shown_to_customer_advisor_garage_and_admin()
    {
        var (customer, vehicleId) = await NewCustomerWithCarAsync();

        var created = await CreateRequestAsync(customer, Booking(vehicleId, new[] { "Batteries" }) with
        {
            NeedsPickup = true,
            PickupNotes = "  Gate 2, call before coming  ",
            PickupSlot = "Morning 9-12",
        });
        created.NeedsPickup.Should().BeTrue();
        created.PickupNotes.Should().Be("Gate 2, call before coming");
        created.PickupSlot.Should().Be("Morning 9-12");

        var detail = await customer.GetFromJsonAsync<ApiResponse<ServiceRequestDetailDto>>($"/api/v1/customer/requests/{created.Id}", JsonOptions);
        detail!.Data!.NeedsPickup.Should().BeTrue();
        detail.Data.PickupNotes.Should().Be("Gate 2, call before coming");
        detail.Data.PickupSlot.Should().Be("Morning 9-12");

        var advisor = await SignInAsync("advisor@brocomod.com");
        var advisorDetail = await advisor.GetFromJsonAsync<ApiResponse<AdvisorServiceRequestDetailDto>>($"/api/v1/advisor/requests/{created.Id}", JsonOptions);
        advisorDetail!.Data!.NeedsPickup.Should().BeTrue();
        advisorDetail.Data.PickupSlot.Should().Be("Morning 9-12");
        var comparison = await advisor.GetFromJsonAsync<ApiResponse<QuoteComparisonDto>>($"/api/v1/advisor/requests/{created.Id}/quotes", JsonOptions);
        comparison!.Data!.NeedsPickup.Should().BeTrue();
        comparison.Data.PickupNotes.Should().Be("Gate 2, call before coming");

        var admin = await SignInAsync("admin@brocomod.com");
        var adminDetail = await admin.GetFromJsonAsync<ApiResponse<AdminRequestOperationalDetailDto>>($"/api/v1/admin/requests/{created.Id}", JsonOptions);
        adminDetail!.Data!.NeedsPickup.Should().BeTrue();
        adminDetail.Data.PickupSlot.Should().Be("Morning 9-12");

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var stored = await db.ServiceRequests.AsNoTracking().Include(r => r.GarageRequests).FirstAsync(r => r.Id == created.Id);
        stored.NeedsPickup.Should().BeTrue();
        stored.PickupSummary.Should().Be("Yes, Morning 9-12 - Gate 2, call before coming");

        var garageId = (await db.GarageUsers.Include(gu => gu.User).FirstAsync(gu => gu.User.Email == GarageEmail)).GarageId;
        var garageRequest = stored.GarageRequests.Single(gr => gr.GarageId == garageId);
        var garage = await SignInAsync(GarageEmail);
        var incoming = await garage.GetFromJsonAsync<ApiResponse<GarageIncomingRequestDetailDto>>($"/api/v1/garage/requests/{garageRequest.Id}", JsonOptions);
        incoming!.Data!.NeedsPickup.Should().BeTrue();
        incoming.Data.PickupNotes.Should().Be("Gate 2, call before coming");
        incoming.Data.PickupSlot.Should().Be("Morning 9-12");

        // Garage and advisor notifications carry the choice.
        var garageRequestIds = stored.GarageRequests.Select(gr => gr.Id).ToList();
        var garageNotified = await db.Notifications.AsNoTracking()
            .Where(n => n.ReferenceId.HasValue && garageRequestIds.Contains(n.ReferenceId.Value) && n.Type == "GARAGE_REQUEST_DISPATCHED")
            .Select(n => n.Message)
            .ToListAsync();
        garageNotified.Should().NotBeEmpty().And.OnlyContain(m => m.Contains("Pick-up & drop: Yes, Morning 9-12 - Gate 2, call before coming."));
        var advisorNotified = await db.Notifications.AsNoTracking()
            .Where(n => n.ReferenceId == created.Id && n.Type == "SERVICE_REQUEST_CREATED")
            .Select(n => n.Message)
            .ToListAsync();
        advisorNotified.Should().NotBeEmpty().And.OnlyContain(m => m.Contains("Pick-up & drop: Yes, Morning 9-12 - Gate 2, call before coming."));

        // Driving in: notes and slot are dropped, and everyone sees "customer drives in".
        var driveIn = await CreateRequestAsync(customer, Booking(vehicleId, new[] { "AC Service & Repair" }) with
        {
            NeedsPickup = false,
            PickupNotes = "ignored",
            PickupSlot = "Evening 3-6",
        });
        driveIn.NeedsPickup.Should().BeFalse();
        driveIn.PickupNotes.Should().BeNull();
        driveIn.PickupSlot.Should().BeNull();
        var storedDriveIn = await db.ServiceRequests.AsNoTracking().FirstAsync(r => r.Id == driveIn.Id);
        storedDriveIn.PickupSummary.Should().Be("No, customer drives in");
    }

    [Fact]
    public async Task Pickup_notes_over_300_characters_are_rejected()
    {
        var (customer, vehicleId) = await NewCustomerWithCarAsync();

        var tooLong = await customer.PostAsJsonAsync("/api/v1/customer/requests", Booking(vehicleId, new[] { "Batteries" }) with
        {
            NeedsPickup = true,
            PickupNotes = new string('x', 301),
        });
        tooLong.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await tooLong.Content.ReadAsStringAsync()).Should().Contain("300");

        var longSlot = await customer.PostAsJsonAsync("/api/v1/customer/requests", Booking(vehicleId, new[] { "Batteries" }) with
        {
            NeedsPickup = true,
            PickupSlot = new string('s', 31),
        });
        longSlot.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // Exactly 300 is fine.
        var ok = await customer.PostAsJsonAsync("/api/v1/customer/requests", Booking(vehicleId, new[] { "Batteries" }) with
        {
            NeedsPickup = true,
            PickupNotes = new string('y', 300),
        });
        ok.StatusCode.Should().Be(HttpStatusCode.Created, await ok.Content.ReadAsStringAsync());

        var list = await customer.GetFromJsonAsync<ApiResponse<PagedResult<CustomerServiceRequestSummaryDto>>>("/api/v1/customer/requests?page=1&pageSize=10", JsonOptions);
        list!.Data!.TotalCount.Should().Be(1, "rejected bookings must not leave a request behind");
    }
}
