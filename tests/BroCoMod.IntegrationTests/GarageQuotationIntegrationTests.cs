using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Constants;
using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Entities.Identity;
using BroCoMod.Domain.Enums;
using BroCoMod.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BroCoMod.IntegrationTests;

public class GarageQuotationIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public GarageQuotationIntegrationTests(WebApplicationFactory<Program> factory)
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

    // Helper: Create a dispatched service request for the seeded garage
    private async Task<(Guid ServiceRequestId, Guid GarageRequestId)> CreateDispatchedServiceRequestAsync()
    {
        // 1. Create a customer with vehicle and submit a booking request
        var email = $"quote_cust_{Guid.NewGuid():N}@brocomod.com";
        var regResponse = await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest(
            email,
            "Password123!",
            "Quote Test Customer",
            "+91 99999 88888"));
        regResponse.EnsureSuccessStatusCode();

        var token = await AuthenticateAsync(email, "Password123!");
        var customerClient = CreateAuthenticatedClient(token);

        // Get vehicle manufacturer & model
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
            2023,
            FuelType.Petrol,
            "Automatic",
            regNum,
            "",
            12000,
            "Black"));
        addVehResponse.EnsureSuccessStatusCode();
        var vehBody = await addVehResponse.Content.ReadFromJsonAsync<ApiResponse<CustomerVehicleDetailDto>>(JsonOptions);
        var vehicleId = vehBody!.Data!.Id;

        // Create booking request near seeded Central Metro Motors (12.9716, 77.5946)
        var bookingResponse = await customerClient.PostAsJsonAsync("/api/v1/customer/requests", new CreateServiceBookingRequest(
            VehicleId: vehicleId,
            AddressLine1: "123 MG Road",
            AddressLine2: "Near Metro",
            City: "Bengaluru",
            State: "Karnataka",
            Pincode: "560001",
            Country: "India",
            Latitude: 12.9716,
            Longitude: 77.5946,
            ProblemDescription: "Suspension noise and brake shuddering at high speed",
            ServiceCategory: "Brakes & Suspension",
            PreferredServiceDate: DateTime.UtcNow.AddDays(1)));
        bookingResponse.EnsureSuccessStatusCode();
        var bookingBody = await bookingResponse.Content.ReadFromJsonAsync<ApiResponse<ServiceRequestDetailDto>>(JsonOptions);
        var serviceRequestId = bookingBody!.Data!.Id;

        // Dispatched GarageRequest for the seeded garage
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var seededGarageUser = await db.GarageUsers.Include(gu => gu.User).FirstAsync(gu => gu.User.Email == "garage.owner@centralmetro.com");
        var garageId = seededGarageUser.GarageId;
        var gr = await db.GarageRequests.FirstOrDefaultAsync(r => r.ServiceRequestId == serviceRequestId && r.GarageId == garageId);
        gr.Should().NotBeNull();

        return (serviceRequestId, gr!.Id);
    }

    // ==========================================
    // Scenario 1: Garage creates draft quote
    // ==========================================
    [Fact]
    public async Task Scenario1_Garage_CanCreateDraftQuote_WithCalculatedTotals()
    {
        var (_, garageRequestId) = await CreateDispatchedServiceRequestAsync();

        var garageToken = await AuthenticateAsync("garage.owner@centralmetro.com", "Password123!");
        var garageClient = CreateAuthenticatedClient(garageToken);

        var request = new CreateGarageQuoteRequest(
            GarageRequestId: garageRequestId,
            Currency: "INR",
            EstimatedCompletionHours: 6,
            EstimatedCompletionDays: 1,
            ValidUntil: DateTime.UtcNow.AddDays(7),
            GarageRemarks: "OEM front brake pads and discs replacement",
            LineItems: new List<CreateQuoteLineItemRequest>
            {
                new(QuoteLineType.Labour, "Brake system overhaul labour", 1, 1200m, 18m, 0m, 1),
                new(QuoteLineType.Part, "Front Brake Discs Pair (OEM)", 1, 4500m, 18m, 500m, 2),
                new(QuoteLineType.Part, "Front Brake Pads", 1, 2500m, 18m, 0m, 3)
            });

        var response = await garageClient.PostAsJsonAsync("/api/v1/garage/quotes/draft", request);
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<GarageQuoteDetailDto>>(JsonOptions);
        body.Should().NotBeNull();
        body!.Data.Should().NotBeNull();

        var quote = body.Data!;
        quote.Status.Should().Be("Draft");
        quote.QuoteNumber.Should().StartWith("BQ-");
        quote.VersionNumber.Should().Be(1);
        quote.LineItems.Should().HaveCount(3);

        // Server totals check:
        // Item 1: Gross 1200, Disc 0, Subtotal 1200, Tax (18%) 216, LineTotal 1416
        // Item 2: Gross 4500, Disc 500, Subtotal 4000, Tax (18%) 720, LineTotal 4720
        // Item 3: Gross 2500, Disc 0, Subtotal 2500, Tax (18%) 450, LineTotal 2950
        // Header: Subtotal = 8200, Disc = 500, Tax = 1386, Total = 9086
        quote.Subtotal.Should().Be(8200.00m);
        quote.DiscountAmount.Should().Be(500.00m);
        quote.TaxAmount.Should().Be(1386.00m);
        quote.TotalAmount.Should().Be(9086.00m);
    }

    // ==========================================
    // Scenario 2: Garage updates draft quote
    // ==========================================
    [Fact]
    public async Task Scenario2_Garage_CanUpdateDraftQuote_RecalculatesTotals()
    {
        var (_, garageRequestId) = await CreateDispatchedServiceRequestAsync();

        var garageToken = await AuthenticateAsync("garage.owner@centralmetro.com", "Password123!");
        var garageClient = CreateAuthenticatedClient(garageToken);

        // 1. Create draft
        var createResponse = await garageClient.PostAsJsonAsync("/api/v1/garage/quotes/draft", new CreateGarageQuoteRequest(
            GarageRequestId: garageRequestId,
            ValidUntil: DateTime.UtcNow.AddDays(5),
            GarageRemarks: "Initial assessment",
            LineItems: new List<CreateQuoteLineItemRequest>
            {
                new(QuoteLineType.Labour, "Inspection", 1, 500m, 18m, 0m)
            }));
        createResponse.EnsureSuccessStatusCode();
        var createBody = await createResponse.Content.ReadFromJsonAsync<ApiResponse<GarageQuoteDetailDto>>(JsonOptions);
        var quoteId = createBody!.Data!.Id;

        // 2. Update draft
        var updateResponse = await garageClient.PutAsJsonAsync($"/api/v1/garage/quotes/{quoteId}/draft", new UpdateGarageQuoteDraftRequest(
            Currency: "INR",
            EstimatedCompletionHours: 8,
            EstimatedCompletionDays: 2,
            ValidUntil: DateTime.UtcNow.AddDays(10),
            GarageRemarks: "Updated diagnosis including wheel alignment",
            LineItems: new List<CreateQuoteLineItemRequest>
            {
                new(QuoteLineType.Labour, "Inspection & Calibration", 1, 800m, 18m, 0m, 1),
                new(QuoteLineType.Service, "Computerized Wheel Alignment", 1, 1000m, 18m, 100m, 2)
            }));
        var updateContent = await updateResponse.Content.ReadAsStringAsync();
        updateResponse.IsSuccessStatusCode.Should().BeTrue(because: updateContent);
        var updateBody = JsonSerializer.Deserialize<ApiResponse<GarageQuoteDetailDto>>(updateContent, JsonOptions);
        var updatedQuote = updateBody!.Data!;

        updatedQuote.Status.Should().Be("Draft");
        updatedQuote.EstimatedCompletionHours.Should().Be(8);
        updatedQuote.EstimatedCompletionDays.Should().Be(2);
        updatedQuote.LineItems.Should().HaveCount(2);

        // Subtotal = 1800, Disc = 100, Taxable = 1700, Tax = 306, Total = 2006
        updatedQuote.Subtotal.Should().Be(1800.00m);
        updatedQuote.DiscountAmount.Should().Be(100.00m);
        updatedQuote.TaxAmount.Should().Be(306.00m);
        updatedQuote.TotalAmount.Should().Be(2006.00m);
    }

    // ==========================================
    // Scenario 3: Garage submits quote, transitions status
    // ==========================================
    [Fact]
    public async Task Scenario3_Garage_CanSubmitQuote_TransitionsToSubmitted_AndUpdatesRequestStatus()
    {
        var (serviceRequestId, garageRequestId) = await CreateDispatchedServiceRequestAsync();

        var garageToken = await AuthenticateAsync("garage.owner@centralmetro.com", "Password123!");
        var garageClient = CreateAuthenticatedClient(garageToken);

        // 1. Create draft
        var createResponse = await garageClient.PostAsJsonAsync("/api/v1/garage/quotes/draft", new CreateGarageQuoteRequest(
            GarageRequestId: garageRequestId,
            ValidUntil: DateTime.UtcNow.AddDays(7),
            GarageRemarks: "Complete suspension repair",
            LineItems: new List<CreateQuoteLineItemRequest>
            {
                new(QuoteLineType.Part, "Strut Assembly", 2, 3500m, 18m, 200m)
            }));
        createResponse.EnsureSuccessStatusCode();
        var createBody = await createResponse.Content.ReadFromJsonAsync<ApiResponse<GarageQuoteDetailDto>>(JsonOptions);
        var quoteId = createBody!.Data!.Id;

        var submitResponse = await garageClient.PostAsJsonAsync($"/api/v1/garage/quotes/{quoteId}/submit", new SubmitGarageQuoteCommand(
            IdempotencyKey: "test-idemp-1"
        ));
        var submitContent = await submitResponse.Content.ReadAsStringAsync();
        submitResponse.IsSuccessStatusCode.Should().BeTrue(because: submitContent);
        var submitBody = JsonSerializer.Deserialize<ApiResponse<GarageQuoteDetailDto>>(submitContent, JsonOptions);
        var submittedQuote = submitBody!.Data!;

        submittedQuote.Status.Should().Be("Submitted");
        submittedQuote.SubmittedAtUtc.Should().NotBeNull();
        submittedQuote.Versions.Should().HaveCount(1);
        submittedQuote.Versions[0].VersionNumber.Should().Be(1);

        // Check DB state for GarageRequest and ServiceRequest
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var updatedGr = await db.GarageRequests.FindAsync(garageRequestId);
        updatedGr.Should().NotBeNull();
        updatedGr!.Status.Should().Be(GarageRequestStatus.Accepted);

        var updatedSr = await db.ServiceRequests.FindAsync(serviceRequestId);
        updatedSr.Should().NotBeNull();
        updatedSr!.Status.Should().Be(ServiceRequestStatus.QuotesReceived);
    }

    // ==========================================
    // Scenario 4: Advisor notified & can view quote
    // ==========================================
    [Fact]
    public async Task Scenario4_Advisor_ReceivesNotification_AndCanViewSubmittedQuoteWithLineItems()
    {
        var (serviceRequestId, garageRequestId) = await CreateDispatchedServiceRequestAsync();

        var garageToken = await AuthenticateAsync("garage.owner@centralmetro.com", "Password123!");
        var garageClient = CreateAuthenticatedClient(garageToken);

        // Create & Submit
        var createResponse = await garageClient.PostAsJsonAsync("/api/v1/garage/quotes/draft", new CreateGarageQuoteRequest(
            GarageRequestId: garageRequestId,
            ValidUntil: DateTime.UtcNow.AddDays(7),
            GarageRemarks: "Full brake servicing",
            LineItems: new List<CreateQuoteLineItemRequest>
            {
                new(QuoteLineType.Labour, "Brake service", 1, 1500m, 18m, 0m)
            }));
        var createBody = await createResponse.Content.ReadFromJsonAsync<ApiResponse<GarageQuoteDetailDto>>(JsonOptions);
        var quoteId = createBody!.Data!.Id;

        var submitResponse = await garageClient.PostAsJsonAsync($"/api/v1/garage/quotes/{quoteId}/submit", new SubmitGarageQuoteCommand());
        submitResponse.EnsureSuccessStatusCode();

        // Advisor login
        var advisorToken = await AuthenticateAsync("advisor@brocomod.com", "Password123!");
        var advisorClient = CreateAuthenticatedClient(advisorToken);

        // Check advisor can list quotes
        var listResponse = await advisorClient.GetAsync($"/api/v1/advisor/garage-quotes?serviceRequestId={serviceRequestId}");
        listResponse.EnsureSuccessStatusCode();
        var listBody = await listResponse.Content.ReadFromJsonAsync<ApiResponse<IReadOnlyList<AdvisorGarageQuoteSummaryDto>>>(JsonOptions);
        listBody.Should().NotBeNull();
        listBody!.Data.Should().Contain(q => q.Id == quoteId);

        // Check advisor can view quote detail with line items
        var detailResponse = await advisorClient.GetAsync($"/api/v1/advisor/garage-quotes/{quoteId}");
        detailResponse.EnsureSuccessStatusCode();
        var detailBody = await detailResponse.Content.ReadFromJsonAsync<ApiResponse<AdvisorGarageQuoteDetailDto>>(JsonOptions);
        var detail = detailBody!.Data!;

        detail.Id.Should().Be(quoteId);
        detail.Status.Should().Be("Submitted");
        detail.LineItems.Should().HaveCount(1);
        detail.LineItems[0].Description.Should().Be("Brake service");
        detail.Versions.Should().HaveCount(1);

        // Verify advisor notification in database
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var notif = await db.Notifications.FirstOrDefaultAsync(n => n.ReferenceId == quoteId && n.Type == "GARAGE_QUOTE_SUBMITTED");
        notif.Should().NotBeNull();
        notif!.Title.Should().Contain("New Quote Received");
    }

    // ==========================================
    // Scenario 5: Customer cannot access garage quote endpoints
    // ==========================================
    [Fact]
    public async Task Scenario5_Customer_CannotAccess_GarageQuoteEndpoints_ReturnsForbidden()
    {
        var customerToken = await AuthenticateAsync("customer@brocomod.com", "Password123!");
        var customerClient = CreateAuthenticatedClient(customerToken);

        // 1. Garage quote list
        var gQuotesResponse = await customerClient.GetAsync("/api/v1/garage/quotes");
        gQuotesResponse.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        // 2. Garage quote creation
        var gCreateResponse = await customerClient.PostAsJsonAsync("/api/v1/garage/quotes/draft", new CreateGarageQuoteRequest(
            Guid.NewGuid(), ValidUntil: DateTime.UtcNow.AddDays(7)));
        gCreateResponse.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        // 3. Advisor garage quote list
        var aQuotesResponse = await customerClient.GetAsync("/api/v1/advisor/garage-quotes");
        aQuotesResponse.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        // 4. Admin garage quote list
        var admQuotesResponse = await customerClient.GetAsync("/api/v1/admin/garage-quotes");
        admQuotesResponse.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ==========================================
    // Scenario 6: Multi-tenant isolation between garages
    // ==========================================
    [Fact]
    public async Task Scenario6_MultiTenantIsolation_CompetitorGarage_CannotAccessOrModify_OtherGarageQuote()
    {
        // 1. First garage creates a quote
        var (_, garageRequestId) = await CreateDispatchedServiceRequestAsync();
        var garage1Token = await AuthenticateAsync("garage.owner@centralmetro.com", "Password123!");
        var garage1Client = CreateAuthenticatedClient(garage1Token);

        var createResponse = await garage1Client.PostAsJsonAsync("/api/v1/garage/quotes/draft", new CreateGarageQuoteRequest(
            GarageRequestId: garageRequestId,
            ValidUntil: DateTime.UtcNow.AddDays(7),
            GarageRemarks: "Confidential garage 1 rate",
            LineItems: new List<CreateQuoteLineItemRequest>
            {
                new(QuoteLineType.Labour, "Labour", 1, 1000m, 18m, 0m)
            }));
        createResponse.EnsureSuccessStatusCode();
        var createBody = await createResponse.Content.ReadFromJsonAsync<ApiResponse<GarageQuoteDetailDto>>(JsonOptions);
        var quoteId = createBody!.Data!.Id;

        // 2. Set up a second garage with an authenticated user
        Guid garage2Id;
        string garage2Email = $"competitor_{Guid.NewGuid():N}@garage.com";

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var g2 = new Garage("Northside Autoworks", "northside@garage.com", "+91 91111 22222", "North St", 77.60, 12.98);
            db.Garages.Add(g2);
            await db.SaveChangesAsync();
            garage2Id = g2.Id;

            var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
            var hash = hasher.HashPassword("Password123!", out var salt);
            var user = new User(garage2Email, "Competitor Owner", "+91 91111 22223", hash, salt);
            db.Users.Add(user);
            await db.SaveChangesAsync();

            var garageRole = await db.Roles.FirstAsync(r => r.Name == AppRoles.GarageOwner);
            db.UserRoles.Add(new Domain.Entities.Identity.UserRole { UserId = user.Id, RoleId = garageRole.Id });
            db.GarageUsers.Add(new GarageUser(user.Id, garage2Id, AppRoles.GarageOwner, "Owner"));
            await db.SaveChangesAsync();
        }

        var garage2Token = await AuthenticateAsync(garage2Email, "Password123!");
        var garage2Client = CreateAuthenticatedClient(garage2Token);

        // 3. Competitor garage attempts to read quote -> 404 Not Found (tenant-isolated query)
        var readResponse = await garage2Client.GetAsync($"/api/v1/garage/quotes/{quoteId}");
        readResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);

        // 4. Competitor garage attempts to update quote -> 404 Not Found
        var updateResponse = await garage2Client.PutAsJsonAsync($"/api/v1/garage/quotes/{quoteId}/draft", new UpdateGarageQuoteDraftRequest(
            GarageRemarks: "Tampered by competitor",
            LineItems: new List<CreateQuoteLineItemRequest>()));
        updateResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);

        // 5. Competitor garage attempts to submit quote -> 404 Not Found
        var submitResponse = await garage2Client.PostAsJsonAsync($"/api/v1/garage/quotes/{quoteId}/submit", new SubmitGarageQuoteCommand());
        submitResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ==========================================
    // Scenario 7: Garage creates revision
    // ==========================================
    [Fact]
    public async Task Scenario7_Garage_CanCreateRevision_IncrementsVersion_PreservesHistory()
    {
        var (_, garageRequestId) = await CreateDispatchedServiceRequestAsync();
        var garageToken = await AuthenticateAsync("garage.owner@centralmetro.com", "Password123!");
        var garageClient = CreateAuthenticatedClient(garageToken);

        // 1. Create and submit v1
        var createResponse = await garageClient.PostAsJsonAsync("/api/v1/garage/quotes/draft", new CreateGarageQuoteRequest(
            GarageRequestId: garageRequestId,
            ValidUntil: DateTime.UtcNow.AddDays(7),
            GarageRemarks: "Version 1 proposal",
            LineItems: new List<CreateQuoteLineItemRequest>
            {
                new(QuoteLineType.Labour, "V1 Labour", 1, 1000m, 18m, 0m)
            }));
        var createBody = await createResponse.Content.ReadFromJsonAsync<ApiResponse<GarageQuoteDetailDto>>(JsonOptions);
        var quoteId = createBody!.Data!.Id;

        var submit1 = await garageClient.PostAsJsonAsync($"/api/v1/garage/quotes/{quoteId}/submit", new SubmitGarageQuoteCommand());
        submit1.EnsureSuccessStatusCode();

        // 2. Create revision
        var revisionResponse = await garageClient.PostAsync($"/api/v1/garage/quotes/{quoteId}/revision", null);
        revisionResponse.EnsureSuccessStatusCode();
        var revisionBody = await revisionResponse.Content.ReadFromJsonAsync<ApiResponse<GarageQuoteDetailDto>>(JsonOptions);
        var revQuote = revisionBody!.Data!;

        revQuote.VersionNumber.Should().Be(2);
        revQuote.Status.Should().Be("Draft");
        revQuote.Versions.Should().HaveCount(1); // v1 preserved
        revQuote.Versions[0].VersionNumber.Should().Be(1);

        // 3. Update & Submit v2
        var updateResponse = await garageClient.PutAsJsonAsync($"/api/v1/garage/quotes/{quoteId}/draft", new UpdateGarageQuoteDraftRequest(
            GarageRemarks: "Version 2 with premium parts",
            LineItems: new List<CreateQuoteLineItemRequest>
            {
                new(QuoteLineType.Labour, "V2 Labour", 1, 1200m, 18m, 0m),
                new(QuoteLineType.Part, "Premium Pads", 1, 3000m, 18m, 0m)
            }));
        updateResponse.EnsureSuccessStatusCode();

        var submit2 = await garageClient.PostAsJsonAsync($"/api/v1/garage/quotes/{quoteId}/submit", new SubmitGarageQuoteCommand());
        submit2.EnsureSuccessStatusCode();

        var finalBody = await submit2.Content.ReadFromJsonAsync<ApiResponse<GarageQuoteDetailDto>>(JsonOptions);
        finalBody!.Data!.VersionNumber.Should().Be(2);
        finalBody.Data!.Status.Should().Be("Submitted");
        finalBody.Data!.Versions.Should().HaveCount(2); // v1 and v2 both preserved
    }

    // ==========================================
    // Scenario 8: Garage withdraws quote
    // ==========================================
    [Fact]
    public async Task Scenario8_Garage_CanWithdrawQuote()
    {
        var (_, garageRequestId) = await CreateDispatchedServiceRequestAsync();
        var garageToken = await AuthenticateAsync("garage.owner@centralmetro.com", "Password123!");
        var garageClient = CreateAuthenticatedClient(garageToken);

        var createResponse = await garageClient.PostAsJsonAsync("/api/v1/garage/quotes/draft", new CreateGarageQuoteRequest(
            GarageRequestId: garageRequestId,
            ValidUntil: DateTime.UtcNow.AddDays(7),
            LineItems: new List<CreateQuoteLineItemRequest>
            {
                new(QuoteLineType.Part, "Battery", 1, 4000m, 18m, 0m)
            }));
        var createBody = await createResponse.Content.ReadFromJsonAsync<ApiResponse<GarageQuoteDetailDto>>(JsonOptions);
        var quoteId = createBody!.Data!.Id;

        // Withdraw
        var withdrawResponse = await garageClient.PostAsJsonAsync($"/api/v1/garage/quotes/{quoteId}/withdraw", new WithdrawGarageQuoteCommand(
            Reason: "Parts unavailable from supplier"
        ));
        withdrawResponse.EnsureSuccessStatusCode();

        var body = await withdrawResponse.Content.ReadFromJsonAsync<ApiResponse<GarageQuoteDetailDto>>(JsonOptions);
        body!.Data!.Status.Should().Be("Withdrawn");
        body.Data!.WithdrawalReason.Should().Be("Parts unavailable from supplier");
    }

    // ==========================================
    // Scenario 9: Idempotent Submission
    // ==========================================
    [Fact]
    public async Task Scenario9_IdempotentSubmission_WithSameKey_ReturnsSameQuoteWithoutDuplicates()
    {
        var (_, garageRequestId) = await CreateDispatchedServiceRequestAsync();
        var garageToken = await AuthenticateAsync("garage.owner@centralmetro.com", "Password123!");
        var garageClient = CreateAuthenticatedClient(garageToken);

        var createResponse = await garageClient.PostAsJsonAsync("/api/v1/garage/quotes/draft", new CreateGarageQuoteRequest(
            GarageRequestId: garageRequestId,
            ValidUntil: DateTime.UtcNow.AddDays(7),
            LineItems: new List<CreateQuoteLineItemRequest>
            {
                new(QuoteLineType.Labour, "Tune-up", 1, 1000m, 18m, 0m)
            }));
        var createBody = await createResponse.Content.ReadFromJsonAsync<ApiResponse<GarageQuoteDetailDto>>(JsonOptions);
        var quoteId = createBody!.Data!.Id;

        // First submit
        var submit1 = await garageClient.PostAsJsonAsync($"/api/v1/garage/quotes/{quoteId}/submit", new SubmitGarageQuoteCommand(
            IdempotencyKey: "idemp-unique-99"
        ));
        submit1.EnsureSuccessStatusCode();

        // Second submit with same idempotency key
        var submit2 = await garageClient.PostAsJsonAsync($"/api/v1/garage/quotes/{quoteId}/submit", new SubmitGarageQuoteCommand(
            IdempotencyKey: "idemp-unique-99"
        ));
        submit2.EnsureSuccessStatusCode();

        var body2 = await submit2.Content.ReadFromJsonAsync<ApiResponse<GarageQuoteDetailDto>>(JsonOptions);
        body2!.Data!.Status.Should().Be("Submitted");
        body2.Data!.Versions.Should().HaveCount(1); // Not duplicated
    }

    // ==========================================
    // Scenario 10: Admin audit inspection
    // ==========================================
    [Fact]
    public async Task Scenario10_Admin_CanInspectGarageQuotes_AndAuditLogs()
    {
        // Ensure at least one quote is created
        var (_, garageRequestId) = await CreateDispatchedServiceRequestAsync();
        var garageToken = await AuthenticateAsync("garage.owner@centralmetro.com", "Password123!");
        var garageClient = CreateAuthenticatedClient(garageToken);

        await garageClient.PostAsJsonAsync("/api/v1/garage/quotes/draft", new CreateGarageQuoteRequest(
            GarageRequestId: garageRequestId,
            ValidUntil: DateTime.UtcNow.AddDays(7),
            LineItems: new List<CreateQuoteLineItemRequest>
            {
                new(QuoteLineType.Labour, "Admin Audit Test Labour", 1, 500m, 18m, 0m)
            }));

        var adminToken = await AuthenticateAsync("admin@brocomod.com", "Password123!");
        var adminClient = CreateAuthenticatedClient(adminToken);

        // 1. List quotes
        var quotesResponse = await adminClient.GetAsync("/api/v1/admin/garage-quotes");
        quotesResponse.EnsureSuccessStatusCode();
        var quotesBody = await quotesResponse.Content.ReadFromJsonAsync<ApiResponse<IReadOnlyList<AdminGarageQuoteSummaryDto>>>(JsonOptions);
        quotesBody.Should().NotBeNull();
        quotesBody!.Data.Should().NotBeEmpty();

        // 2. Audit logs
        var auditResponse = await adminClient.GetAsync("/api/v1/admin/audit?limit=50");
        auditResponse.EnsureSuccessStatusCode();
        var auditBody = await auditResponse.Content.ReadFromJsonAsync<ApiResponse<IReadOnlyList<AdminAuditLogSummaryDto>>>(JsonOptions);
        auditBody.Should().NotBeNull();
        auditBody!.Data.Should().Contain(l => l.Action.StartsWith("GARAGE_QUOTE_"));
    }
}
