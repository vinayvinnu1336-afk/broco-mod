using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using BroCoMod.Application.DTOs;
using BroCoMod.Domain.Constants;
using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Enums;
using BroCoMod.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BroCoMod.IntegrationTests;

public class CustomerDecisionIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public CustomerDecisionIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    private async Task<string> AuthenticateAsync(string email, string password)
    {
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, password));
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(JsonOptions);
        body.Should().NotBeNull();
        body!.Data.Should().NotBeNull();
        return body.Data!.AccessToken;
    }

    private HttpClient CreateAuthenticatedClient(string token)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    // Helper: Orchestrates complete pipeline from Customer Request -> Garage Quote -> Advisor Assignment -> Customer Quotation Sent
    private async Task<(Guid ServiceRequestId, Guid GarageId, Guid GarageQuoteId, Guid CustomerQuotationId, string CustomerToken, string CustomerEmail)> CreateSentCustomerQuotationAsync()
    {
        // 1. Customer registration & vehicle creation
        var custEmail = $"decision_cust_{Guid.NewGuid():N}@brocomod.com";
        var regResponse = await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest(
            custEmail,
            "Password123!",
            "Decision Test Customer",
            "+91 97777 66666"));
        regResponse.EnsureSuccessStatusCode();

        var custToken = await AuthenticateAsync(custEmail, "Password123!");
        var customerClient = CreateAuthenticatedClient(custToken);

        var mResponse = await customerClient.GetAsync("/api/v1/vehicle-manufacturers");
        var mBody = await mResponse.Content.ReadFromJsonAsync<ApiResponse<IReadOnlyList<VehicleManufacturerDto>>>(JsonOptions);
        var make = mBody!.Data!.First();

        var modelsResponse = await customerClient.GetAsync($"/api/v1/vehicle-manufacturers/{make.Id}/models");
        var modelsBody = await modelsResponse.Content.ReadFromJsonAsync<ApiResponse<IReadOnlyList<VehicleModelDto>>>(JsonOptions);
        var model = modelsBody!.Data!.First();

        var regNum = $"KA-01-{Guid.NewGuid():N}"[..12].ToUpper();
        var addVehResponse = await customerClient.PostAsJsonAsync("/api/v1/customer/vehicles", new CreateCustomerVehicleRequest(
            make.Id,
            model.Id,
            null,
            2021,
            FuelType.Petrol,
            "Automatic",
            regNum,
            "",
            32000,
            "White"));
        addVehResponse.EnsureSuccessStatusCode();
        var vehBody = await addVehResponse.Content.ReadFromJsonAsync<ApiResponse<CustomerVehicleDetailDto>>(JsonOptions);
        var vehicleId = vehBody!.Data!.Id;

        // 2. Submit service request near seeded Central Metro Motors
        var bookingResponse = await customerClient.PostAsJsonAsync("/api/v1/customer/requests", new CreateServiceBookingRequest(
            VehicleId: vehicleId,
            AddressLine1: "100 MG Road",
            AddressLine2: "Near Metro",
            City: "Bengaluru",
            State: "Karnataka",
            Pincode: "560001",
            Country: "India",
            Latitude: 12.9716,
            Longitude: 77.5946,
            ProblemDescription: "Front brake pads worn out and squeaking sound",
            ServiceCategory: "Brakes",
            PreferredServiceDate: DateTime.UtcNow.AddDays(2)));
        bookingResponse.EnsureSuccessStatusCode();
        var bookingBody = await bookingResponse.Content.ReadFromJsonAsync<ApiResponse<ServiceRequestDetailDto>>(JsonOptions);
        var serviceRequestId = bookingBody!.Data!.Id;

        // 3. Submit garage quote
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var seededGarageUser = await db.GarageUsers.Include(gu => gu.User).FirstAsync(gu => gu.User.Email == "garage.owner@centralmetro.com");
        var garageId = seededGarageUser.GarageId;

        var gr = await db.GarageRequests.FirstOrDefaultAsync(r => r.ServiceRequestId == serviceRequestId && r.GarageId == garageId);
        gr.Should().NotBeNull();

        var garageToken = await AuthenticateAsync("garage.owner@centralmetro.com", "Password123!");
        var garageClient = CreateAuthenticatedClient(garageToken);

        var createQuoteRequest = new CreateGarageQuoteRequest(
            GarageRequestId: gr!.Id,
            Currency: "INR",
            EstimatedCompletionHours: 4,
            EstimatedCompletionDays: 1,
            ValidUntil: DateTime.UtcNow.AddDays(7),
            GarageRemarks: "OEM Brake Pad replacement & disc skimming.",
            LineItems: new List<CreateQuoteLineItemRequest>
            {
                new(QuoteLineType.Part, "Front Brake Pad Set OEM", 1, 3200m, 18m, 0m, 1),
                new(QuoteLineType.Labour, "Front Brake Pad Installation & Rotor Skimming", 1, 1200m, 18m, 0m, 2)
            }
        );

        var draftResponse = await garageClient.PostAsJsonAsync("/api/v1/garage/quotes/draft", createQuoteRequest);
        draftResponse.EnsureSuccessStatusCode();
        var draftBody = await draftResponse.Content.ReadFromJsonAsync<ApiResponse<GarageQuoteDetailDto>>(JsonOptions);
        var garageQuoteId = draftBody!.Data!.Id;

        var submitQuoteResponse = await garageClient.PostAsJsonAsync($"/api/v1/garage/quotes/{garageQuoteId}/submit", new SubmitGarageQuoteCommand());
        submitQuoteResponse.EnsureSuccessStatusCode();

        // 4. Advisor reviews, assigns garage, and prepares Customer Quotation
        var advisorToken = await AuthenticateAsync("advisor@brocomod.com", "Password123!");
        var advisorClient = CreateAuthenticatedClient(advisorToken);

        var assignResponse = await advisorClient.PostAsJsonAsync(
            $"/api/v1/advisor/requests/{serviceRequestId}/assignment",
            new AssignGarageRequest(garageId, garageQuoteId, "Best turnaround time and ratings."));
        assignResponse.EnsureSuccessStatusCode();

        var createCqRequest = new CreateCustomerQuotationRequest(
            ScopeSummary: "Complete front brake pad replacement and disc maintenance",
            AdvisorRemarks: "OEM components with 6 months warranty.",
            ValidUntilUtc: DateTime.UtcNow.AddDays(5),
            CustomerDiscount: 200m,
            Currency: "INR",
            LineItems: new List<CustomerQuotationLineItemInputDto>
            {
                new(QuoteLineType.Part, "Front Brake Pad Set OEM", 1, 3600m, 18m, 0m, 1),
                new(QuoteLineType.Labour, "Brake Service & Disc Resurfacing", 1, 1400m, 18m, 0m, 2)
            }
        );

        var cqDraftResponse = await advisorClient.PostAsJsonAsync($"/api/v1/advisor/requests/{serviceRequestId}/customer-quotation", createCqRequest);
        cqDraftResponse.EnsureSuccessStatusCode();
        var cqDraftBody = await cqDraftResponse.Content.ReadFromJsonAsync<ApiResponse<CustomerQuotationDto>>(JsonOptions);
        var customerQuotationId = cqDraftBody!.Data!.Id;

        var readyResponse = await advisorClient.PostAsJsonAsync($"/api/v1/advisor/customer-quotations/{customerQuotationId}/ready", new { });
        readyResponse.EnsureSuccessStatusCode();

        var sendResponse = await advisorClient.PostAsJsonAsync($"/api/v1/advisor/customer-quotations/{customerQuotationId}/send", new { });
        sendResponse.EnsureSuccessStatusCode();

        return (serviceRequestId, garageId, garageQuoteId, customerQuotationId, custToken, custEmail);
    }

    [Fact]
    public async Task Scenario01_Customer_CanAccept_SentQuotation_Successfully()
    {
        // Arrange
        var (serviceRequestId, garageId, _, cqId, customerToken, _) = await CreateSentCustomerQuotationAsync();
        var customerClient = CreateAuthenticatedClient(customerToken);

        // Act: Customer accepts quotation
        var acceptRequest = new AcceptQuotationRequest(
            IdempotencyKey: $"IDEMP-ACCEPT-{Guid.NewGuid():N}",
            CustomerRemarks: "Please proceed with OEM brake parts."
        );
        var response = await customerClient.PostAsJsonAsync($"/api/v1/customer/quotes/{cqId}/accept", acceptRequest);

        // Assert API Response
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<BookingConfirmationDto>>(JsonOptions);
        body.Should().NotBeNull();
        body!.Data.Should().NotBeNull();
        body.Data!.QuotationId.Should().Be(cqId);
        body.Data.ServiceRequestId.Should().Be(serviceRequestId);
        body.Data.Status.Should().Be("BookingConfirmed");
        body.Data.GarageId.Should().Be(garageId);
        body.Data.GarageName.Should().NotBeNullOrWhiteSpace();
        body.Data.ConfirmedTotal.Should().BeGreaterThan(0m);
        body.Data.VehicleSummary.Should().NotBeNullOrWhiteSpace();

        // Assert Database State
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var quotation = await db.CustomerQuotations
            .Include(q => q.Decision)
            .FirstOrDefaultAsync(q => q.Id == cqId);
        quotation.Should().NotBeNull();
        quotation!.Status.Should().Be(CustomerQuotationStatus.Accepted);
        quotation.AcceptedAtUtc.Should().NotBeNull();
        quotation.AcceptedVersionId.Should().NotBeNull();
        quotation.Decision.Should().NotBeNull();
        quotation.Decision!.Decision.Should().Be(CustomerDecisionType.Accepted);
        quotation.Decision.DecisionReason.Should().Be("Please proceed with OEM brake parts.");

        var assignment = await db.GarageAssignments.FirstOrDefaultAsync(ga => ga.ServiceRequestId == serviceRequestId);
        assignment.Should().NotBeNull();
        assignment!.Status.Should().Be(GarageAssignmentStatus.Confirmed);

        var serviceRequest = await db.ServiceRequests.FirstOrDefaultAsync(sr => sr.Id == serviceRequestId);
        serviceRequest.Should().NotBeNull();
        serviceRequest!.Status.Should().Be(ServiceRequestStatus.BookingConfirmed);

        // Assert Decision Query Endpoint
        var decisionResponse = await customerClient.GetAsync($"/api/v1/customer/quotes/{cqId}/decision");
        decisionResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var decisionBody = await decisionResponse.Content.ReadFromJsonAsync<ApiResponse<CustomerQuotationDecisionDto>>(JsonOptions);
        decisionBody!.Data.Should().NotBeNull();
        decisionBody.Data!.Decision.Should().Be("Accepted");
        decisionBody.Data.CustomerQuotationId.Should().Be(cqId);
    }

    [Fact]
    public async Task Scenario02_Customer_Acceptance_IsIdempotent_WithSameIdempotencyKey()
    {
        // Arrange
        var (_, _, _, cqId, customerToken, _) = await CreateSentCustomerQuotationAsync();
        var customerClient = CreateAuthenticatedClient(customerToken);
        var idempotencyKey = $"IDEMP-REPLAY-{Guid.NewGuid():N}";

        var acceptRequest = new AcceptQuotationRequest(
            IdempotencyKey: idempotencyKey,
            CustomerRemarks: "First click acceptance."
        );

        // Act 1: Initial acceptance
        var firstResponse = await customerClient.PostAsJsonAsync($"/api/v1/customer/quotes/{cqId}/accept", acceptRequest);
        firstResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var firstBody = await firstResponse.Content.ReadFromJsonAsync<ApiResponse<BookingConfirmationDto>>(JsonOptions);
        firstBody!.Data.Should().NotBeNull();

        // Act 2: Duplicate acceptance replay with exact same idempotency key (header or body)
        var secondRequest = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/customer/quotes/{cqId}/accept")
        {
            Content = JsonContent.Create(new AcceptQuotationRequest(IdempotencyKey: idempotencyKey, CustomerRemarks: "Second click replay"))
        };
        secondRequest.Headers.Add("Idempotency-Key", idempotencyKey);
        var secondResponse = await customerClient.SendAsync(secondRequest);

        // Assert: Second call returns 200 OK with identical confirmation details
        secondResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var secondBody = await secondResponse.Content.ReadFromJsonAsync<ApiResponse<BookingConfirmationDto>>(JsonOptions);
        secondBody!.Data.Should().NotBeNull();
        secondBody.Data!.QuotationNumber.Should().Be(firstBody.Data!.QuotationNumber);
        secondBody.Data.ConfirmedTotal.Should().Be(firstBody.Data.ConfirmedTotal);

        // Assert: Only ONE decision row in database
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var decisionsCount = await db.CustomerQuotationDecisions.CountAsync(d => d.CustomerQuotationId == cqId);
        decisionsCount.Should().Be(1);
    }

    [Fact]
    public async Task Scenario03_Customer_Acceptance_Conflict_WhenAlreadyAccepted_WithoutMatchingIdempotencyKey()
    {
        // Arrange
        var (_, _, _, cqId, customerToken, _) = await CreateSentCustomerQuotationAsync();
        var customerClient = CreateAuthenticatedClient(customerToken);

        // First accept
        var firstResponse = await customerClient.PostAsJsonAsync(
            $"/api/v1/customer/quotes/{cqId}/accept",
            new AcceptQuotationRequest(IdempotencyKey: "KEY-AAA", CustomerRemarks: "Initial accept")
        );
        firstResponse.EnsureSuccessStatusCode();

        // Second accept with different idempotency key
        var secondResponse = await customerClient.PostAsJsonAsync(
            $"/api/v1/customer/quotes/{cqId}/accept",
            new AcceptQuotationRequest(IdempotencyKey: "KEY-BBB", CustomerRemarks: "Conflicting accept")
        );

        // Assert: 409 Conflict
        var errContent = await secondResponse.Content.ReadAsStringAsync();
        secondResponse.StatusCode.Should().Be(HttpStatusCode.Conflict, because: errContent);
    }

    [Fact]
    public async Task Scenario04_Customer_CannotAccept_ExpiredQuotation()
    {
        // Arrange
        var (_, _, _, cqId, customerToken, _) = await CreateSentCustomerQuotationAsync();
        var customerClient = CreateAuthenticatedClient(customerToken);

        // Simulate expiration in DB
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var quote = await db.CustomerQuotations.FindAsync(cqId);
            quote!.SetPrivateProperty("ValidUntilUtc", DateTime.UtcNow.AddMinutes(-30));
            await db.SaveChangesAsync();
        }

        // Act: Attempt to accept expired quotation
        var response = await customerClient.PostAsJsonAsync(
            $"/api/v1/customer/quotes/{cqId}/accept",
            new AcceptQuotationRequest(CustomerRemarks: "Accepting late")
        );

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>(JsonOptions);
        body!.Message.Should().Contain("expired");
    }

    [Fact]
    public async Task Scenario05_Customer_CanReject_SentQuotation_WithReasonAndCategory()
    {
        // Arrange
        var (serviceRequestId, _, _, cqId, customerToken, _) = await CreateSentCustomerQuotationAsync();
        var customerClient = CreateAuthenticatedClient(customerToken);

        var rejectRequest = new RejectQuotationRequest(
            Reason: "Quoted price is beyond my current maintenance budget.",
            Category: "PRICE_TOO_HIGH",
            IdempotencyKey: $"IDEMP-REJ-{Guid.NewGuid():N}"
        );

        // Act: Customer rejects quotation
        var response = await customerClient.PostAsJsonAsync($"/api/v1/customer/quotes/{cqId}/reject", rejectRequest);

        // Assert API Response
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<CustomerQuotationDecisionDto>>(JsonOptions);
        body.Should().NotBeNull();
        body!.Data.Should().NotBeNull();
        body.Data!.Decision.Should().Be("Rejected");
        body.Data.Category.Should().Be("PRICE_TOO_HIGH");
        body.Data.Reason.Should().Be("Quoted price is beyond my current maintenance budget.");

        // Assert Database State
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var quotation = await db.CustomerQuotations.FirstOrDefaultAsync(q => q.Id == cqId);
        quotation.Should().NotBeNull();
        quotation!.Status.Should().Be(CustomerQuotationStatus.Rejected);
        quotation.RejectedAtUtc.Should().NotBeNull();

        var serviceRequest = await db.ServiceRequests.FirstOrDefaultAsync(sr => sr.Id == serviceRequestId);
        serviceRequest.Should().NotBeNull();
        serviceRequest!.Status.Should().Be(ServiceRequestStatus.CustomerRejected);

        // Assert Advisor can inspect rejection reason
        var advisorToken = await AuthenticateAsync("advisor@brocomod.com", "Password123!");
        var advisorClient = CreateAuthenticatedClient(advisorToken);
        var advisorDecisionResponse = await advisorClient.GetAsync($"/api/v1/advisor/customer-quotations/{cqId}/decision");
        advisorDecisionResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var advDecisionBody = await advisorDecisionResponse.Content.ReadFromJsonAsync<ApiResponse<CustomerQuotationDecisionDto>>(JsonOptions);
        advDecisionBody!.Data!.Reason.Should().Be("Quoted price is beyond my current maintenance budget.");

        // Assert Super Admin can also view decision
        var adminToken = await AuthenticateAsync("admin@brocomod.com", "Password123!");
        var adminClient = CreateAuthenticatedClient(adminToken);
        var adminDecisionResponse = await adminClient.GetAsync($"/api/v1/admin/customer-quotations/{cqId}/decision");
        adminDecisionResponse.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Scenario06_Customer_Reject_RequiresValidReason()
    {
        // Arrange
        var (_, _, _, cqId, customerToken, _) = await CreateSentCustomerQuotationAsync();
        var customerClient = CreateAuthenticatedClient(customerToken);

        // Act: Empty reason
        var invalidRequest = new RejectQuotationRequest(
            Reason: "   ",
            Category: "OTHER"
        );
        var response = await customerClient.PostAsJsonAsync($"/api/v1/customer/quotes/{cqId}/reject", invalidRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>(JsonOptions);
        body!.Message.Should().Contain("mandatory");
    }

    [Fact]
    public async Task Scenario07_Customer_CannotDecide_AnotherCustomersQuotation()
    {
        // Arrange: Create quotation for Customer A
        var (_, _, _, cqId, _, _) = await CreateSentCustomerQuotationAsync();

        // Customer B
        var custBEmail = $"intruder_cust_{Guid.NewGuid():N}@brocomod.com";
        var regResponse = await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest(
            custBEmail,
            "Password123!",
            "Customer Intruder B",
            "+91 95555 44444"));
        regResponse.EnsureSuccessStatusCode();
        var custBToken = await AuthenticateAsync(custBEmail, "Password123!");
        var custBClient = CreateAuthenticatedClient(custBToken);

        // Act 1: Customer B tries to Accept Customer A's quote
        var acceptResponse = await custBClient.PostAsJsonAsync(
            $"/api/v1/customer/quotes/{cqId}/accept",
            new AcceptQuotationRequest(CustomerRemarks: "Hacking acceptance")
        );
        acceptResponse.StatusCode.Should().BeOneOf(HttpStatusCode.Forbidden, HttpStatusCode.NotFound);

        // Act 2: Customer B tries to Reject Customer A's quote
        var rejectResponse = await custBClient.PostAsJsonAsync(
            $"/api/v1/customer/quotes/{cqId}/reject",
            new RejectQuotationRequest(Reason: "Hacking rejection", Category: "OTHER")
        );
        rejectResponse.StatusCode.Should().BeOneOf(HttpStatusCode.Forbidden, HttpStatusCode.NotFound);

        // Act 3: Customer B tries to View Decision of Customer A's quote
        var viewDecisionResponse = await custBClient.GetAsync($"/api/v1/customer/quotes/{cqId}/decision");
        viewDecisionResponse.StatusCode.Should().BeOneOf(HttpStatusCode.Forbidden, HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Scenario08_Garage_CanView_ConfirmedBookings_AfterCustomerAcceptance()
    {
        // Arrange
        var (serviceRequestId, garageId, _, cqId, customerToken, _) = await CreateSentCustomerQuotationAsync();
        var customerClient = CreateAuthenticatedClient(customerToken);

        // 1. Garage initially checks confirmed bookings before customer acceptance
        var garageToken = await AuthenticateAsync("garage.owner@centralmetro.com", "Password123!");
        var garageClient = CreateAuthenticatedClient(garageToken);

        var bookingsBeforeAccept = await garageClient.GetAsync("/api/v1/garage/confirmed-bookings");
        bookingsBeforeAccept.EnsureSuccessStatusCode();
        var bookingsBeforeList = await bookingsBeforeAccept.Content.ReadFromJsonAsync<ApiResponse<List<GarageConfirmedBookingDto>>>(JsonOptions);
        bookingsBeforeList!.Data.Should().NotContain(b => b.ServiceRequestId == serviceRequestId);

        // 2. Customer accepts quotation
        var acceptResponse = await customerClient.PostAsJsonAsync(
            $"/api/v1/customer/quotes/{cqId}/accept",
            new AcceptQuotationRequest(CustomerRemarks: "Approved! Starting job soon.")
        );
        acceptResponse.EnsureSuccessStatusCode();

        // 3. Garage retrieves confirmed bookings after customer acceptance
        var bookingsAfterAccept = await garageClient.GetAsync("/api/v1/garage/confirmed-bookings");
        bookingsAfterAccept.EnsureSuccessStatusCode();
        var bookingsAfterList = await bookingsAfterAccept.Content.ReadFromJsonAsync<ApiResponse<List<GarageConfirmedBookingDto>>>(JsonOptions);
        bookingsAfterList!.Data.Should().NotBeNull();
        bookingsAfterList.Data.Should().Contain(b => b.ServiceRequestId == serviceRequestId);

        var confirmedItem = bookingsAfterList.Data!.First(b => b.ServiceRequestId == serviceRequestId);
        confirmedItem.RequestNumber.Should().StartWith("BM-");
        confirmedItem.VehicleMake.Should().NotBeNullOrWhiteSpace();
        confirmedItem.VehicleModel.Should().NotBeNullOrWhiteSpace();
        confirmedItem.VehicleYear.Should().Be(2021);
        confirmedItem.QuotedAmount.Should().BeGreaterThan(0m);
        confirmedItem.QuoteNumber.Should().StartWith("BQ-");
    }
}

// Reflection extension helper to simulate expiration
internal static class TestEntityExtensions
{
    public static void SetPrivateProperty<T>(this T obj, string propertyName, object? value)
    {
        var property = typeof(T).GetProperty(propertyName, System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
        if (property != null && property.CanWrite)
        {
            property.SetValue(obj, value);
        }
        else
        {
            var field = typeof(T).GetField($"<{propertyName}>k__BackingField", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            field?.SetValue(obj, value);
        }
    }
}
