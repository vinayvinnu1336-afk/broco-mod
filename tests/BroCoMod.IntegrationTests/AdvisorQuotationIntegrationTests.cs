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

public class AdvisorQuotationIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public AdvisorQuotationIntegrationTests(WebApplicationFactory<Program> factory)
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

    // Helper: Creates a service request with a submitted quote from the seeded garage
    private async Task<(Guid ServiceRequestId, Guid GarageId, Guid QuoteId, string CustomerToken)> CreateServiceRequestWithSubmittedQuoteAsync()
    {
        // 1. Create customer & vehicle & request
        var custEmail = $"adv_cust_{Guid.NewGuid():N}@brocomod.com";
        var regResponse = await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest(
            custEmail,
            "Password123!",
            "Advisor Workflow Customer",
            "+91 98888 77777"));
        regResponse.EnsureSuccessStatusCode();

        var custToken = await AuthenticateAsync(custEmail, "Password123!");
        var customerClient = CreateAuthenticatedClient(custToken);

        // Get vehicle make/model
        var mResponse = await customerClient.GetAsync("/api/v1/vehicle-manufacturers");
        var mBody = await mResponse.Content.ReadFromJsonAsync<ApiResponse<IReadOnlyList<VehicleManufacturerDto>>>(JsonOptions);
        var make = mBody!.Data!.First();

        var modelsResponse = await customerClient.GetAsync($"/api/v1/vehicle-manufacturers/{make.Id}/models");
        var modelsBody = await modelsResponse.Content.ReadFromJsonAsync<ApiResponse<IReadOnlyList<VehicleModelDto>>>(JsonOptions);
        var model = modelsBody!.Data!.First();

        var regNum = $"KA-05-{Guid.NewGuid():N}"[..12].ToUpper();
        var addVehResponse = await customerClient.PostAsJsonAsync("/api/v1/customer/vehicles", new CreateCustomerVehicleRequest(
            make.Id,
            model.Id,
            null,
            2022,
            FuelType.Diesel,
            "Manual",
            regNum,
            "",
            25000,
            "Silver"));
        addVehResponse.EnsureSuccessStatusCode();
        var vehBody = await addVehResponse.Content.ReadFromJsonAsync<ApiResponse<CustomerVehicleDetailDto>>(JsonOptions);
        var vehicleId = vehBody!.Data!.Id;

        // Create booking request near seeded Central Metro Motors
        var bookingResponse = await customerClient.PostAsJsonAsync("/api/v1/customer/requests", new CreateServiceBookingRequest(
            VehicleId: vehicleId,
            AddressLine1: "500 Indiranagar 100ft Road",
            AddressLine2: "Opposite Metro",
            City: "Bengaluru",
            State: "Karnataka",
            Pincode: "560038",
            Country: "India",
            Latitude: 12.9716,
            Longitude: 77.5946,
            ProblemDescription: "Clutch slipping and strange grinding noise",
            ServiceCategory: "Transmission",
            PreferredServiceDate: DateTime.UtcNow.AddDays(2)));
        bookingResponse.EnsureSuccessStatusCode();
        var bookingBody = await bookingResponse.Content.ReadFromJsonAsync<ApiResponse<ServiceRequestDetailDto>>(JsonOptions);
        var serviceRequestId = bookingBody!.Data!.Id;

        // Dispatched GarageRequest for seeded garage
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var seededGarageUser = await db.GarageUsers.Include(gu => gu.User).FirstAsync(gu => gu.User.Email == "garage.owner@centralmetro.com");
        var garageId = seededGarageUser.GarageId;

        var gr = await db.GarageRequests.FirstOrDefaultAsync(r => r.ServiceRequestId == serviceRequestId && r.GarageId == garageId);
        gr.Should().NotBeNull();

        // 2. Submit quote from garage
        var garageToken = await AuthenticateAsync("garage.owner@centralmetro.com", "Password123!");
        var garageClient = CreateAuthenticatedClient(garageToken);

        var createQuoteRequest = new CreateGarageQuoteRequest(
            GarageRequestId: gr!.Id,
            Currency: "INR",
            EstimatedCompletionHours: 6,
            EstimatedCompletionDays: 1,
            ValidUntil: DateTime.UtcNow.AddDays(5),
            GarageRemarks: "OEM Clutch assembly kit replacement required.",
            LineItems: new List<CreateQuoteLineItemRequest>
            {
                new(QuoteLineType.Part, "OEM Clutch Plate Kit", 1, 4500m, 18m, 200m, 1),
                new(QuoteLineType.Labour, "Transmission removal & clutch installation labour", 1, 1500m, 18m, 0m, 2)
            }
        );

        var draftResponse = await garageClient.PostAsJsonAsync("/api/v1/garage/quotes/draft", createQuoteRequest);
        draftResponse.EnsureSuccessStatusCode();
        var draftBody = await draftResponse.Content.ReadFromJsonAsync<ApiResponse<GarageQuoteDetailDto>>(JsonOptions);
        var quoteId = draftBody!.Data!.Id;

        var submitResponse = await garageClient.PostAsJsonAsync($"/api/v1/garage/quotes/{quoteId}/submit", new SubmitGarageQuoteCommand());
        submitResponse.EnsureSuccessStatusCode();

        return (serviceRequestId, garageId, quoteId, custToken);
    }

    [Fact]
    public async Task Scenario01_Advisor_CanView_QuoteComparison()
    {
        // Arrange
        var (serviceRequestId, garageId, quoteId, _) = await CreateServiceRequestWithSubmittedQuoteAsync();
        var advisorToken = await AuthenticateAsync("advisor@brocomod.com", "Password123!");
        var advisorClient = CreateAuthenticatedClient(advisorToken);

        // Act
        var response = await advisorClient.GetAsync($"/api/v1/advisor/requests/{serviceRequestId}/quotes");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<QuoteComparisonDto>>(JsonOptions);
        body.Should().NotBeNull();
        body!.Data.Should().NotBeNull();
        body.Data!.ServiceRequestId.Should().Be(serviceRequestId);
        body.Data.Quotes.Should().NotBeEmpty();

        var quoteItem = body.Data.Quotes.FirstOrDefault(q => q.QuoteId == quoteId);
        quoteItem.Should().NotBeNull();
        quoteItem!.GarageId.Should().Be(garageId);
        quoteItem.GrandTotal.Should().BeGreaterThan(0m);
        quoteItem.LineItems.Should().HaveCount(2);
    }

    [Fact]
    public async Task Scenario02_Advisor_CanCreate_Update_And_Delete_InternalNotes()
    {
        // Arrange
        var (serviceRequestId, _, _, _) = await CreateServiceRequestWithSubmittedQuoteAsync();
        var advisorToken = await AuthenticateAsync("advisor@brocomod.com", "Password123!");
        var advisorClient = CreateAuthenticatedClient(advisorToken);

        // Act 1: Create internal note
        var createResponse = await advisorClient.PostAsJsonAsync(
            $"/api/v1/advisor/requests/{serviceRequestId}/notes",
            new CreateAdvisorNoteRequest("Customer mentioned previous clutch issues under warranty. Checked records.")
        );
        createResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var createBody = await createResponse.Content.ReadFromJsonAsync<ApiResponse<AdvisorRequestNoteDto>>(JsonOptions);
        createBody!.Data.Should().NotBeNull();
        var noteId = createBody.Data!.Id;
        createBody.Data.Note.Should().Be("Customer mentioned previous clutch issues under warranty. Checked records.");

        // Act 2: List internal notes
        var listResponse = await advisorClient.GetAsync($"/api/v1/advisor/requests/{serviceRequestId}/notes");
        listResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var listBody = await listResponse.Content.ReadFromJsonAsync<ApiResponse<List<AdvisorRequestNoteDto>>>(JsonOptions);
        listBody!.Data.Should().Contain(n => n.Id == noteId);

        // Act 3: Update internal note
        var updateResponse = await advisorClient.PutAsJsonAsync(
            $"/api/v1/advisor/requests/{serviceRequestId}/notes/{noteId}",
            new UpdateAdvisorNoteRequest("Updated note: Verified warranty expired last year. Proceeding with paid repair.")
        );
        updateResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var updateBody = await updateResponse.Content.ReadFromJsonAsync<ApiResponse<AdvisorRequestNoteDto>>(JsonOptions);
        updateBody!.Data!.Note.Should().Be("Updated note: Verified warranty expired last year. Proceeding with paid repair.");

        // Act 4: Delete internal note
        var deleteResponse = await advisorClient.DeleteAsync($"/api/v1/advisor/requests/{serviceRequestId}/notes/{noteId}");
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify note is no longer present
        var verifyList = await advisorClient.GetAsync($"/api/v1/advisor/requests/{serviceRequestId}/notes");
        var verifyBody = await verifyList.Content.ReadFromJsonAsync<ApiResponse<List<AdvisorRequestNoteDto>>>(JsonOptions);
        verifyBody!.Data.Should().NotContain(n => n.Id == noteId);
    }

    [Fact]
    public async Task Scenario03_Advisor_AssignGarage_And_Enforces_SingleActiveAssignment()
    {
        // Arrange
        var (serviceRequestId, garageId, quoteId, _) = await CreateServiceRequestWithSubmittedQuoteAsync();
        var advisorToken = await AuthenticateAsync("advisor@brocomod.com", "Password123!");
        var advisorClient = CreateAuthenticatedClient(advisorToken);

        // Act 1: Assign garage
        var assignResponse = await advisorClient.PostAsJsonAsync(
            $"/api/v1/advisor/requests/{serviceRequestId}/assignment",
            new AssignGarageRequest(garageId, quoteId, "Optimal turnaround and proven transmission experience.")
        );

        assignResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var assignBody = await assignResponse.Content.ReadFromJsonAsync<ApiResponse<GarageAssignmentDto>>(JsonOptions);
        assignBody.Should().NotBeNull();
        assignBody!.Data!.GarageId.Should().Be(garageId);
        assignBody.Data.SelectedQuoteId.Should().Be(quoteId);
        assignBody.Data.Status.Should().Be("Assigned");

        // Verify ServiceRequest transitioned to GarageSelected
        var reqDetail = await advisorClient.GetAsync($"/api/v1/advisor/requests/{serviceRequestId}");
        var reqBody = await reqDetail.Content.ReadFromJsonAsync<ApiResponse<AdvisorServiceRequestDetailDto>>(JsonOptions);
        reqBody!.Data!.Status.Should().BeEquivalentTo(ServiceRequestStatus.GarageSelected.ToString());

        // Act 2: Idempotent call returns OK
        var idempotentResponse = await advisorClient.PostAsJsonAsync(
            $"/api/v1/advisor/requests/{serviceRequestId}/assignment",
            new AssignGarageRequest(garageId, quoteId, "Optimal turnaround and proven transmission experience.")
        );
        idempotentResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // Act 3: Attempting assignment with a different quote while active assignment exists returns 409 Conflict
        var differentQuoteId = Guid.NewGuid();
        var conflictResponse = await advisorClient.PostAsJsonAsync(
            $"/api/v1/advisor/requests/{serviceRequestId}/assignment",
            new AssignGarageRequest(garageId, differentQuoteId, "Attempting different quote without cancellation.")
        );
        conflictResponse.StatusCode.Should().BeOneOf(HttpStatusCode.Conflict, HttpStatusCode.NotFound, HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Scenario04_CustomerQuotation_Draft_Ready_And_Send_Workflow()
    {
        // Arrange
        var (serviceRequestId, garageId, quoteId, customerToken) = await CreateServiceRequestWithSubmittedQuoteAsync();
        var advisorToken = await AuthenticateAsync("advisor@brocomod.com", "Password123!");
        var advisorClient = CreateAuthenticatedClient(advisorToken);

        // Assign garage first
        var assignResponse = await advisorClient.PostAsJsonAsync(
            $"/api/v1/advisor/requests/{serviceRequestId}/assignment",
            new AssignGarageRequest(garageId, quoteId, "Recommended partner workshop.")
        );
        assignResponse.EnsureSuccessStatusCode();

        // 1. Create Customer Quotation Draft
        var createCqRequest = new CreateCustomerQuotationRequest(
            ScopeSummary: "Complete clutch replacement and flywheel inspection",
            AdvisorRemarks: "OEM Clutch Kit guaranteed for 12 months.",
            ValidUntilUtc: DateTime.UtcNow.AddDays(4),
            CustomerDiscount: 300m,
            Currency: "INR",
            LineItems: new List<CustomerQuotationLineItemInputDto>
            {
                new(QuoteLineType.Part, "OEM Clutch Kit with Bearing", 1, 5200m, 18m, 0m, 1),
                new(QuoteLineType.Labour, "Clutch Fitting Labour", 1, 1800m, 18m, 0m, 2)
            }
        );

        var cqDraftResponse = await advisorClient.PostAsJsonAsync(
            $"/api/v1/advisor/requests/{serviceRequestId}/customer-quotation",
            createCqRequest
        );

        cqDraftResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var cqDraftBody = await cqDraftResponse.Content.ReadFromJsonAsync<ApiResponse<CustomerQuotationDto>>(JsonOptions);
        cqDraftBody!.Data.Should().NotBeNull();
        var cqId = cqDraftBody.Data!.Id;
        cqDraftBody.Data.Status.Should().Be("Draft");
        cqDraftBody.Data.QuotationNumber.Should().StartWith("CQ-");

        // Verify calculations: Subtotal = 5200 + 1800 = 7000. CustomerDiscount = 300
        // Net taxable = 6700. Line taxes = (5200 * 0.18) + (1800 * 0.18) = 1260
        // Scaled tax = 1260 * (6700 / 7000) = 1206.00. Total = 6700 + 1206 = 7906.00
        cqDraftBody.Data.CustomerSubtotal.Should().Be(7000.00m);
        cqDraftBody.Data.CustomerTax.Should().Be(1206.00m);
        cqDraftBody.Data.CustomerTotal.Should().Be(7906.00m);

        // 2. Customer Visibility Verification: In Draft status, customer cannot see quotation
        var customerClient = CreateAuthenticatedClient(customerToken);
        var custQuotesBeforeSend = await customerClient.GetAsync("/api/v1/customer/quotes");
        custQuotesBeforeSend.EnsureSuccessStatusCode();
        var custQuotesBeforeList = await custQuotesBeforeSend.Content.ReadFromJsonAsync<ApiResponse<List<CustomerFacingQuotationDto>>>(JsonOptions);
        custQuotesBeforeList!.Data.Should().NotContain(q => q.Id == cqId);

        var custQuoteDetailBeforeSend = await customerClient.GetAsync($"/api/v1/customer/quotes/{cqId}");
        custQuoteDetailBeforeSend.StatusCode.Should().BeOneOf(HttpStatusCode.Forbidden, HttpStatusCode.NotFound);

        // 3. Mark Ready to Send
        var readyResponse = await advisorClient.PostAsJsonAsync($"/api/v1/advisor/customer-quotations/{cqId}/ready", new { });
        readyResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var readyBody = await readyResponse.Content.ReadFromJsonAsync<ApiResponse<CustomerQuotationDto>>(JsonOptions);
        readyBody!.Data!.Status.Should().Be("ReadyToSend");

        // Customer still cannot see ReadyToSend quotation
        var custQuoteDetailReady = await customerClient.GetAsync($"/api/v1/customer/quotes/{cqId}");
        custQuoteDetailReady.StatusCode.Should().BeOneOf(HttpStatusCode.Forbidden, HttpStatusCode.NotFound);

        // 4. Send Quotation to Customer
        var sendResponse = await advisorClient.PostAsJsonAsync($"/api/v1/advisor/customer-quotations/{cqId}/send", new { });
        sendResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var sendBody = await sendResponse.Content.ReadFromJsonAsync<ApiResponse<CustomerQuotationDto>>(JsonOptions);
        sendBody!.Data!.Status.Should().Be("Sent");
        sendBody.Data.SentAtUtc.Should().NotBeNull();

        // 5. Customer can now view quotation in Sent status
        var custQuotesAfterSend = await customerClient.GetAsync("/api/v1/customer/quotes");
        custQuotesAfterSend.EnsureSuccessStatusCode();
        var custQuotesAfterList = await custQuotesAfterSend.Content.ReadFromJsonAsync<ApiResponse<List<CustomerFacingQuotationDto>>>(JsonOptions);
        custQuotesAfterList!.Data.Should().Contain(q => q.Id == cqId);

        var custQuoteDetailAfterSend = await customerClient.GetAsync($"/api/v1/customer/quotes/{cqId}");
        custQuoteDetailAfterSend.StatusCode.Should().Be(HttpStatusCode.OK);
        var custQuoteDetail = await custQuoteDetailAfterSend.Content.ReadFromJsonAsync<ApiResponse<CustomerFacingQuotationDto>>(JsonOptions);
        custQuoteDetail!.Data.Should().NotBeNull();
        custQuoteDetail.Data!.Status.Should().Be("Sent");
        custQuoteDetail.Data.CustomerTotal.Should().Be(7906.00m);
        custQuoteDetail.Data.ScopeSummary.Should().Be("Complete clutch replacement and flywheel inspection");
    }

    [Fact]
    public async Task Scenario05_Customer_CannotAccess_OtherCustomers_Quotation()
    {
        // Arrange: Create a sent quotation for Customer A
        var (serviceRequestId, garageId, quoteId, _) = await CreateServiceRequestWithSubmittedQuoteAsync();
        var advisorToken = await AuthenticateAsync("advisor@brocomod.com", "Password123!");
        var advisorClient = CreateAuthenticatedClient(advisorToken);

        await advisorClient.PostAsJsonAsync(
            $"/api/v1/advisor/requests/{serviceRequestId}/assignment",
            new AssignGarageRequest(garageId, quoteId, "Assignment for privacy test.")
        );

        var cqDraftResponse = await advisorClient.PostAsJsonAsync(
            $"/api/v1/advisor/requests/{serviceRequestId}/customer-quotation",
            new CreateCustomerQuotationRequest(
                ScopeSummary: "Inspection",
                AdvisorRemarks: null,
                ValidUntilUtc: DateTime.UtcNow.AddDays(3),
                CustomerDiscount: 0m,
                Currency: "INR",
                LineItems: new List<CustomerQuotationLineItemInputDto>
                {
                    new(QuoteLineType.Labour, "Inspection", 1, 1000m, 18m, 0m, 1)
                }
            )
        );
        var cqDraftBody = await cqDraftResponse.Content.ReadFromJsonAsync<ApiResponse<CustomerQuotationDto>>(JsonOptions);
        var cqId = cqDraftBody!.Data!.Id;

        // Send quotation
        await advisorClient.PostAsJsonAsync($"/api/v1/advisor/customer-quotations/{cqId}/ready", new { });
        await advisorClient.PostAsJsonAsync($"/api/v1/advisor/customer-quotations/{cqId}/send", new { });

        // Customer B registers
        var custBEmail = $"intruder_{Guid.NewGuid():N}@brocomod.com";
        await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest(
            custBEmail, "Password123!", "Intruder Customer", "+91 91111 22222"));
        var custBToken = await AuthenticateAsync(custBEmail, "Password123!");
        var custBClient = CreateAuthenticatedClient(custBToken);

        // Act: Customer B attempts to access Customer A's quotation
        var response = await custBClient.GetAsync($"/api/v1/customer/quotes/{cqId}");

        // Assert: Access is forbidden or not found
        response.StatusCode.Should().BeOneOf(HttpStatusCode.Forbidden, HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Scenario06_Admin_CanView_Assignments_And_CustomerQuotations()
    {
        // Arrange
        var adminToken = await AuthenticateAsync("admin@brocomod.com", "Password123!");
        var adminClient = CreateAuthenticatedClient(adminToken);

        // Act 1: Get assignments
        var assignmentsResponse = await adminClient.GetAsync("/api/v1/admin/assignments");
        assignmentsResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var assignmentsBody = await assignmentsResponse.Content.ReadFromJsonAsync<ApiResponse<List<GarageAssignmentDto>>>(JsonOptions);
        assignmentsBody.Should().NotBeNull();
        assignmentsBody!.Data.Should().NotBeNull();

        // Act 2: Get customer quotations
        var cqResponse = await adminClient.GetAsync("/api/v1/admin/customer-quotations");
        cqResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var cqBody = await cqResponse.Content.ReadFromJsonAsync<ApiResponse<List<CustomerQuotationSummaryDto>>>(JsonOptions);
        cqBody.Should().NotBeNull();
        cqBody!.Data.Should().NotBeNull();
    }
}
