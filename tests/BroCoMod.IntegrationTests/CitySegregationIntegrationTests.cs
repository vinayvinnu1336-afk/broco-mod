using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using BroCoMod.Application.DTOs;
using BroCoMod.Domain.Constants;
using BroCoMod.Domain.Enums;
using BroCoMod.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BroCoMod.IntegrationTests;

/// <summary>
/// Accounts per city: advisors only see and act on their own city's requests, bookings go to an advisor and garages
/// of their city, admins add garages and remove advisors (whose open bookings move to the same city's advisors).
/// Every test creates its own advisors, garages and customers (package bookings, so no garage is dispatched and no
/// commission is created) and removes or deactivates the advisors and garages it made in <c>finally</c>.
/// </summary>
public class CitySegregationIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private const string Password = "Password123!";
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    private readonly WebApplicationFactory<Program> _factory;

    public CitySegregationIntegrationTests(WebApplicationFactory<Program> factory) => _factory = factory;

    // ------------------------------------------------------------------ places

    private sealed record Place(double Lat, double Lng, string Pincode, string Area, string City, string State);

    private static readonly Place Hyderabad = new(17.4126, 78.4482, "500034", "Banjara Hills", "Hyderabad", "Telangana");
    private static readonly Place Bengaluru = new(12.9719, 77.6412, "560038", "Indiranagar", "Bengaluru", "Karnataka");
    private static readonly Place Mancherial = new(18.8700, 79.4460, "504208", "Ramnagar", "Mancherial", "Telangana");

    // ------------------------------------------------------------------ helpers

    private static string NewEmail(string prefix) => $"{prefix}_{Guid.NewGuid():N}@brocomod.com";

    private async Task<AuthResponse> LoginAsync(string? email, string password, string? mobile = null)
    {
        var response = await _factory.CreateClient().PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, password, mobile));
        response.StatusCode.Should().Be(HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        return (await response.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(JsonOptions))!.Data!;
    }

    private HttpClient ClientWith(string token)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private async Task<HttpClient> SignedInAsync(string email) => ClientWith((await LoginAsync(email, Password)).AccessToken);

    private static async Task<ApiResponse<T>> BodyAsync<T>(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<ApiResponse<T>>(JsonOptions))!;

    private sealed record TestAdvisor(Guid ProfileId, Guid UserId, string Mobile, HttpClient Client);

    private async Task<TestAdvisor> NewAdvisorAsync(HttpClient admin, string city, int maxAssigned = 25)
    {
        var mobile = TestMobiles.NewNational();
        var response = await admin.PostAsJsonAsync("/api/v1/admin/advisors",
            new CreateAdvisorRequest($"{city} Advisor", mobile, NewEmail("city_adv"), MaxAssignedRequests: maxAssigned, Password: Password, City: city));
        response.StatusCode.Should().Be(HttpStatusCode.Created, await response.Content.ReadAsStringAsync());
        var created = (await BodyAsync<CreatedAdvisorDto>(response)).Data!;
        created.Advisor.City.Should().Be(city);
        var auth = await LoginAsync(null, Password, mobile);
        return new TestAdvisor(created.Advisor.Id, created.Advisor.UserId, mobile, ClientWith(auth.AccessToken));
    }

    private async Task<(HttpClient Client, Guid VehicleId)> NewCustomerWithCarAsync()
    {
        var email = NewEmail("city_cust");
        (await _factory.CreateClient().PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest(email, Password, "City Customer", TestMobiles.New())))
            .EnsureSuccessStatusCode();
        var customer = await SignedInAsync(email);

        var makes = await customer.GetFromJsonAsync<ApiResponse<List<VehicleManufacturerDto>>>("/api/v1/vehicle-manufacturers", JsonOptions);
        var maruti = makes!.Data!.Single(m => m.Name == "Maruti Suzuki");
        var models = await customer.GetFromJsonAsync<ApiResponse<List<VehicleModelDto>>>($"/api/v1/vehicle-manufacturers/{maruti.Id}/models", JsonOptions);
        var swift = models!.Data!.Single(m => m.Name == "Swift");

        var json = $$"""
        { "manufacturerId": "{{maruti.Id}}", "modelId": "{{swift.Id}}", "year": 2022, "fuelType": "Petrol",
          "transmission": "Manual", "licensePlate": "TS-10-{{Random.Shared.Next(1000, 9999)}}", "mileage": 12000, "color": "White" }
        """;
        var res = await customer.PostAsync("/api/v1/customer/vehicles", new StringContent(json, Encoding.UTF8, "application/json"));
        res.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        return (customer, doc.RootElement.GetProperty("data").GetProperty("id").GetGuid());
    }

    /// <summary>A fixed-price Basic package booking: never sent to garages for quotes, so nothing else is touched.</summary>
    private async Task<ServiceRequestDetailDto> BookPackageAsync(Place place, double? lat = null, double? lng = null)
    {
        var (customer, vehicleId) = await NewCustomerWithCarAsync();
        var response = await customer.PostAsJsonAsync("/api/v1/customer/requests", new CreateServiceBookingRequest(
            vehicleId, "Plot 7, Road No. 3", place.Area, place.City, place.State, place.Pincode, "India",
            lat ?? place.Lat, lng ?? place.Lng, ProblemDescription: "", ServiceCategory: null, PackageCode: "BASIC"));
        response.IsSuccessStatusCode.Should().BeTrue(await response.Content.ReadAsStringAsync());
        return (await BodyAsync<ServiceRequestDetailDto>(response)).Data!;
    }

    private async Task<string?> AssignedAdvisorCityAsync(Guid requestId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await db.ServiceRequests.AsNoTracking().Where(sr => sr.Id == requestId)
            .Select(sr => sr.AssignedAdvisor != null ? sr.AssignedAdvisor.City : null).SingleAsync();
    }

    private async Task<Guid?> AssignedAdvisorAsync(Guid requestId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await db.ServiceRequests.AsNoTracking().Where(sr => sr.Id == requestId).Select(sr => sr.AssignedAdvisorId).SingleAsync();
    }

    private async Task<CreatedGarageAccountDto> NewGarageAsync(HttpClient admin, double lat, double lng, string? city = null, bool verified = true)
    {
        var response = await admin.PostAsJsonAsync("/api/v1/admin/garages", new CreateGarageAccountRequest(
            $"City Test Motors {Guid.NewGuid():N}"[..30], "Suresh Reddy", TestMobiles.NewNational(), NewEmail("city_garage"),
            "Plot 12, Test Road", lat, lng, City: city, Verified: verified));
        response.StatusCode.Should().Be(HttpStatusCode.Created, await response.Content.ReadAsStringAsync());
        return (await BodyAsync<CreatedGarageAccountDto>(response)).Data!;
    }

    private static async Task RemoveQuietlyAsync(HttpClient admin, TestAdvisor? advisor)
    {
        if (advisor != null) await admin.DeleteAsync($"/api/v1/admin/advisors/{advisor.ProfileId}");
    }

    private static async Task DeactivateGarageQuietlyAsync(HttpClient admin, CreatedGarageAccountDto? garage)
    {
        if (garage == null) return;
        await admin.PostAsJsonAsync($"/api/v1/admin/garages/{garage.Garage.Id}/deactivate", new DeactivateGarageRequest("Test cleanup"));
        await admin.PostAsJsonAsync($"/api/v1/admin/users/{garage.OwnerUserId}/status", new { isActive = false });
    }

    // ------------------------------------------------------------------ city scoping

    [Fact]
    public async Task BengaluruAdvisor_CannotSeeOrActOnAHyderabadRequest_AndListsOnlyTheirCity()
    {
        var admin = await SignedInAsync("admin@brocomod.com");
        TestAdvisor? bengaluruAdvisor = null;
        try
        {
            bengaluruAdvisor = await NewAdvisorAsync(admin, "Bengaluru");
            var profile = await bengaluruAdvisor.Client.GetFromJsonAsync<ApiResponse<AdvisorProfileDto>>("/api/v1/advisor/profile", JsonOptions);
            profile!.Data!.City.Should().Be("Bengaluru");

            var hyderabadRequest = await BookPackageAsync(Hyderabad);
            var bengaluruRequest = await BookPackageAsync(Bengaluru);
            hyderabadRequest.City.Should().Be("Hyderabad");
            bengaluruRequest.City.Should().Be("Bengaluru");

            // New bookings go to an advisor of their own city.
            (await AssignedAdvisorCityAsync(hyderabadRequest.Id)).Should().Be("Hyderabad");
            (await AssignedAdvisorCityAsync(bengaluruRequest.Id)).Should().Be("Bengaluru");

            var blr = bengaluruAdvisor.Client;
            (await blr.GetAsync($"/api/v1/advisor/requests/{hyderabadRequest.Id}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
            (await blr.GetAsync($"/api/v1/advisor/requests/{hyderabadRequest.Id}/package-garages")).StatusCode.Should().Be(HttpStatusCode.NotFound);
            (await blr.GetAsync($"/api/v1/advisor/requests/{hyderabadRequest.Id}/notes")).StatusCode.Should().Be(HttpStatusCode.NotFound);
            (await blr.PostAsJsonAsync($"/api/v1/advisor/requests/{hyderabadRequest.Id}/notes", new { note = "Not my city" }))
                .StatusCode.Should().Be(HttpStatusCode.NotFound);
            (await blr.PostAsJsonAsync($"/api/v1/advisor/requests/{hyderabadRequest.Id}/package-assignment", new { garageId = Guid.NewGuid() }))
                .StatusCode.Should().Be(HttpStatusCode.NotFound);
            (await blr.GetAsync($"/api/v1/advisor/customer-quotations?serviceRequestId={hyderabadRequest.Id}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
            (await blr.GetAsync($"/api/v1/advisor/requests/{bengaluruRequest.Id}")).StatusCode.Should().Be(HttpStatusCode.OK);

            var list = await blr.GetFromJsonAsync<ApiResponse<PagedResult<AdvisorServiceRequestSummaryDto>>>("/api/v1/advisor/requests?pageSize=50", JsonOptions);
            list!.Data!.Items.Should().Contain(r => r.Id == bengaluruRequest.Id);
            list.Data.Items.Should().NotContain(r => r.Id == hyderabadRequest.Id);
            // Asking for another city's list still only gives their own city.
            var asked = await blr.GetFromJsonAsync<ApiResponse<PagedResult<AdvisorServiceRequestSummaryDto>>>("/api/v1/advisor/requests?pageSize=50&city=Hyderabad", JsonOptions);
            asked!.Data!.Items.Should().NotContain(r => r.Id == hyderabadRequest.Id);

            var queue = await blr.GetFromJsonAsync<ApiResponse<AdvisorWorkQueueDto>>("/api/v1/advisor/work-queue", JsonOptions);
            (queue!.Data!.PackageBookingsToAssign ?? new List<AdvisorPackageBookingQueueItemDto>()).Should().NotContain(r => r.Id == hyderabadRequest.Id);
            queue.Data.NewRequests.Should().NotContain(r => r.Id == hyderabadRequest.Id);

            // And the other way round: the Hyderabad demo advisor doesn't get the Bengaluru booking.
            var hyd = await SignedInAsync("advisor@brocomod.com");
            (await hyd.GetAsync($"/api/v1/advisor/requests/{bengaluruRequest.Id}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
            (await hyd.GetAsync($"/api/v1/advisor/requests/{hyderabadRequest.Id}")).StatusCode.Should().Be(HttpStatusCode.OK);

            // Admins see every city, with a City filter on the lists.
            (await admin.GetAsync($"/api/v1/advisor/requests/{hyderabadRequest.Id}")).StatusCode.Should().Be(HttpStatusCode.OK);
            var adminList = await admin.GetFromJsonAsync<ApiResponse<PagedResult<AdminRequestSummaryDto>>>(
                $"/api/v1/admin/requests?search={bengaluruRequest.RequestNumber}&city=Bengaluru", JsonOptions);
            adminList!.Data!.Items.Should().ContainSingle(r => r.Id == bengaluruRequest.Id);
            var wrongCity = await admin.GetFromJsonAsync<ApiResponse<PagedResult<AdminRequestSummaryDto>>>(
                $"/api/v1/admin/requests?search={bengaluruRequest.RequestNumber}&city=Hyderabad", JsonOptions);
            wrongCity!.Data!.Items.Should().BeEmpty();
            var advisors = await admin.GetFromJsonAsync<ApiResponse<PagedResult<AdminAdvisorListDto>>>(
                $"/api/v1/admin/advisors?search={bengaluruAdvisor.Mobile}&city=Bengaluru", JsonOptions);
            advisors!.Data!.Items.Should().ContainSingle(a => a.Id == bengaluruAdvisor.ProfileId && a.City == "Bengaluru");
            (await admin.GetFromJsonAsync<ApiResponse<PagedResult<AdminAdvisorListDto>>>(
                $"/api/v1/admin/advisors?search={bengaluruAdvisor.Mobile}&city=Hyderabad", JsonOptions))!.Data!.Items.Should().BeEmpty();
            (await admin.GetAsync("/api/v1/admin/dashboard?city=Bengaluru")).StatusCode.Should().Be(HttpStatusCode.OK);
        }
        finally
        {
            await RemoveQuietlyAsync(admin, bengaluruAdvisor);
        }
    }

    [Fact]
    public async Task PackageGarageCandidates_OnlyComeFromTheRequestsCity_AndAnAdvisorCannotAssignAnotherCitysGarage()
    {
        var admin = await SignedInAsync("admin@brocomod.com");
        CreatedGarageAccountDto? garage = null;
        try
        {
            // A garage right next to the Bengaluru customer.
            garage = await NewGarageAsync(admin, Bengaluru.Lat + 0.002, Bengaluru.Lng + 0.002);
            garage.Garage.City.Should().Be("Bengaluru");
            var request = await BookPackageAsync(Bengaluru);

            var candidates = await admin.GetFromJsonAsync<ApiResponse<List<PackageGarageCandidateDto>>>($"/api/v1/advisor/requests/{request.Id}/package-garages", JsonOptions);
            candidates!.Data.Should().Contain(g => g.GarageId == garage.Garage.Id);
            candidates.Data.Should().NotContain(g => g.Name == "Central Metro Motors");

            // Moved to Hyderabad by an admin, it is no longer a candidate even though it is still inside the radius.
            var moved = await admin.PutAsJsonAsync($"/api/v1/admin/garages/{garage.Garage.Id}/city", new UpdateGarageCityRequest("hyderabad"));
            moved.StatusCode.Should().Be(HttpStatusCode.OK, await moved.Content.ReadAsStringAsync());
            (await BodyAsync<AdminGarageListDto>(moved)).Data!.City.Should().Be("Hyderabad");

            candidates = await admin.GetFromJsonAsync<ApiResponse<List<PackageGarageCandidateDto>>>($"/api/v1/advisor/requests/{request.Id}/package-garages", JsonOptions);
            candidates!.Data.Should().NotContain(g => g.GarageId == garage.Garage.Id);

            var garages = await admin.GetFromJsonAsync<ApiResponse<PagedResult<AdminGarageListDto>>>(
                $"/api/v1/admin/garages?search={Uri.EscapeDataString(garage.Garage.Name)}&city=Hyderabad", JsonOptions);
            garages!.Data!.Items.Should().ContainSingle(g => g.Id == garage.Garage.Id && g.City == "Hyderabad");

            (await admin.PutAsJsonAsync($"/api/v1/admin/garages/{garage.Garage.Id}/city", new UpdateGarageCityRequest("Chennai")))
                .StatusCode.Should().Be(HttpStatusCode.BadRequest);
        }
        finally
        {
            await DeactivateGarageQuietlyAsync(admin, garage);
        }
    }

    // ------------------------------------------------------------------ remove advisor

    [Fact]
    public async Task RemovingAnAdvisor_HidesThem_BlocksSignIn_AndMovesOpenRequestsToTheSameCity()
    {
        var admin = await SignedInAsync("admin@brocomod.com");
        TestAdvisor? first = null, second = null;
        try
        {
            // Mancherial: this test's own advisors take the city's bookings.
            first = await NewAdvisorAsync(admin, "Mancherial", maxAssigned: 50);
            second = await NewAdvisorAsync(admin, "Mancherial", maxAssigned: 50);

            var open = await BookPackageAsync(Mancherial);
            var past = await BookPackageAsync(Mancherial);
            open.City.Should().Be("Mancherial");
            var owner = await AssignedAdvisorAsync(open.Id);
            new Guid?[] { first.ProfileId, second.ProfileId }.Should().Contain(owner);
            var (leaving, staying) = owner == first.ProfileId ? (first, second) : (second, first);

            // The past request belongs to the leaving advisor and is already finished.
            using (var scope = _factory.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                await db.ServiceRequests.Where(sr => sr.Id == past.Id).ExecuteUpdateAsync(s => s
                    .SetProperty(sr => sr.AssignedAdvisorId, leaving.ProfileId)
                    .SetProperty(sr => sr.Status, ServiceRequestStatus.Cancelled));
            }

            var preview = await admin.GetFromJsonAsync<ApiResponse<AdvisorRemovalPreviewDto>>($"/api/v1/admin/advisors/{leaving.ProfileId}/removal", JsonOptions);
            preview!.Data!.OpenRequestsCount.Should().BeGreaterThanOrEqualTo(1);
            preview.Data.OtherAdvisorsInCity.Should().BeGreaterThanOrEqualTo(1);

            // Only admins can remove, and not themselves.
            (await staying.Client.DeleteAsync($"/api/v1/admin/advisors/{leaving.ProfileId}")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
            (await admin.DeleteAsync($"/api/v1/admin/advisors/{Guid.NewGuid()}")).StatusCode.Should().Be(HttpStatusCode.NotFound);

            var response = await admin.DeleteAsync($"/api/v1/admin/advisors/{leaving.ProfileId}");
            response.StatusCode.Should().Be(HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
            var removed = (await BodyAsync<RemovedAdvisorDto>(response)).Data!;
            // Other classes may book in Mancherial meanwhile, so at least the ones counted in the preview moved.
            removed.ReassignedCount.Should().BeGreaterThanOrEqualTo(preview.Data.OpenRequestsCount);
            removed.LeftUnassignedCount.Should().Be(0);
            removed.ReassignedOutsideCityCount.Should().Be(0);
            removed.Reassignments.Should().Contain(r => r.AdvisorId == staying.ProfileId && r.City == "Mancherial");

            // Open request moved within Mancherial; the finished one keeps its advisor, shown as "Former advisor".
            (await AssignedAdvisorAsync(open.Id)).Should().Be(staying.ProfileId);
            (await AssignedAdvisorAsync(past.Id)).Should().Be(leaving.ProfileId);
            var detail = await admin.GetFromJsonAsync<ApiResponse<AdminRequestOperationalDetailDto>>($"/api/v1/admin/requests/{past.Id}", JsonOptions);
            detail!.Data!.AssignedAdvisorName.Should().Be("Former advisor");

            // Gone from the list, can't sign in, can't be brought back, and the old session is over.
            var list = await admin.GetFromJsonAsync<ApiResponse<PagedResult<AdminAdvisorListDto>>>($"/api/v1/admin/advisors?search={leaving.Mobile}", JsonOptions);
            list!.Data!.Items.Should().BeEmpty();
            var login = await _factory.CreateClient().PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(null, Password, leaving.Mobile));
            login.IsSuccessStatusCode.Should().BeFalse();
            (await admin.PostAsync($"/api/v1/admin/advisors/{leaving.ProfileId}/activate", null)).StatusCode.Should().Be(HttpStatusCode.NotFound);
            (await admin.PostAsJsonAsync($"/api/v1/admin/users/{leaving.UserId}/status", new { isActive = true })).IsSuccessStatusCode.Should().BeFalse();
            (await admin.DeleteAsync($"/api/v1/admin/advisors/{leaving.ProfileId}")).StatusCode.Should().Be(HttpStatusCode.NotFound);

            using (var scope = _factory.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                (await db.RefreshTokens.AnyAsync(t => t.UserId == leaving.UserId && t.RevokedAtUtc == null)).Should().BeFalse();
                (await db.AuditLogs.AnyAsync(a => a.Action == "ADMIN_ADVISOR_REMOVED" && a.EntityId == leaving.ProfileId.ToString())).Should().BeTrue();
            }

            // The advisor who took over now sees the moved booking.
            (await staying.Client.GetAsync($"/api/v1/advisor/requests/{open.Id}")).StatusCode.Should().Be(HttpStatusCode.OK);
        }
        finally
        {
            await RemoveQuietlyAsync(admin, first);
            await RemoveQuietlyAsync(admin, second);
        }
    }

    [Fact]
    public async Task AnAdminCannotRemoveThemselves_NorANonAdvisorAccount()
    {
        var admin = await SignedInAsync("admin@brocomod.com");
        TestAdvisor? advisor = null;
        try
        {
            // An advisor who is also an admin signs in and tries to remove their own advisor account.
            advisor = await NewAdvisorAsync(admin, "Hyderabad", maxAssigned: 1);
            using (var scope = _factory.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                var superAdmin = await db.Roles.SingleAsync(r => r.NormalizedName == AppRoles.SuperAdmin);
                db.UserRoles.Add(new BroCoMod.Domain.Entities.Identity.UserRole { UserId = advisor.UserId, RoleId = superAdmin.Id });
                await db.SaveChangesAsync();
            }
            var asAdmin = ClientWith((await LoginAsync(null, Password, advisor.Mobile)).AccessToken);

            var self = await asAdmin.DeleteAsync($"/api/v1/admin/advisors/{advisor.ProfileId}");
            self.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            (await self.Content.ReadAsStringAsync()).Should().Contain("CANNOT_REMOVE_SELF");

            // For anyone else this account is an administrator, which isn't removed from Advisors.
            (await admin.DeleteAsync($"/api/v1/admin/advisors/{advisor.ProfileId}")).StatusCode.Should().Be(HttpStatusCode.BadRequest);

            // A customer account isn't an advisor at all.
            var customerEmail = NewEmail("city_not_adv");
            var registered = await _factory.CreateClient().PostAsJsonAsync("/api/v1/auth/register",
                new RegisterRequest(customerEmail, Password, "Not An Advisor", TestMobiles.New()));
            var customerUserId = (await BodyAsync<AuthResponse>(registered)).Data!.User.Id;
            (await admin.DeleteAsync($"/api/v1/admin/advisors/{customerUserId}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        }
        finally
        {
            if (advisor != null)
            {
                using var scope = _factory.Services.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                var superAdminId = await db.Roles.Where(r => r.NormalizedName == AppRoles.SuperAdmin).Select(r => r.Id).SingleAsync();
                await db.UserRoles.Where(ur => ur.UserId == advisor.UserId && ur.RoleId == superAdminId).ExecuteDeleteAsync();
                await RemoveQuietlyAsync(admin, advisor);
            }
        }
    }

    // ------------------------------------------------------------------ admin creates a garage

    [Fact]
    public async Task AdminCreatesAGarage_OwnerSignsInByMobile_AndTheGarageIsACandidateInItsCity()
    {
        var admin = await SignedInAsync("admin@brocomod.com");
        CreatedGarageAccountDto? garage = null;
        try
        {
            const double lat = 17.4485, lng = 78.3908; // Hitech City, Hyderabad
            var ownerMobile = TestMobiles.NewNational();
            var ownerEmail = NewEmail("city_owner");
            var response = await admin.PostAsJsonAsync("/api/v1/admin/garages", new CreateGarageAccountRequest(
                "  Hitech   City Car Care ", "Lakshmi Prasad", ownerMobile, ownerEmail.ToUpperInvariant(), "Plot 3, Madhapur, Hyderabad 500081", lat, lng));
            response.StatusCode.Should().Be(HttpStatusCode.Created, await response.Content.ReadAsStringAsync());
            response.Headers.CacheControl!.NoStore.Should().BeTrue();
            garage = (await BodyAsync<CreatedGarageAccountDto>(response)).Data!;

            garage.Garage.Name.Should().Be("Hitech City Car Care");
            garage.Garage.City.Should().Be("Hyderabad");
            garage.Garage.Status.Should().Be(GarageStatus.Verified);
            garage.Garage.IsOperational.Should().BeTrue();
            garage.Garage.PhoneNumber.Should().Be(TestMobiles.Canonical(ownerMobile));
            garage.Garage.Email.Should().Be(ownerEmail);
            garage.PasswordGenerated.Should().BeTrue();
            garage.TemporaryPassword.Should().NotBeNullOrEmpty();
            garage.LoginMobile.Should().Be(TestMobiles.Canonical(ownerMobile));

            // The owner signs in with the mobile and the one-time password and lands in the garage portal.
            var auth = await LoginAsync(null, garage.TemporaryPassword!, ownerMobile);
            auth.User.Roles.Should().Contain(AppRoles.GarageOwner);
            var owner = ClientWith(auth.AccessToken);
            (await owner.GetAsync("/api/v1/garage/dashboard")).StatusCode.Should().Be(HttpStatusCode.OK);

            using (var scope = _factory.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                (await db.GarageUsers.AnyAsync(gu => gu.UserId == garage.OwnerUserId && gu.GarageId == garage.Garage.Id && gu.RoleName == AppRoles.GarageOwner)).Should().BeTrue();
                var audit = await db.AuditLogs.AsNoTracking().Where(a => a.EntityId == garage.Garage.Id.ToString()).ToListAsync();
                audit.Should().Contain(a => a.Action == "ADMIN_GARAGE_CREATED");
                audit.Should().NotContain(a => a.Details != null && a.Details.Contains(garage.TemporaryPassword!));
            }

            // A Hyderabad booking next to it lists it as a candidate garage.
            var request = await BookPackageAsync(Hyderabad with { Pincode = "500081", Area = "Madhapur" }, lat + 0.001, lng + 0.001);
            var candidates = await admin.GetFromJsonAsync<ApiResponse<List<PackageGarageCandidateDto>>>($"/api/v1/advisor/requests/{request.Id}/package-garages", JsonOptions);
            candidates!.Data.Should().Contain(g => g.GarageId == garage.Garage.Id);

            // The same mobile or email can't be used again; nor can an existing customer's mobile.
            var sameMobile = await admin.PostAsJsonAsync("/api/v1/admin/garages", new CreateGarageAccountRequest(
                "Another Garage", "Other Owner", ownerMobile, NewEmail("city_owner2"), "Plot 4, Madhapur", lat, lng));
            sameMobile.StatusCode.Should().Be(HttpStatusCode.Conflict);
            (await sameMobile.Content.ReadAsStringAsync()).Should().Contain(AdvisorAccountErrors.MobileTaken);
            var sameEmail = await admin.PostAsJsonAsync("/api/v1/admin/garages", new CreateGarageAccountRequest(
                "Another Garage", "Other Owner", TestMobiles.NewNational(), ownerEmail, "Plot 4, Madhapur", lat, lng));
            sameEmail.StatusCode.Should().Be(HttpStatusCode.Conflict);
            (await sameEmail.Content.ReadAsStringAsync()).Should().Contain(AdvisorAccountErrors.EmailTaken);

            var customerMobile = TestMobiles.NewNational();
            (await _factory.CreateClient().PostAsJsonAsync("/api/v1/auth/register",
                new RegisterRequest(NewEmail("city_cust_owner"), Password, "Existing Customer", customerMobile))).EnsureSuccessStatusCode();
            var customerMobileTaken = await admin.PostAsJsonAsync("/api/v1/admin/garages", new CreateGarageAccountRequest(
                "Another Garage", "Other Owner", customerMobile, NewEmail("city_owner3"), "Plot 4, Madhapur", lat, lng));
            customerMobileTaken.StatusCode.Should().Be(HttpStatusCode.Conflict);
            (await customerMobileTaken.Content.ReadAsStringAsync()).Should().Contain("customer account");

            // The pin must be inside a live city.
            (await admin.PostAsJsonAsync("/api/v1/admin/garages", new CreateGarageAccountRequest(
                "Chennai Garage", "Other Owner", TestMobiles.NewNational(), NewEmail("city_owner4"), "T. Nagar, Chennai", 13.0827, 80.2707)))
                .StatusCode.Should().Be(HttpStatusCode.BadRequest);

            // Only admins add garages.
            var advisor = await SignedInAsync("advisor@brocomod.com");
            (await advisor.PostAsJsonAsync("/api/v1/admin/garages", new CreateGarageAccountRequest(
                "Nope Garage", "Nope", TestMobiles.NewNational(), NewEmail("city_nope"), "Plot 4, Madhapur", lat, lng)))
                .StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }
        finally
        {
            await DeactivateGarageQuietlyAsync(admin, garage);
        }
    }

    [Fact]
    public async Task AdminCreatesAnUnverifiedGarage_WithAChosenPassword_ItStaysOutOfMatching()
    {
        var admin = await SignedInAsync("admin@brocomod.com");
        CreatedGarageAccountDto? garage = null;
        try
        {
            var ownerMobile = TestMobiles.NewNational();
            var response = await admin.PostAsJsonAsync("/api/v1/admin/garages", new CreateGarageAccountRequest(
                "Pending Garage", "Pending Owner", ownerMobile, NewEmail("city_pending"), "Main Road, Mancherial",
                Mancherial.Lat + 0.002, Mancherial.Lng, Verified: false, Password: "Chosen-pass-123"));
            response.StatusCode.Should().Be(HttpStatusCode.Created, await response.Content.ReadAsStringAsync());
            garage = (await BodyAsync<CreatedGarageAccountDto>(response)).Data!;
            garage.Garage.City.Should().Be("Mancherial");
            garage.Garage.Status.Should().Be(GarageStatus.PendingVerification);
            garage.PasswordGenerated.Should().BeFalse();
            garage.TemporaryPassword.Should().BeNull();
            (await LoginAsync(null, "Chosen-pass-123", ownerMobile)).User.Roles.Should().Contain(AppRoles.GarageOwner);

            var request = await BookPackageAsync(Mancherial);
            var candidates = await admin.GetFromJsonAsync<ApiResponse<List<PackageGarageCandidateDto>>>($"/api/v1/advisor/requests/{request.Id}/package-garages", JsonOptions);
            candidates!.Data.Should().NotContain(g => g.GarageId == garage.Garage.Id);
        }
        finally
        {
            await DeactivateGarageQuietlyAsync(admin, garage);
        }
    }
}
