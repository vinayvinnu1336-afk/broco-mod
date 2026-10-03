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
using BroCoMod.Infrastructure.Services.PaymentGateway;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BroCoMod.IntegrationTests;

public class FinancialIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public FinancialIntegrationTests(WebApplicationFactory<Program> factory)
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

    private async Task<(Guid ServiceRequestId, Guid GarageId, Guid CustomerQuotationId, string CustomerToken, decimal TotalAmount)> CreateAcceptedCustomerQuotationAsync()
    {
        // 1. Customer registration & vehicle
        var custEmail = $"fin_cust_{Guid.NewGuid():N}@brocomod.com";
        var regResponse = await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest(
            custEmail,
            "Password123!",
            "Finance Workflow Customer",
            "+91 96666 55555"));
        regResponse.EnsureSuccessStatusCode();

        var custToken = await AuthenticateAsync(custEmail, "Password123!");
        var customerClient = CreateAuthenticatedClient(custToken);

        var mResponse = await customerClient.GetAsync("/api/v1/vehicle-manufacturers");
        var mBody = await mResponse.Content.ReadFromJsonAsync<ApiResponse<IReadOnlyList<VehicleManufacturerDto>>>(JsonOptions);
        var make = mBody!.Data!.First();

        var modelsResponse = await customerClient.GetAsync($"/api/v1/vehicle-manufacturers/{make.Id}/models");
        var modelsBody = await modelsResponse.Content.ReadFromJsonAsync<ApiResponse<IReadOnlyList<VehicleModelDto>>>(JsonOptions);
        var model = modelsBody!.Data!.First();

        var regNum = $"KA-02-{Guid.NewGuid():N}"[..12].ToUpper();
        var addVehResponse = await customerClient.PostAsJsonAsync("/api/v1/customer/vehicles", new CreateCustomerVehicleRequest(
            make.Id,
            model.Id,
            null,
            2022,
            FuelType.Diesel,
            "Manual",
            regNum,
            "",
            15000,
            "Silver"));
        addVehResponse.EnsureSuccessStatusCode();
        var vehBody = await addVehResponse.Content.ReadFromJsonAsync<ApiResponse<CustomerVehicleDetailDto>>(JsonOptions);
        var vehicleId = vehBody!.Data!.Id;

        // 2. Submit service booking request
        var bookingResponse = await customerClient.PostAsJsonAsync("/api/v1/customer/requests", new CreateServiceBookingRequest(
            VehicleId: vehicleId,
            AddressLine1: "200 Indiranagar",
            AddressLine2: "100 Feet Road",
            City: "Bengaluru",
            State: "Karnataka",
            Pincode: "560038",
            Country: "India",
            Latitude: 12.9716,
            Longitude: 77.5946,
            ProblemDescription: "Scheduled Periodic Maintenance & Engine Oil Change",
            ServiceCategory: "Periodic Service",
            PreferredServiceDate: DateTime.UtcNow.AddDays(3)));
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

        var createQuoteRequest = new CreateGarageQuoteRequest(
            GarageRequestId: gr!.Id,
            Currency: "INR",
            EstimatedCompletionHours: 3,
            EstimatedCompletionDays: 1,
            ValidUntil: DateTime.UtcNow.AddDays(7),
            GarageRemarks: "Full synthetic oil and filter replacement.",
            LineItems: new List<CreateQuoteLineItemRequest>
            {
                new(QuoteLineType.Part, "Synthetic 5W-40 Engine Oil 4L", 1, 3500m, 18m, 0m, 1),
                new(QuoteLineType.Part, "OEM Oil Filter Element", 1, 600m, 18m, 0m, 2),
                new(QuoteLineType.Labour, "Periodic Maintenance Labour", 1, 1000m, 18m, 0m, 3)
            }
        );

        var draftResponse = await garageClient.PostAsJsonAsync("/api/v1/garage/quotes/draft", createQuoteRequest);
        draftResponse.EnsureSuccessStatusCode();
        var draftBody = await draftResponse.Content.ReadFromJsonAsync<ApiResponse<GarageQuoteDetailDto>>(JsonOptions);
        var garageQuoteId = draftBody!.Data!.Id;

        var submitQuoteResponse = await garageClient.PostAsJsonAsync($"/api/v1/garage/quotes/{garageQuoteId}/submit", new SubmitGarageQuoteCommand());
        submitQuoteResponse.EnsureSuccessStatusCode();

        // 4. Advisor reviews, assigns garage, sends Customer Quotation
        var advisorToken = await AuthenticateAsync("advisor@brocomod.com", "Password123!");
        var advisorClient = CreateAuthenticatedClient(advisorToken);

        var assignResponse = await advisorClient.PostAsJsonAsync(
            $"/api/v1/advisor/requests/{serviceRequestId}/assignment",
            new AssignGarageRequest(garageId, garageQuoteId, "Certified lubricants and high customer trust."));
        assignResponse.EnsureSuccessStatusCode();

        var createCqRequest = new CreateCustomerQuotationRequest(
            ScopeSummary: "Comprehensive engine oil service and periodic multipoint inspection",
            AdvisorRemarks: "Standard periodic service package.",
            ValidUntilUtc: DateTime.UtcNow.AddDays(7),
            CustomerDiscount: 100m,
            Currency: "INR",
            LineItems: new List<CustomerQuotationLineItemInputDto>
            {
                new(QuoteLineType.Part, "Synthetic 5W-40 Engine Oil 4L", 1, 4000m, 18m, 0m, 1),
                new(QuoteLineType.Part, "OEM Oil Filter Element", 1, 750m, 18m, 0m, 2),
                new(QuoteLineType.Labour, "Periodic Maintenance Labour", 1, 1200m, 18m, 0m, 3)
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

        // 5. Customer accepts quotation
        var acceptResponse = await customerClient.PostAsJsonAsync(
            $"/api/v1/customer/quotes/{customerQuotationId}/accept",
            new AcceptQuotationRequest(CustomerRemarks: "Proceed with the recommended engine maintenance."));
        acceptResponse.EnsureSuccessStatusCode();
        var acceptBody = await acceptResponse.Content.ReadFromJsonAsync<ApiResponse<BookingConfirmationDto>>(JsonOptions);

        return (serviceRequestId, garageId, customerQuotationId, custToken, acceptBody!.Data!.ConfirmedTotal);
    }

    [Fact]
    public async Task Scenario01_Customer_InitiateQuotationPayment_And_Verify_Generates_Invoice_And_Settlement()
    {
        // Arrange
        var (_, garageId, customerQuotationId, custToken, expectedTotal) = await CreateAcceptedCustomerQuotationAsync();
        var customerClient = CreateAuthenticatedClient(custToken);

        // Act 1: Initiate payment
        var initiateResponse = await customerClient.PostAsJsonAsync(
            "/api/v1/customer/payments/initiate",
            new InitiatePaymentRequestDto(customerQuotationId)
        );

        var rawContent = await initiateResponse.Content.ReadAsStringAsync();
        initiateResponse.StatusCode.Should().Be(HttpStatusCode.OK, because: rawContent);
        var initiateBody = await initiateResponse.Content.ReadFromJsonAsync<ApiResponse<InitiatePaymentResponseDto>>(JsonOptions);
        initiateBody.Should().NotBeNull();
        initiateBody!.Data.Should().NotBeNull();

        var paymentId = initiateBody.Data!.PaymentId;
        initiateBody.Data.Amount.Should().Be(expectedTotal);
        initiateBody.Data.Currency.Should().Be("INR");
        initiateBody.Data.PaymentNumber.Should().StartWith("PAY-");
        initiateBody.Data.GatewayOrderId.Should().StartWith("ord_fake_");

        // Act 2: Verify payment with fake gateway
        var fakePaymentId = $"pay_test_{Guid.NewGuid():N}";
        var verifyResponse = await customerClient.PostAsJsonAsync(
            "/api/v1/customer/payments/verify",
            new VerifyPaymentRequestDto(
                PaymentId: paymentId,
                GatewayPaymentId: fakePaymentId,
                GatewaySignature: "sig_fake_valid",
                GatewayOrderId: initiateBody.Data.GatewayOrderId
            )
        );

        verifyResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var verifyBody = await verifyResponse.Content.ReadFromJsonAsync<ApiResponse<PaymentDto>>(JsonOptions);
        verifyBody.Should().NotBeNull();
        verifyBody!.Data!.Status.Should().Be("Paid");
        verifyBody.Data.GatewayPaymentId.Should().Be(fakePaymentId);
        verifyBody.Data.PaidAtUtc.Should().NotBeNull();

        // Act 3: Verify Invoice was automatically issued
        var invoiceResponse = await customerClient.GetAsync($"/api/v1/customer/invoices/by-payment/{paymentId}");
        invoiceResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var invoiceBody = await invoiceResponse.Content.ReadFromJsonAsync<ApiResponse<InvoiceDto>>(JsonOptions);
        invoiceBody.Should().NotBeNull();
        invoiceBody!.Data!.InvoiceNumber.Should().StartWith("INV-");
        invoiceBody.Data.Status.Should().Be("Paid");
        invoiceBody.Data.TotalAmount.Should().Be(expectedTotal);

        // Act 4: Verify Settlement was generated in database
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var settlement = await db.GarageSettlements
            .FirstOrDefaultAsync(s => s.PaymentId == paymentId);

        settlement.Should().NotBeNull();
        settlement!.SettlementNumber.Should().StartWith("SET-");
        settlement.GrossAmount.Should().Be(expectedTotal);
        settlement.GarageId.Should().Be(garageId);
        settlement.NetPayableToGarage.Should().BeLessThan(expectedTotal);
        settlement.TotalPlatformFee.Should().BeGreaterThan(0m);
        settlement.Status.Should().Be(SettlementStatus.Pending);

        // Act 5: Verify Ledger entries
        var ledgerEntries = await db.FinancialLedgerEntries
            .Where(l => l.PaymentId == paymentId)
            .ToListAsync();

        ledgerEntries.Should().NotBeEmpty();
        ledgerEntries.Should().Contain(l => l.AccountType == "ESCROW");
        ledgerEntries.Should().Contain(l => l.AccountType == "CUSTOMER");
    }

    [Fact]
    public async Task Scenario02_Payment_Idempotency_And_Deduplication()
    {
        // Arrange
        var (_, _, customerQuotationId, custToken, _) = await CreateAcceptedCustomerQuotationAsync();
        var customerClient = CreateAuthenticatedClient(custToken);
        var idempotencyKey = $"idemp-{Guid.NewGuid():N}";

        // Act 1: Initiate payment with Idempotency-Key
        var req1 = new HttpRequestMessage(HttpMethod.Post, "/api/v1/customer/payments/initiate")
        {
            Content = JsonContent.Create(new InitiatePaymentRequestDto(customerQuotationId, idempotencyKey))
        };
        req1.Headers.Add("Idempotency-Key", idempotencyKey);
        var res1 = await customerClient.SendAsync(req1);
        res1.StatusCode.Should().Be(HttpStatusCode.OK);
        var body1 = await res1.Content.ReadFromJsonAsync<ApiResponse<InitiatePaymentResponseDto>>(JsonOptions);

        // Act 2: Send duplicate initiate call with same key
        var req2 = new HttpRequestMessage(HttpMethod.Post, "/api/v1/customer/payments/initiate")
        {
            Content = JsonContent.Create(new InitiatePaymentRequestDto(customerQuotationId, idempotencyKey))
        };
        req2.Headers.Add("Idempotency-Key", idempotencyKey);
        var res2 = await customerClient.SendAsync(req2);
        res2.StatusCode.Should().Be(HttpStatusCode.OK);
        var body2 = await res2.Content.ReadFromJsonAsync<ApiResponse<InitiatePaymentResponseDto>>(JsonOptions);

        // Assert: Same Payment record returned
        body2!.Data!.PaymentId.Should().Be(body1!.Data!.PaymentId);
        body2.Data.PaymentNumber.Should().Be(body1.Data.PaymentNumber);
        body2.Data.GatewayOrderId.Should().Be(body1.Data.GatewayOrderId);

        // Act 3: Verify payment twice
        var fakePaymentId = $"pay_test_{Guid.NewGuid():N}";
        var verify1 = await customerClient.PostAsJsonAsync(
            "/api/v1/customer/payments/verify",
            new VerifyPaymentRequestDto(body1.Data.PaymentId, fakePaymentId, null, body1.Data.GatewayOrderId));
        verify1.StatusCode.Should().Be(HttpStatusCode.OK);

        var verify2 = await customerClient.PostAsJsonAsync(
            "/api/v1/customer/payments/verify",
            new VerifyPaymentRequestDto(body1.Data.PaymentId, fakePaymentId, null, body1.Data.GatewayOrderId));
        verify2.StatusCode.Should().Be(HttpStatusCode.OK);
        var verifyBody2 = await verify2.Content.ReadFromJsonAsync<ApiResponse<PaymentDto>>(JsonOptions);
        verifyBody2!.Data!.Status.Should().Be("Paid");
    }

    [Fact]
    public async Task Scenario03_Webhook_Captures_Payment_And_Generates_Invoice()
    {
        // Arrange
        var (_, _, customerQuotationId, custToken, expectedTotal) = await CreateAcceptedCustomerQuotationAsync();
        var customerClient = CreateAuthenticatedClient(custToken);

        var initResponse = await customerClient.PostAsJsonAsync(
            "/api/v1/customer/payments/initiate",
            new InitiatePaymentRequestDto(customerQuotationId));
        initResponse.EnsureSuccessStatusCode();
        var initBody = await initResponse.Content.ReadFromJsonAsync<ApiResponse<InitiatePaymentResponseDto>>(JsonOptions);
        var orderId = initBody!.Data!.GatewayOrderId;

        // Act: Deliver webhook payload
        var webhookPaymentId = $"pay_webhook_{Guid.NewGuid():N}";
        var webhookPayload = JsonSerializer.Serialize(new
        {
            @event = "payment.captured",
            payload = new
            {
                payment = new
                {
                    entity = new
                    {
                        id = webhookPaymentId,
                        order_id = orderId,
                        amount = (long)(expectedTotal * 100m),
                        currency = "INR",
                        status = "captured"
                    }
                }
            }
        });

        var secret = "brocomod_test_webhook_secret";
        var signature = DevelopmentFakePaymentGateway.ComputeHmacSha256(webhookPayload, secret);

        var webhookReq = new HttpRequestMessage(HttpMethod.Post, "/api/v1/payments/webhook/DevelopmentFake")
        {
            Content = new StringContent(webhookPayload, System.Text.Encoding.UTF8, "application/json")
        };
        webhookReq.Headers.Add("X-Razorpay-Signature", signature);

        var webhookResponse = await _client.SendAsync(webhookReq);
        webhookResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // Assert: Database state
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var payment = await db.Payments.FirstOrDefaultAsync(p => p.Id == initBody.Data.PaymentId);
        payment.Should().NotBeNull();
        payment!.Status.Should().Be(PaymentStatus.Paid);
        payment.GatewayPaymentId.Should().Be(webhookPaymentId);

        var invoice = await db.Invoices.FirstOrDefaultAsync(i => i.PaymentId == payment.Id);
        invoice.Should().NotBeNull();
        invoice!.Status.Should().Be(InvoiceStatus.Paid);
    }

    [Fact]
    public async Task Scenario04_Data_Isolation_Customer_Cannot_Access_Others_Payment_Or_Invoice()
    {
        // Arrange: Customer A creates and pays
        var (_, _, customerQuotationId, custTokenA, _) = await CreateAcceptedCustomerQuotationAsync();
        var clientA = CreateAuthenticatedClient(custTokenA);

        var initRes = await clientA.PostAsJsonAsync("/api/v1/customer/payments/initiate", new InitiatePaymentRequestDto(customerQuotationId));
        var initBody = await initRes.Content.ReadFromJsonAsync<ApiResponse<InitiatePaymentResponseDto>>(JsonOptions);
        var paymentId = initBody!.Data!.PaymentId;

        var fakePaymentId = $"pay_iso_{Guid.NewGuid():N}";
        await clientA.PostAsJsonAsync("/api/v1/customer/payments/verify", new VerifyPaymentRequestDto(paymentId, fakePaymentId));

        // Register Customer B
        var custEmailB = $"isolated_cust_{Guid.NewGuid():N}@brocomod.com";
        await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest(
            custEmailB, "Password123!", "Isolated Customer", "+91 95555 44444"));
        var custTokenB = await AuthenticateAsync(custEmailB, "Password123!");
        var clientB = CreateAuthenticatedClient(custTokenB);

        // Act & Assert: Customer B cannot access Customer A's payment
        var getPaymentResponse = await clientB.GetAsync($"/api/v1/customer/payments/{paymentId}");
        getPaymentResponse.StatusCode.Should().BeOneOf(HttpStatusCode.NotFound, HttpStatusCode.Unauthorized, HttpStatusCode.Forbidden);

        // Act & Assert: Customer B cannot access Customer A's invoice
        var getInvoiceResponse = await clientB.GetAsync($"/api/v1/customer/invoices/by-payment/{paymentId}");
        getInvoiceResponse.StatusCode.Should().BeOneOf(HttpStatusCode.NotFound, HttpStatusCode.Unauthorized, HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Scenario05_Data_Isolation_Garage_Cannot_Access_Others_Settlement()
    {
        // Arrange
        var (_, garageId, customerQuotationId, custToken, _) = await CreateAcceptedCustomerQuotationAsync();
        var customerClient = CreateAuthenticatedClient(custToken);

        var initRes = await customerClient.PostAsJsonAsync("/api/v1/customer/payments/initiate", new InitiatePaymentRequestDto(customerQuotationId));
        initRes.EnsureSuccessStatusCode();
        var initBody = await initRes.Content.ReadFromJsonAsync<ApiResponse<InitiatePaymentResponseDto>>(JsonOptions);
        var fakePaymentId = $"pay_settle_iso_{Guid.NewGuid():N}";
        var verifyRes = await customerClient.PostAsJsonAsync(
            "/api/v1/customer/payments/verify",
            new VerifyPaymentRequestDto(initBody!.Data!.PaymentId, fakePaymentId, "sig_fake_valid", initBody.Data.GatewayOrderId));
        verifyRes.EnsureSuccessStatusCode();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var settlement = await db.GarageSettlements.FirstOrDefaultAsync(s => s.PaymentId == initBody.Data.PaymentId);
        settlement.Should().NotBeNull();

        // Register a distinct second garage user
        var diffGarage = new Garage("Other Workshop", $"other_{Guid.NewGuid():N}@garage.com", "+91 91111 22222", "Other St", 77.60, 12.98);
        db.Garages.Add(diffGarage);
        await db.SaveChangesAsync();

        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
        var hash = hasher.HashPassword("Password123!", out var salt);
        var otherEmail = $"other.garage.{Guid.NewGuid():N}@test.com";
        var otherUser = new User(otherEmail, "Other Garage Owner", "+91 91111 22222", hash, salt);
        db.Users.Add(otherUser);
        await db.SaveChangesAsync();

        var garageRole = await db.Roles.FirstAsync(r => r.Name == AppRoles.GarageOwner);
        db.UserRoles.Add(new BroCoMod.Domain.Entities.Identity.UserRole { UserId = otherUser.Id, RoleId = garageRole.Id });
        db.GarageUsers.Add(new GarageUser(otherUser.Id, diffGarage.Id, AppRoles.GarageOwner, "Owner"));
        await db.SaveChangesAsync();

        var otherGarageToken = await AuthenticateAsync(otherEmail, "Password123!");
        var otherGarageClient = CreateAuthenticatedClient(otherGarageToken);

        // Act: Attempt to access Garage A's settlement
        var res = await otherGarageClient.GetAsync($"/api/v1/garage/finance/settlements/{settlement!.Id}");
        res.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Scenario06_Admin_Finance_Overview_Real_SQL_Aggregates_And_Refund()
    {
        // Arrange: Pay a quote
        var (_, _, customerQuotationId, custToken, total) = await CreateAcceptedCustomerQuotationAsync();
        var customerClient = CreateAuthenticatedClient(custToken);

        var initRes = await customerClient.PostAsJsonAsync("/api/v1/customer/payments/initiate", new InitiatePaymentRequestDto(customerQuotationId));
        initRes.EnsureSuccessStatusCode();
        var initBody = await initRes.Content.ReadFromJsonAsync<ApiResponse<InitiatePaymentResponseDto>>(JsonOptions);
        var paymentId = initBody!.Data!.PaymentId;
        var fakePaymentId = $"pay_admin_{Guid.NewGuid():N}";
        var verifyRes = await customerClient.PostAsJsonAsync(
            "/api/v1/customer/payments/verify",
            new VerifyPaymentRequestDto(paymentId, fakePaymentId, "sig_fake_valid", initBody.Data.GatewayOrderId));
        verifyRes.EnsureSuccessStatusCode();

        // Admin authentication
        var adminToken = await AuthenticateAsync("admin@brocomod.com", "Password123!");
        var adminClient = CreateAuthenticatedClient(adminToken);

        // Act 1: Get Finance Overview
        var overviewRes = await adminClient.GetAsync("/api/v1/admin/finance/overview");
        overviewRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var overviewBody = await overviewRes.Content.ReadFromJsonAsync<ApiResponse<FinanceOverviewDto>>(JsonOptions);
        overviewBody.Should().NotBeNull();
        overviewBody!.Data!.TotalGrossRevenue.Should().BeGreaterThan(0m);
        overviewBody.Data.TotalPlatformRevenue.Should().BeGreaterThan(0m);
        overviewBody.Data.TotalPaymentsCount.Should().BeGreaterThan(0);

        // Act 2: Process Partial Refund
        var refundRes = await adminClient.PostAsJsonAsync(
            $"/api/v1/admin/finance/payments/{paymentId}/refund",
            new RefundPaymentRequestDto(500m, "Customer courtesy goodwill credit")
        );
        refundRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var refundBody = await refundRes.Content.ReadFromJsonAsync<ApiResponse<PaymentDto>>(JsonOptions);
        refundBody!.Data!.Status.Should().Be("PartiallyRefunded");
        refundBody.Data.RefundedAmount.Should().Be(500m);

        // Act 3: Check Admin Payments filter
        var paymentsRes = await adminClient.GetAsync("/api/v1/admin/finance/payments?status=PartiallyRefunded");
        paymentsRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var paymentsBody = await paymentsRes.Content.ReadFromJsonAsync<ApiResponse<PagedResult<PaymentDto>>>(JsonOptions);
        paymentsBody!.Data!.Items.Should().Contain(p => p.Id == paymentId);
    }
}
