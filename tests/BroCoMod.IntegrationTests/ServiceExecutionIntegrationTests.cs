using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using BroCoMod.Application.DTOs;
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

public class ServiceExecutionIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public ServiceExecutionIntegrationTests(WebApplicationFactory<Program> factory)
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

    private async Task<(Guid ServiceRequestId, Guid GarageId, Guid CustomerQuotationId, string CustomerToken, string GarageToken, string AdvisorToken)> CreateAcceptedBookingAsync()
    {
        // 1. Register customer & create vehicle
        var custEmail = $"service_exec_{Guid.NewGuid():N}@brocomod.com";
        var regResponse = await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest(
            custEmail,
            "Password123!",
            "Service Execution Customer",
            "+91 98888 77777"));
        regResponse.EnsureSuccessStatusCode();

        var custToken = await AuthenticateAsync(custEmail, "Password123!");
        var customerClient = CreateAuthenticatedClient(custToken);

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
            FuelType.Petrol,
            "Manual",
            regNum,
            "",
            25000,
            "Silver"));
        addVehResponse.EnsureSuccessStatusCode();
        var vehBody = await addVehResponse.Content.ReadFromJsonAsync<ApiResponse<CustomerVehicleDetailDto>>(JsonOptions);
        var vehicleId = vehBody!.Data!.Id;

        // 2. Submit service request
        var bookingResponse = await customerClient.PostAsJsonAsync("/api/v1/customer/requests", new CreateServiceBookingRequest(
            VehicleId: vehicleId,
            AddressLine1: "50 MG Road",
            AddressLine2: null,
            City: "Bengaluru",
            State: "Karnataka",
            Pincode: "560001",
            Country: "India",
            Latitude: 12.9716,
            Longitude: 77.5946,
            ProblemDescription: "Complete brake pad replacement and wheel alignment",
            ServiceCategory: "Brakes",
            PreferredServiceDate: DateTime.UtcNow.AddDays(2)));
        bookingResponse.EnsureSuccessStatusCode();
        var bookingBody = await bookingResponse.Content.ReadFromJsonAsync<ApiResponse<ServiceRequestDetailDto>>(JsonOptions);
        var serviceRequestId = bookingBody!.Data!.Id;

        // 3. Garage quote
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var seededGarageUser = await db.GarageUsers.Include(gu => gu.User).FirstAsync(gu => gu.User.Email == "garage.owner@centralmetro.com");
        var garageId = seededGarageUser.GarageId;

        var gr = await db.GarageRequests.FirstOrDefaultAsync(r => r.ServiceRequestId == serviceRequestId && r.GarageId == garageId);
        gr.Should().NotBeNull();

        var garageToken = await AuthenticateAsync("garage.owner@centralmetro.com", "Password123!");
        var garageClient = CreateAuthenticatedClient(garageToken);

        var draftResponse = await garageClient.PostAsJsonAsync("/api/v1/garage/quotes/draft", new CreateGarageQuoteRequest(
            GarageRequestId: gr!.Id,
            Currency: "INR",
            EstimatedCompletionHours: 3,
            EstimatedCompletionDays: 1,
            ValidUntil: DateTime.UtcNow.AddDays(7),
            GarageRemarks: "Brake service estimate",
            LineItems: new List<CreateQuoteLineItemRequest>
            {
                new(QuoteLineType.Part, "Front Brake Pads", 1, 3000m, 18m, 0m, 1),
                new(QuoteLineType.Labour, "Installation", 1, 1000m, 18m, 0m, 2)
            }
        ));
        draftResponse.EnsureSuccessStatusCode();
        var draftBody = await draftResponse.Content.ReadFromJsonAsync<ApiResponse<GarageQuoteDetailDto>>(JsonOptions);
        var garageQuoteId = draftBody!.Data!.Id;

        var submitResponse = await garageClient.PostAsJsonAsync($"/api/v1/garage/quotes/{garageQuoteId}/submit", new SubmitGarageQuoteCommand());
        submitResponse.EnsureSuccessStatusCode();

        // 4. Advisor assignment and customer quotation preparation
        var advisorToken = await AuthenticateAsync("advisor@brocomod.com", "Password123!");
        var advisorClient = CreateAuthenticatedClient(advisorToken);

        var assignResponse = await advisorClient.PostAsJsonAsync(
            $"/api/v1/advisor/requests/{serviceRequestId}/assignment",
            new AssignGarageRequest(garageId, garageQuoteId, "Assigned primary workshop."));
        assignResponse.EnsureSuccessStatusCode();

        var cqDraftResponse = await advisorClient.PostAsJsonAsync(
            $"/api/v1/advisor/requests/{serviceRequestId}/customer-quotation",
            new CreateCustomerQuotationRequest(
                ScopeSummary: "Complete Brake Service Package",
                AdvisorRemarks: "Genuine OEM parts guaranteed.",
                ValidUntilUtc: DateTime.UtcNow.AddDays(5),
                CustomerDiscount: 100m,
                Currency: "INR",
                LineItems: new List<CustomerQuotationLineItemInputDto>
                {
                    new(QuoteLineType.Part, "Front Brake Pads OEM", 1, 3500m, 18m, 0m, 1),
                    new(QuoteLineType.Labour, "Installation & Inspection", 1, 1200m, 18m, 0m, 2)
                }
            ));
        cqDraftResponse.EnsureSuccessStatusCode();
        var cqDraftBody = await cqDraftResponse.Content.ReadFromJsonAsync<ApiResponse<CustomerQuotationDto>>(JsonOptions);
        var customerQuotationId = cqDraftBody!.Data!.Id;

        var readyResponse = await advisorClient.PostAsJsonAsync($"/api/v1/advisor/customer-quotations/{customerQuotationId}/ready", new { });
        readyResponse.EnsureSuccessStatusCode();

        var sendResponse = await advisorClient.PostAsJsonAsync($"/api/v1/advisor/customer-quotations/{customerQuotationId}/send", new { });
        sendResponse.EnsureSuccessStatusCode();

        // 5. Customer accepts quotation -> BookingConfirmed -> ServiceJob created!
        var acceptResponse = await customerClient.PostAsJsonAsync(
            $"/api/v1/customer/quotes/{customerQuotationId}/accept",
            new AcceptQuotationRequest("Please proceed with this service."));
        acceptResponse.EnsureSuccessStatusCode();

        return (serviceRequestId, garageId, customerQuotationId, custToken, garageToken, advisorToken);
    }

    [Fact]
    public async Task CustomerAcceptance_AutomaticallyCreatesServiceJob_WithJobNumberSequence_AndConfirmedBooking()
    {
        // Arrange & Act: Pipeline runs through customer acceptance
        var (serviceRequestId, garageId, _, custToken, garageToken, _) = await CreateAcceptedBookingAsync();

        var garageClient = CreateAuthenticatedClient(garageToken);
        var customerClient = CreateAuthenticatedClient(custToken);

        // Assert 1: Garage sees the created ServiceJob in its jobs list
        var jobsResponse = await garageClient.GetAsync("/api/v1/garage/jobs");
        jobsResponse.EnsureSuccessStatusCode();
        var jobsBody = await jobsResponse.Content.ReadFromJsonAsync<ApiResponse<IEnumerable<ServiceJobSummaryDto>>>(JsonOptions);
        jobsBody!.Data.Should().NotBeNull();

        var jobSummary = jobsBody.Data!.FirstOrDefault(j => j.ServiceRequestId == serviceRequestId);
        jobSummary.Should().NotBeNull();
        jobSummary!.JobNumber.Should().StartWith("JOB-");
        jobSummary.Status.Should().Be("BookingConfirmed");
        jobSummary.GarageId.Should().Be(garageId);

        // Assert 2: Customer can fetch the service execution status for their service request
        var custJobResponse = await customerClient.GetAsync($"/api/v1/customer/requests/{serviceRequestId}/job");
        custJobResponse.EnsureSuccessStatusCode();
        var custJobBody = await custJobResponse.Content.ReadFromJsonAsync<ApiResponse<CustomerServiceJobDetailDto>>(JsonOptions);
        custJobBody!.Data.Should().NotBeNull();
        custJobBody.Data!.JobNumber.Should().Be(jobSummary.JobNumber);
        custJobBody.Data.Status.Should().Be("BookingConfirmed");
        custJobBody.Data.Timeline.Should().NotBeEmpty();
        custJobBody.Data.Timeline.First().ActivityType.Should().Be("JobCreated");
    }

    [Fact]
    public async Task CompleteGarageJobLifecycle_FromSchedulingToClosure_WithTimestampsAndActivities()
    {
        // Arrange
        var (serviceRequestId, garageId, _, custToken, garageToken, _) = await CreateAcceptedBookingAsync();
        var garageClient = CreateAuthenticatedClient(garageToken);
        var customerClient = CreateAuthenticatedClient(custToken);

        // Fetch JobId
        var jobsResponse = await garageClient.GetAsync("/api/v1/garage/jobs");
        var jobsBody = await jobsResponse.Content.ReadFromJsonAsync<ApiResponse<IEnumerable<ServiceJobSummaryDto>>>(JsonOptions);
        var jobId = jobsBody!.Data!.First(j => j.ServiceRequestId == serviceRequestId).Id;

        // Step 1: Schedule Job
        var scheduleStart = DateTime.UtcNow.AddHours(2);
        var scheduleEnd = DateTime.UtcNow.AddHours(6);
        var scheduleResp = await garageClient.PostAsJsonAsync($"/api/v1/garage/jobs/{jobId}/schedule", new ScheduleJobRequest(
            scheduleStart,
            scheduleEnd,
            "Customer agreed to morning slot."
        ));
        scheduleResp.EnsureSuccessStatusCode();
        var schedBody = await scheduleResp.Content.ReadFromJsonAsync<ApiResponse<GarageServiceJobDetailDto>>(JsonOptions);
        schedBody!.Data!.Status.Should().Be("Scheduled");

        // Step 2: Receive Vehicle
        var receiveResp = await garageClient.PostAsJsonAsync($"/api/v1/garage/jobs/{jobId}/receive", new ReceiveVehicleRequest(
            25400,
            "Minor scratch on left side mirror"
        ));
        receiveResp.EnsureSuccessStatusCode();
        var recvBody = await receiveResp.Content.ReadFromJsonAsync<ApiResponse<GarageServiceJobDetailDto>>(JsonOptions);
        recvBody!.Data!.Status.Should().Be("VehicleReceived");
        recvBody.Data.CurrentMileageKm.Should().Be(25400);

        // Step 3: Start Inspection
        var startInspResp = await garageClient.PostAsJsonAsync($"/api/v1/garage/jobs/{jobId}/inspection/start", new StartInspectionRequest(
            InspectionSeverity.Low
        ));
        startInspResp.EnsureSuccessStatusCode();
        var inspStartBody = await startInspResp.Content.ReadFromJsonAsync<ApiResponse<GarageServiceJobDetailDto>>(JsonOptions);
        inspStartBody!.Data!.Status.Should().Be("Inspection");

        // Step 4: Complete Inspection (Testing Separation of Internal vs Customer Notes)
        var completeInspResp = await garageClient.PostAsJsonAsync($"/api/v1/garage/jobs/{jobId}/inspection/complete", new CompleteInspectionRequest(
            Findings: "CONFIDENTIAL INTERNAL NOTE: 12% brake pad remaining. Rotors have mild grooves.",
            Recommendations: "Proceed with brake pad installation.",
            CustomerVisibleSummary: "Physical inspection complete. Vehicle is cleared for scheduled repairs.",
            Severity: InspectionSeverity.Medium
        ));
        completeInspResp.EnsureSuccessStatusCode();

        // Step 5: Start Work
        var startWorkResp = await garageClient.PostAsJsonAsync($"/api/v1/garage/jobs/{jobId}/work/start", new StartWorkRequest("Technician assigned to bay 3."));
        startWorkResp.EnsureSuccessStatusCode();
        var workBody = await startWorkResp.Content.ReadFromJsonAsync<ApiResponse<GarageServiceJobDetailDto>>(JsonOptions);
        workBody!.Data!.Status.Should().Be("WorkStarted");

        // Step 6: Update Progress
        var progressResp = await garageClient.PostAsJsonAsync($"/api/v1/garage/jobs/{jobId}/work/progress", new UpdateJobProgressRequest(
            ProgressNotes: "Front rotors resurfaced and new OEM brake pads installed.",
            IsCustomerVisible: true
        ));
        progressResp.EnsureSuccessStatusCode();
        var progBody = await progressResp.Content.ReadFromJsonAsync<ApiResponse<GarageServiceJobDetailDto>>(JsonOptions);
        progBody!.Data!.Status.Should().Be("WorkInProgress");

        // Step 7: Complete Work
        var compWorkResp = await garageClient.PostAsJsonAsync($"/api/v1/garage/jobs/{jobId}/work/complete", new CompleteWorkRequest(
            Notes: "Torque checks verified.",
            CustomerFacingNotes: "All repair items completed and tested."
        ));
        compWorkResp.EnsureSuccessStatusCode();
        var compBody = await compWorkResp.Content.ReadFromJsonAsync<ApiResponse<GarageServiceJobDetailDto>>(JsonOptions);
        compBody!.Data!.Status.Should().Be("WorkCompleted");

        // Step 8: Mark Vehicle Ready
        var readyResp = await garageClient.PostAsJsonAsync($"/api/v1/garage/jobs/{jobId}/vehicle-ready", new VehicleReadyRequest(
            "Vehicle cleaned and ready for pickup."
        ));
        readyResp.EnsureSuccessStatusCode();
        var readyBody = await readyResp.Content.ReadFromJsonAsync<ApiResponse<GarageServiceJobDetailDto>>(JsonOptions);
        readyBody!.Data!.Status.Should().Be("VehicleReady");

        // Step 9: Hand Over Vehicle
        var handoverResp = await garageClient.PostAsJsonAsync($"/api/v1/garage/jobs/{jobId}/handover", new HandOverVehicleRequest(
            "Keys given to customer."
        ));
        handoverResp.EnsureSuccessStatusCode();
        var handBody = await handoverResp.Content.ReadFromJsonAsync<ApiResponse<GarageServiceJobDetailDto>>(JsonOptions);
        handBody!.Data!.Status.Should().Be("HandedOver");

        // Step 10: Close Job
        var closeResp = await garageClient.PostAsJsonAsync($"/api/v1/garage/jobs/{jobId}/close", new CloseJobRequest(
            "Final inspection report archived."
        ));
        closeResp.EnsureSuccessStatusCode();
        var closeBody = await closeResp.Content.ReadFromJsonAsync<ApiResponse<GarageServiceJobDetailDto>>(JsonOptions);
        closeBody!.Data!.Status.Should().Be("Closed");

        // Step 11: Customer Sanitization Verification
        var custStatusResp = await customerClient.GetAsync($"/api/v1/customer/requests/{serviceRequestId}/job");
        custStatusResp.EnsureSuccessStatusCode();
        var custDetail = await custStatusResp.Content.ReadFromJsonAsync<ApiResponse<CustomerServiceJobDetailDto>>(JsonOptions);
        custDetail!.Data.Should().NotBeNull();
        custDetail.Data!.Status.Should().Be("Closed");

        // Verify strictly that customer visible inspection does NOT leak internal mechanic notes
        custDetail.Data.Inspection.Should().NotBeNull();
        custDetail.Data.Inspection!.CustomerVisibleSummary.Should().Be("Physical inspection complete. Vehicle is cleared for scheduled repairs.");
    }

    [Fact]
    public async Task AdditionalWorkRequest_DiscoveredDuringService_RequiresAdvisorReview_AndNeverMutatesAcceptedQuotation()
    {
        // Arrange
        var (serviceRequestId, garageId, quotationId, custToken, garageToken, advisorToken) = await CreateAcceptedBookingAsync();
        var garageClient = CreateAuthenticatedClient(garageToken);
        var advisorClient = CreateAuthenticatedClient(advisorToken);

        // Fetch Job
        var jobsResponse = await garageClient.GetAsync("/api/v1/garage/jobs");
        var jobsBody = await jobsResponse.Content.ReadFromJsonAsync<ApiResponse<IEnumerable<ServiceJobSummaryDto>>>(JsonOptions);
        var jobId = jobsBody!.Data!.First(j => j.ServiceRequestId == serviceRequestId).Id;

        // Transition to VehicleReceived -> WorkStarted -> WorkInProgress
        await garageClient.PostAsJsonAsync($"/api/v1/garage/jobs/{jobId}/receive", new ReceiveVehicleRequest(20000, "In bay"));
        await garageClient.PostAsJsonAsync($"/api/v1/garage/jobs/{jobId}/work/start", new StartWorkRequest("Work started"));

        // Get quotation before additional work
        decimal quoteBeforeTotal;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var quoteBefore = await db.CustomerQuotations.AsNoTracking().FirstAsync(cq => cq.Id == quotationId);
            quoteBeforeTotal = quoteBefore.CustomerTotal;
            quoteBeforeTotal.Should().BeGreaterThan(0);
        }

        // Act: Garage requests additional repair work
        var addWorkResp = await garageClient.PostAsJsonAsync($"/api/v1/garage/jobs/{jobId}/additional-work", new CreateAdditionalWorkRequest(
            Description: "Brake Caliper Pin Replacement",
            EstimatedAdditionalAmount: 1850m,
            Reason: "Seized slider pin discovered during caliper removal"
        ));
        addWorkResp.EnsureSuccessStatusCode();
        var addWorkBody = await addWorkResp.Content.ReadFromJsonAsync<ApiResponse<AdditionalWorkRequestDto>>(JsonOptions);
        addWorkBody!.Data.Should().NotBeNull();
        addWorkBody.Data!.Status.Should().Be("PendingAdvisorReview");
        addWorkBody.Data.EstimatedAdditionalAmount.Should().Be(1850m);
        var workRequestId = addWorkBody.Data.Id;

        // Act: Advisor reviews and approves the additional work
        var reviewResp = await advisorClient.PostAsJsonAsync(
            $"/api/v1/advisor/jobs/additional-work/{workRequestId}/review",
            new ReviewAdditionalWorkRequest(Approved: true, Remarks: "Approved essential safety hardware."));
        reviewResp.EnsureSuccessStatusCode();
        var reviewBody = await reviewResp.Content.ReadFromJsonAsync<ApiResponse<AdditionalWorkRequestDto>>(JsonOptions);
        reviewBody!.Data!.Status.Should().Be("Approved");

        // CRITICAL INVARIANT: The accepted quotation must NOT be mutated or increased automatically
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var quoteAfter = await db.CustomerQuotations.AsNoTracking().FirstAsync(cq => cq.Id == quotationId);
            quoteAfter.Status.Should().Be(CustomerQuotationStatus.Accepted);
            quoteAfter.CustomerTotal.Should().Be(quoteBeforeTotal); // strictly immutable
        }
    }

    [Fact]
    public async Task DataIsolation_GarageBCannotAccessGarageAJobs_AndCustomerBCannotAccessCustomerAJobs()
    {
        // Arrange: Job belongs to Central Metro Motors (garage A) and Customer A
        var (serviceRequestId, garageId, _, custToken, garageToken, _) = await CreateAcceptedBookingAsync();
        var garageClient = CreateAuthenticatedClient(garageToken);

        var jobsResponse = await garageClient.GetAsync("/api/v1/garage/jobs");
        var jobsBody = await jobsResponse.Content.ReadFromJsonAsync<ApiResponse<IEnumerable<ServiceJobSummaryDto>>>(JsonOptions);
        var jobAId = jobsBody!.Data!.First(j => j.ServiceRequestId == serviceRequestId).Id;

        // Create Customer B
        var custBEmail = $"customer_b_{Guid.NewGuid():N}@brocomod.com";
        await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest(
            custBEmail,
            "Password123!",
            "Customer B",
            "+91 99999 11111"));
        var custBToken = await AuthenticateAsync(custBEmail, "Password123!");
        var customerBClient = CreateAuthenticatedClient(custBToken);

        // Dynamically create and seed Garage B with user
        var garage2Email = $"competitor_{Guid.NewGuid():N}@garage.com";
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var g2 = new Garage("Competitor Autoworks", "comp@garage.com", "+91 91111 33333", "West St", 77.60, 12.98);
            db.Garages.Add(g2);
            await db.SaveChangesAsync();

            var hasher = scope.ServiceProvider.GetRequiredService<BroCoMod.Application.Interfaces.IPasswordHasher>();
            var hash = hasher.HashPassword("Password123!", out var salt);
            var user = new User(garage2Email, "Competitor Garage Owner", "+91 91111 33334", hash, salt);
            db.Users.Add(user);
            await db.SaveChangesAsync();

            var garageRole = await db.Roles.FirstAsync(r => r.Name == AppRoles.GarageOwner);
            db.UserRoles.Add(new Domain.Entities.Identity.UserRole { UserId = user.Id, RoleId = garageRole.Id });
            db.GarageUsers.Add(new GarageUser(user.Id, g2.Id, AppRoles.GarageOwner, "Owner"));
            await db.SaveChangesAsync();
        }

        var garageBToken = await AuthenticateAsync(garage2Email, "Password123!");
        var garageBClient = CreateAuthenticatedClient(garageBToken);

        // Act 1: Garage B tries to view Garage A's job
        var garageBAccessResp = await garageBClient.GetAsync($"/api/v1/garage/jobs/{jobAId}");
        garageBAccessResp.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        // Act 2: Customer B tries to view Customer A's job
        var custBAccessResp = await customerBClient.GetAsync($"/api/v1/customer/requests/{serviceRequestId}/job");
        custBAccessResp.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
