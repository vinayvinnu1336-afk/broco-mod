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
using BroCoMod.Infrastructure.Persistence;
using BroCoMod.Infrastructure.Services.Media;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BroCoMod.IntegrationTests;

/// <summary>API host that keeps uploaded media in its own temp folder and removes it afterwards.</summary>
public class MediaTestFactory : WebApplicationFactory<Program>
{
    public string MediaRoot { get; } = Path.Combine(Path.GetTempPath(), "broco-media-tests", Guid.NewGuid().ToString("N"));

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("Media:StoragePath", MediaRoot);
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        try
        {
            if (Directory.Exists(MediaRoot)) Directory.Delete(MediaRoot, recursive: true);
        }
        catch (IOException)
        {
            // A file still open on a slow CI disk; the OS temp cleaner removes it later.
        }
    }
}

/// <summary>
/// Photos and videos on service requests: garages upload on their own jobs, advisors and admins manage
/// everything, customers only see what is shown to them, and files stream through signed links.
/// Every test books its own package job at Central Metro and leaves it before handover (no commission).
/// </summary>
public class ServiceMediaIntegrationTests : IClassFixture<MediaTestFactory>
{
    private const string CentralMetro = "Central Metro Motors";
    private const string CentralMetroOwner = "garage.owner@centralmetro.com";

    private readonly MediaTestFactory _factory;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    // Smallest valid files: a 1x1 PNG and the start of an MP4 ('ftyp' box) plus some bytes.
    private static readonly byte[] TinyPng = Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");
    private static readonly byte[] TinyMp4 = new byte[] { 0x00, 0x00, 0x00, 0x18 }
        .Concat(Encoding.ASCII.GetBytes("ftypisom"))
        .Concat(new byte[] { 0x00, 0x00, 0x02, 0x00 })
        .Concat(Encoding.ASCII.GetBytes("isomiso2mp41"))
        .Concat(Enumerable.Range(0, 200).Select(i => (byte)i))
        .ToArray();

    public ServiceMediaIntegrationTests(MediaTestFactory factory)
    {
        _factory = factory;
    }

    // ---------- helpers ----------

    private async Task<HttpClient> SignedInAsync(string email, string password = "Password123!")
    {
        var client = _factory.CreateClient();
        var res = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, password));
        res.EnsureSuccessStatusCode();
        var body = await res.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body!.Data!.AccessToken);
        return client;
    }

    private async Task<HttpClient> NewCustomerAsync()
    {
        var anon = _factory.CreateClient();
        var email = $"media_{Guid.NewGuid():N}@brocomod.com";
        (await anon.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest(email, "Password123!", "Media Customer", TestMobiles.New())))
            .EnsureSuccessStatusCode();
        return await SignedInAsync(email);
    }

    /// <summary>A paid STANDARD package booking that the advisor assigned to Central Metro (so it has a job).</summary>
    private async Task<(HttpClient Customer, Guid RequestId, Guid JobId)> PackageJobAtCentralMetroAsync()
    {
        var customer = await NewCustomerAsync();

        var makes = await customer.GetFromJsonAsync<ApiResponse<List<VehicleManufacturerDto>>>("/api/v1/vehicle-manufacturers", JsonOptions);
        var maruti = makes!.Data!.Single(m => m.Name == "Maruti Suzuki");
        var models = await customer.GetFromJsonAsync<ApiResponse<List<VehicleModelDto>>>($"/api/v1/vehicle-manufacturers/{maruti.Id}/models", JsonOptions);
        var swift = models!.Data!.Single(m => m.Name == "Swift");
        var vehicleJson = $$"""
        { "manufacturerId": "{{maruti.Id}}", "modelId": "{{swift.Id}}", "year": 2022, "fuelType": "Petrol",
          "transmission": "Manual", "licensePlate": "TS-09-{{Random.Shared.Next(1000, 9999)}}", "mileage": 18000, "color": "Red" }
        """;
        var vehicleRes = await customer.PostAsync("/api/v1/customer/vehicles", new StringContent(vehicleJson, Encoding.UTF8, "application/json"));
        vehicleRes.EnsureSuccessStatusCode();
        using var vehicleDoc = JsonDocument.Parse(await vehicleRes.Content.ReadAsStringAsync());
        var vehicleId = vehicleDoc.RootElement.GetProperty("data").GetProperty("id").GetGuid();

        var booking = new CreateServiceBookingRequest(vehicleId, "Plot 12, Road No. 2", "Banjara Hills", "Hyderabad", "Telangana", "500034", "India",
            17.4126, 78.4482, ProblemDescription: "", ServiceCategory: null, PackageCode: "STANDARD");
        var bookRes = await customer.PostAsJsonAsync("/api/v1/customer/requests", booking);
        bookRes.StatusCode.Should().Be(HttpStatusCode.Created, await bookRes.Content.ReadAsStringAsync());
        var request = (await bookRes.Content.ReadFromJsonAsync<ApiResponse<ServiceRequestDetailDto>>(JsonOptions))!.Data!;

        var pay = await customer.PostAsJsonAsync($"/api/v1/customer/requests/{request.Id}/advance/pay", new InitiateAdvancePaymentRequest(null));
        pay.EnsureSuccessStatusCode();
        var checkout = (await pay.Content.ReadFromJsonAsync<ApiResponse<InitiatePaymentResponseDto>>(JsonOptions))!.Data!;
        (await customer.PostAsJsonAsync("/api/v1/customer/payments/verify",
            new VerifyPaymentRequestDto(checkout.PaymentId, $"pay_media_{Guid.NewGuid():N}", "sig_fake_valid", checkout.GatewayOrderId)))
            .EnsureSuccessStatusCode();

        var advisor = await SignedInAsync("advisor@brocomod.com");
        var candidates = await advisor.GetFromJsonAsync<ApiResponse<List<PackageGarageCandidateDto>>>($"/api/v1/advisor/requests/{request.Id}/package-garages", JsonOptions);
        var garage = candidates!.Data!.First(g => g.Name == CentralMetro);
        var assign = await advisor.PostAsJsonAsync($"/api/v1/advisor/requests/{request.Id}/package-assignment", new AssignPackageGarageRequest(garage.GarageId, "Nearest"));
        assign.IsSuccessStatusCode.Should().BeTrue(await assign.Content.ReadAsStringAsync());
        var result = (await assign.Content.ReadFromJsonAsync<ApiResponse<PackageAssignmentResultDto>>(JsonOptions))!.Data!;

        return (customer, request.Id, result.ServiceJobId);
    }

    /// <summary>A garage owner at a test-only garage far from every service area, so no booking is ever sent to it.</summary>
    private async Task<HttpClient> OtherGarageOwnerAsync()
    {
        var email = $"media_other_garage_{Guid.NewGuid():N}@garage.com";
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var garage = new Garage("Media Test Other Garage", "other@media-test.garage", "+91 91111 44444", "Test only", 70.0, 5.0);
            db.Garages.Add(garage);
            var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
            var hash = hasher.HashPassword("Password123!", out var salt);
            var user = new User(email, "Other Garage Owner", "+91 91111 44445", hash, salt);
            db.Users.Add(user);
            await db.SaveChangesAsync();

            var role = await db.Roles.FirstAsync(r => r.Name == AppRoles.GarageOwner);
            db.UserRoles.Add(new BroCoMod.Domain.Entities.Identity.UserRole { UserId = user.Id, RoleId = role.Id });
            db.GarageUsers.Add(new GarageUser(user.Id, garage.Id, AppRoles.GarageOwner, "Owner"));
            await db.SaveChangesAsync();
        }
        return await SignedInAsync(email);
    }

    private static MultipartFormDataContent Form(byte[] bytes, string fileName, string contentType, string? caption = null, string? stage = null, bool? visible = null, byte[]? thumbnail = null)
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        form.Add(file, "file", fileName);
        if (caption != null) form.Add(new StringContent(caption), "caption");
        if (stage != null) form.Add(new StringContent(stage), "stage");
        if (visible != null) form.Add(new StringContent(visible.Value ? "true" : "false"), "isVisibleToCustomer");
        if (thumbnail != null)
        {
            var thumb = new ByteArrayContent(thumbnail);
            thumb.Headers.ContentType = new MediaTypeHeaderValue("image/png");
            form.Add(thumb, "thumbnail", "thumb.png");
        }
        return form;
    }

    private static async Task<ServiceMediaDto> UploadOkAsync(HttpClient client, string url, MultipartFormDataContent form)
    {
        var res = await client.PostAsync(url, form);
        res.StatusCode.Should().Be(HttpStatusCode.Created, await res.Content.ReadAsStringAsync());
        return (await res.Content.ReadFromJsonAsync<ApiResponse<ServiceMediaDto>>(JsonOptions))!.Data!;
    }

    private static async Task<ServiceMediaListDto> ListAsync(HttpClient client, string url)
    {
        var res = await client.GetAsync(url);
        res.StatusCode.Should().Be(HttpStatusCode.OK, await res.Content.ReadAsStringAsync());
        return (await res.Content.ReadFromJsonAsync<ApiResponse<ServiceMediaListDto>>(JsonOptions))!.Data!;
    }

    private static async Task<string> MessageAsync(HttpResponseMessage res)
    {
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("message").GetString() ?? string.Empty;
    }

    /// <summary>
    /// A quote-type request near Central Metro: the booking sends it to Central Metro for a quote (no job yet).
    /// Nothing is accepted or paid, so no commission is created.
    /// </summary>
    private async Task<(HttpClient Customer, Guid RequestId)> QuoteRequestSentToCentralMetroAsync()
    {
        var customer = await NewCustomerAsync();
        var makes = await customer.GetFromJsonAsync<ApiResponse<List<VehicleManufacturerDto>>>("/api/v1/vehicle-manufacturers", JsonOptions);
        var maruti = makes!.Data!.Single(m => m.Name == "Maruti Suzuki");
        var models = await customer.GetFromJsonAsync<ApiResponse<List<VehicleModelDto>>>($"/api/v1/vehicle-manufacturers/{maruti.Id}/models", JsonOptions);
        var swift = models!.Data!.Single(m => m.Name == "Swift");
        var vehicleJson = $$"""
        { "manufacturerId": "{{maruti.Id}}", "modelId": "{{swift.Id}}", "year": 2021, "fuelType": "Petrol",
          "transmission": "Manual", "licensePlate": "TS-10-{{Random.Shared.Next(1000, 9999)}}", "mileage": 30000, "color": "White" }
        """;
        var vehicleRes = await customer.PostAsync("/api/v1/customer/vehicles", new StringContent(vehicleJson, Encoding.UTF8, "application/json"));
        vehicleRes.EnsureSuccessStatusCode();
        using var vehicleDoc = JsonDocument.Parse(await vehicleRes.Content.ReadAsStringAsync());
        var vehicleId = vehicleDoc.RootElement.GetProperty("data").GetProperty("id").GetGuid();

        var booking = new CreateServiceBookingRequest(vehicleId, "Plot 12, Road No. 2", "Banjara Hills", "Hyderabad", "Telangana", "500034", "India",
            17.4126, 78.4482, ProblemDescription: "Dent on the rear door and the AC is not cooling.", ServiceCategory: "Denting & Painting");
        var bookRes = await customer.PostAsJsonAsync("/api/v1/customer/requests", booking);
        bookRes.StatusCode.Should().Be(HttpStatusCode.Created, await bookRes.Content.ReadAsStringAsync());
        var request = (await bookRes.Content.ReadFromJsonAsync<ApiResponse<ServiceRequestDetailDto>>(JsonOptions))!.Data!;

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var centralMetroId = await db.GarageUsers.Where(gu => gu.User.Email == CentralMetroOwner).Select(gu => gu.GarageId).FirstAsync();
        (await db.GarageRequests.AnyAsync(gr => gr.ServiceRequestId == request.Id && gr.GarageId == centralMetroId))
            .Should().BeTrue("the request is sent to nearby Central Metro for a quote");
        return (customer, request.Id);
    }

    /// <summary>The smallest file that starts like a real PDF.</summary>
    private static readonly byte[] TinyPdf = Encoding.ASCII.GetBytes(
        "%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [] /Count 0 >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n");

    // ---------- tests ----------

    [Fact]
    public async Task Customer_AddsPhotosAndPdfs_ToTheirOwnRequest_AndDeletesThem_ButNotOtherPeoples()
    {
        var (customer, requestId, jobId) = await PackageJobAtCentralMetroAsync();
        var url = $"/api/v1/media/requests/{requestId}";

        // The stage and visibility the customer sends are ignored: it is always a customer upload, shown to them.
        var photo = await UploadOkAsync(customer, url, Form(TinyPng, "dent.png", "image/png", caption: "Dent on rear door", stage: "After", visible: false));
        var pdf = await UploadOkAsync(customer, url, Form(TinyPdf, "old-quotation.pdf", "application/pdf", caption: "Quote from last service"));

        photo.Stage.Should().Be("CustomerUpload");
        photo.IsVisibleToCustomer.Should().BeTrue();
        photo.Caption.Should().Be("Dent on rear door");
        photo.ServiceJobId.Should().Be(jobId);
        photo.UploadedByName.Should().Be("You");
        photo.CanDelete.Should().BeTrue();
        photo.CanEdit.Should().BeFalse();
        pdf.Kind.Should().Be("Document");
        pdf.ContentType.Should().Be("application/pdf");
        pdf.ThumbnailUrl.Should().BeNull();
        pdf.FileName.Should().Be("old-quotation.pdf");

        var list = await ListAsync(customer, url);
        list.Items.Select(i => i.Id).Should().BeEquivalentTo(new[] { photo.Id, pdf.Id });
        list.RemainingSlots.Should().Be(8);
        list.Limits.DocumentExtensions.Should().Contain("pdf");

        // The PDF opens in the browser through its signed link, with the type found from its bytes.
        var file = await _factory.CreateClient().GetAsync(list.Items.Single(i => i.Id == pdf.Id).Url);
        file.StatusCode.Should().Be(HttpStatusCode.OK);
        file.Content.Headers.ContentType!.MediaType.Should().Be("application/pdf");
        file.Content.Headers.ContentDisposition!.DispositionType.Should().Be("inline");
        file.Headers.GetValues("X-Content-Type-Options").Should().Contain("nosniff");
        (await file.Content.ReadAsByteArrayAsync()).Should().Equal(TinyPdf);

        // Another customer can neither add to nor see this request; the garage and advisor can see the uploads.
        var otherCustomer = await NewCustomerAsync();
        (await otherCustomer.PostAsync(url, Form(TinyPng, "x.png", "image/png"))).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await otherCustomer.DeleteAsync($"/api/v1/media/{photo.Id}")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        var garage = await SignedInAsync(CentralMetroOwner);
        var garageList = await ListAsync(garage, $"/api/v1/media/jobs/{jobId}");
        garageList.Items.Select(i => i.Id).Should().Contain(new[] { photo.Id, pdf.Id });
        garageList.Items.Single(i => i.Id == photo.Id).UploadedByName.Should().Be("Customer", "garages don't see the customer's name");
        (await garage.DeleteAsync($"/api/v1/media/{photo.Id}")).StatusCode.Should().Be(HttpStatusCode.Forbidden);

        // The customer can't delete what the advisor added, nor move their own upload to another stage.
        var advisor = await SignedInAsync("advisor@brocomod.com");
        var advisorPhoto = await UploadOkAsync(advisor, url, Form(TinyPng, "advisor.png", "image/png", stage: "Before"));
        (await customer.DeleteAsync($"/api/v1/media/{advisorPhoto.Id}")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await advisor.PatchAsJsonAsync($"/api/v1/media/{photo.Id}", new UpdateServiceMediaRequest(null, "Before", null)))
            .StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await advisor.PatchAsJsonAsync($"/api/v1/media/{advisorPhoto.Id}", new UpdateServiceMediaRequest(null, "CustomerUpload", null)))
            .StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await advisor.PatchAsJsonAsync($"/api/v1/media/{photo.Id}", new UpdateServiceMediaRequest("Rear door dent", "CustomerUpload", null)))
            .StatusCode.Should().Be(HttpStatusCode.OK, "sending the stage it already has is fine");

        // Their own upload they can delete; it is gone for everyone and frees a slot.
        (await customer.DeleteAsync($"/api/v1/media/{photo.Id}")).StatusCode.Should().Be(HttpStatusCode.OK);
        var after = await ListAsync(customer, url);
        after.Items.Select(i => i.Id).Should().BeEquivalentTo(new[] { pdf.Id, advisorPhoto.Id });
        after.RemainingSlots.Should().Be(9);
        var advisorList = await ListAsync(advisor, url);
        advisorList.Items.Should().NotContain(i => i.Id == photo.Id);
        advisorList.RemainingSlots.Should().Be(advisorList.MaxItems - 1, "customer uploads don't use the garage's and advisor's room");
    }

    [Fact]
    public async Task Customer_Uploads_AreCheckedByTheirBytes_AndVideosAreNotTakenFromCustomers()
    {
        var (customer, requestId, _) = await PackageJobAtCentralMetroAsync();
        var url = $"/api/v1/media/requests/{requestId}";

        var fakePdf = await customer.PostAsync(url, Form(Encoding.UTF8.GetBytes("<html><script>alert(1)</script></html>"), "quote.pdf", "application/pdf"));
        fakePdf.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await MessageAsync(fakePdf)).Should().Contain("not a real PDF file");

        var pngCalledPdf = await customer.PostAsync(url, Form(TinyPng, "quote.pdf", "application/pdf"));
        pngCalledPdf.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var pdfCalledJpg = await customer.PostAsync(url, Form(TinyPdf, "photo.jpg", "image/jpeg"));
        pdfCalledJpg.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var video = await customer.PostAsync(url, Form(TinyMp4, "noise.mp4", "video/mp4"));
        video.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await MessageAsync(video)).Should().Contain("photos");

        var word = await customer.PostAsync(url, Form(Encoding.ASCII.GetBytes("PK\u0003\u0004 word"), "bill.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"));
        word.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // The customer's own limit, with a small limit so the test stays quick.
        await using var strict = _factory.WithWebHostBuilder(b => b.UseSetting("Media:MaxCustomerItemsPerRequest", "1"));
        var strictClient = strict.CreateClient();
        strictClient.DefaultRequestHeaders.Authorization = customer.DefaultRequestHeaders.Authorization;
        await UploadOkAsync(strictClient, url, Form(TinyPng, "one.png", "image/png"));
        var overLimit = await strictClient.PostAsync(url, Form(TinyPdf, "two.pdf", "application/pdf"));
        overLimit.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await MessageAsync(overLimit)).Should().Contain("the most allowed");

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        (await db.ServiceMediaFiles.CountAsync(m => m.ServiceRequestId == requestId)).Should().Be(1);
    }

    [Fact]
    public async Task QuotingGarage_SeesOnlyTheCustomersUploads_AndAdvisorSeesEverything()
    {
        var (customer, requestId) = await QuoteRequestSentToCentralMetroAsync();
        var url = $"/api/v1/media/requests/{requestId}";
        var advisor = await SignedInAsync("advisor@brocomod.com");
        var garage = await SignedInAsync(CentralMetroOwner);

        var customerPdf = await UploadOkAsync(customer, url, Form(TinyPdf, "last-quote.pdf", "application/pdf", caption: "Quote from another garage"));
        var customerPhoto = await UploadOkAsync(customer, url, Form(TinyPng, "dent.png", "image/png"));
        var advisorShown = await UploadOkAsync(advisor, url, Form(TinyPng, "advisor-note.png", "image/png", stage: "Inspection"));
        var advisorHidden = await UploadOkAsync(advisor, url, Form(TinyPng, "internal.png", "image/png", stage: "Other", visible: false));

        // The garage the request was sent to sees what the customer attached, nothing else, and can't add or delete.
        var garageList = await ListAsync(garage, url);
        garageList.Items.Select(i => i.Id).Should().BeEquivalentTo(new[] { customerPdf.Id, customerPhoto.Id });
        garageList.CanUpload.Should().BeFalse();
        garageList.Items.Should().OnlyContain(i => !i.CanDelete && !i.CanEdit);
        (await _factory.CreateClient().GetAsync(garageList.Items[0].Url)).StatusCode.Should().Be(HttpStatusCode.OK);
        (await garage.PostAsync(url, Form(TinyPng, "garage.png", "image/png"))).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await garage.DeleteAsync($"/api/v1/media/{customerPhoto.Id}")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await garage.DeleteAsync($"/api/v1/media/{advisorShown.Id}")).StatusCode.Should().Be(HttpStatusCode.NotFound);

        // A garage the request was not sent to sees nothing.
        var otherGarage = await OtherGarageOwnerAsync();
        (await otherGarage.GetAsync(url)).StatusCode.Should().Be(HttpStatusCode.Forbidden);

        // The customer sees their uploads and what BroCo shows them, never the hidden item.
        var customerList = await ListAsync(customer, url);
        customerList.Items.Select(i => i.Id).Should().BeEquivalentTo(new[] { customerPdf.Id, customerPhoto.Id, advisorShown.Id });
        (await customer.DeleteAsync($"/api/v1/media/{advisorHidden.Id}")).StatusCode.Should().Be(HttpStatusCode.NotFound);

        // The advisor sees everything.
        (await ListAsync(advisor, url)).Items.Select(i => i.Id)
            .Should().BeEquivalentTo(new[] { customerPdf.Id, customerPhoto.Id, advisorShown.Id, advisorHidden.Id });

        // Once the request is cancelled, the customer can't add more (the uploads stay for BroCo). Cancelled straight
        // in the database so this test doesn't depend on the cancellation rules.
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var request = await db.ServiceRequests.SingleAsync(r => r.Id == requestId);
            request.Cancel("Fixed it myself");
            await db.SaveChangesAsync();
        }
        var cancelled = await customer.PostAsync(url, Form(TinyPng, "late.png", "image/png"));
        cancelled.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await ListAsync(customer, url)).CanUpload.Should().BeFalse();
        (await garage.GetAsync(url)).StatusCode.Should().Be(HttpStatusCode.Forbidden, "a cancelled request is no longer being quoted");
    }

    [Fact]
    public async Task Garage_UploadsToItsOwnJob_AndEachRoleSeesWhatItShould_ThroughSignedLinks()
    {
        var (customer, requestId, jobId) = await PackageJobAtCentralMetroAsync();
        var garage = await SignedInAsync(CentralMetroOwner);

        var photo = await UploadOkAsync(garage, $"/api/v1/media/jobs/{jobId}",
            Form(TinyPng, "front-bumper.png", "image/png", caption: "Front bumper scratch", stage: "Before", thumbnail: TinyPng));
        var video = await UploadOkAsync(garage, $"/api/v1/media/jobs/{jobId}",
            Form(TinyMp4, "engine-noise.mp4", "video/mp4", caption: "Engine noise", stage: "inspection", visible: false));

        photo.Kind.Should().Be("Photo");
        photo.Stage.Should().Be("Before");
        photo.ServiceRequestId.Should().Be(requestId);
        photo.ServiceJobId.Should().Be(jobId);
        photo.ContentType.Should().Be("image/png");
        photo.ThumbnailUrl.Should().NotBeNull();
        photo.CanEdit.Should().BeFalse("garages upload; advisors and admins edit");
        photo.CanDelete.Should().BeTrue("a garage can remove its own fresh upload");
        video.Kind.Should().Be("Video");
        video.Stage.Should().Be("Inspection");
        video.IsVisibleToCustomer.Should().BeFalse();

        // Files land under the configured folder with generated names, never the client's.
        var stored = Directory.GetFiles(_factory.MediaRoot, "*", SearchOption.AllDirectories);
        stored.Should().NotContain(f => f.Contains("front-bumper") || f.Contains("engine-noise"));

        // Advisor and garage see both; the customer only the one shown to customers.
        var advisor = await SignedInAsync("advisor@brocomod.com");
        var advisorList = await ListAsync(advisor, $"/api/v1/media/requests/{requestId}");
        advisorList.Items.Select(i => i.Id).Should().BeEquivalentTo(new[] { photo.Id, video.Id });
        advisorList.CanEdit.Should().BeTrue();
        advisorList.CanUpload.Should().BeTrue();
        advisorList.RemainingSlots.Should().Be(advisorList.MaxItems - 2);
        (await ListAsync(garage, $"/api/v1/media/jobs/{jobId}")).Items.Should().HaveCount(2);

        var customerList = await ListAsync(customer, $"/api/v1/media/requests/{requestId}");
        customerList.Items.Should().ContainSingle().Which.Id.Should().Be(photo.Id);
        customerList.CanUpload.Should().BeTrue("customers can attach their own photos and PDFs");
        customerList.MaxItems.Should().Be(10, "customers have their own allowance, separate from the garage's");
        customerList.RemainingSlots.Should().Be(10);
        customerList.CanEdit.Should().BeFalse();
        customerList.Items[0].CanDelete.Should().BeFalse();
        customerList.Items[0].UploadedByName.Should().Be("Garage", "customers see who took it by role, not by staff name");

        // Signed links stream without the bearer token: the full file, the thumbnail and a byte range of the video.
        var anonymous = _factory.CreateClient();
        var file = await anonymous.GetAsync(customerList.Items[0].Url);
        file.StatusCode.Should().Be(HttpStatusCode.OK);
        file.Content.Headers.ContentType!.MediaType.Should().Be("image/png");
        (await file.Content.ReadAsByteArrayAsync()).Should().Equal(TinyPng);
        (await anonymous.GetAsync(customerList.Items[0].ThumbnailUrl)).StatusCode.Should().Be(HttpStatusCode.OK);

        var rangeRequest = new HttpRequestMessage(HttpMethod.Get, advisorList.Items.Single(i => i.Id == video.Id).Url);
        rangeRequest.Headers.Range = new RangeHeaderValue(0, 11);
        var range = await anonymous.SendAsync(rangeRequest);
        range.StatusCode.Should().Be(HttpStatusCode.PartialContent);
        range.Content.Headers.ContentType!.MediaType.Should().Be("video/mp4");
        (await range.Content.ReadAsByteArrayAsync()).Should().Equal(TinyMp4.Take(12));

        // Every upload is in the audit log.
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var audited = await db.AuditLogs.AsNoTracking()
            .Where(a => a.Action == "MEDIA_UPLOADED" && (a.EntityId == photo.Id.ToString() || a.EntityId == video.Id.ToString()))
            .CountAsync();
        audited.Should().Be(2);
    }

    [Fact]
    public async Task OtherGarages_AndOtherCustomers_CannotUpload_OrSeeTheMedia()
    {
        var (_, requestId, jobId) = await PackageJobAtCentralMetroAsync();
        var otherGarage = await OtherGarageOwnerAsync();
        var otherCustomer = await NewCustomerAsync();

        var otherGarageUpload = await otherGarage.PostAsync($"/api/v1/media/jobs/{jobId}", Form(TinyPng, "x.png", "image/png"));
        otherGarageUpload.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await otherGarage.GetAsync($"/api/v1/media/requests/{requestId}")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await otherGarage.GetAsync($"/api/v1/media/jobs/{jobId}")).StatusCode.Should().Be(HttpStatusCode.Forbidden);

        (await otherCustomer.GetAsync($"/api/v1/media/requests/{requestId}")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await otherCustomer.PostAsync($"/api/v1/media/requests/{requestId}", Form(TinyPng, "x.png", "image/png")))
            .StatusCode.Should().Be(HttpStatusCode.Forbidden);

        (await _factory.CreateClient().GetAsync($"/api/v1/media/requests/{requestId}")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await (await SignedInAsync("advisor@brocomod.com")).GetAsync($"/api/v1/media/requests/{Guid.NewGuid()}"))
            .StatusCode.Should().Be(HttpStatusCode.NotFound);

        // Nothing was stored for this request.
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        (await db.ServiceMediaFiles.CountAsync(m => m.ServiceRequestId == requestId)).Should().Be(0);
    }

    [Fact]
    public async Task Advisor_EditsCaptionStageAndVisibility_AdminDeletes_AndCustomersFollowTheChanges()
    {
        var (customer, requestId, jobId) = await PackageJobAtCentralMetroAsync();
        var advisor = await SignedInAsync("advisor@brocomod.com");
        var admin = await SignedInAsync("admin@brocomod.com");
        var garage = await SignedInAsync(CentralMetroOwner);

        var advisorPhoto = await UploadOkAsync(advisor, $"/api/v1/media/requests/{requestId}", Form(TinyPng, "pickup.png", "image/png", stage: "Before"));
        advisorPhoto.ServiceJobId.Should().Be(jobId, "a request upload is linked to the request's job");
        advisorPhoto.CanEdit.Should().BeTrue();

        var customerUrl = (await ListAsync(customer, $"/api/v1/media/requests/{requestId}")).Items.Single().Url;
        (await _factory.CreateClient().GetAsync(customerUrl)).StatusCode.Should().Be(HttpStatusCode.OK);

        // Garage and customer may not edit.
        (await garage.PatchAsJsonAsync($"/api/v1/media/{advisorPhoto.Id}", new UpdateServiceMediaRequest("Changed", null, null)))
            .StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await customer.PatchAsJsonAsync($"/api/v1/media/{advisorPhoto.Id}", new UpdateServiceMediaRequest("Changed", null, null)))
            .StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await customer.DeleteAsync($"/api/v1/media/{advisorPhoto.Id}")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await garage.DeleteAsync($"/api/v1/media/{advisorPhoto.Id}")).StatusCode.Should().Be(HttpStatusCode.Forbidden, "not the garage's own upload");

        // Advisor edits caption, stage and hides it from the customer.
        var edit = await advisor.PatchAsJsonAsync($"/api/v1/media/{advisorPhoto.Id}", new UpdateServiceMediaRequest("  Dent on rear door  ", "After", false));
        edit.StatusCode.Should().Be(HttpStatusCode.OK, await edit.Content.ReadAsStringAsync());
        var edited = (await edit.Content.ReadFromJsonAsync<ApiResponse<ServiceMediaDto>>(JsonOptions))!.Data!;
        edited.Caption.Should().Be("Dent on rear door");
        edited.Stage.Should().Be("After");
        edited.IsVisibleToCustomer.Should().BeFalse();

        (await advisor.PatchAsJsonAsync($"/api/v1/media/{advisorPhoto.Id}", new UpdateServiceMediaRequest(null, "Sideways", null)))
            .StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // Hidden: gone from the customer's list, the customer's old link stops working, and it reads as not found to them.
        (await ListAsync(customer, $"/api/v1/media/requests/{requestId}")).Items.Should().BeEmpty();
        (await _factory.CreateClient().GetAsync(customerUrl)).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await customer.DeleteAsync($"/api/v1/media/{advisorPhoto.Id}")).StatusCode.Should().Be(HttpStatusCode.NotFound);

        // Show it again, then the admin deletes it: gone for everyone, and its link is dead.
        (await advisor.PatchAsJsonAsync($"/api/v1/media/{advisorPhoto.Id}", new UpdateServiceMediaRequest(null, null, true)))
            .EnsureSuccessStatusCode();
        var staffUrl = (await ListAsync(admin, $"/api/v1/media/requests/{requestId}")).Items.Single().Url;
        (await admin.DeleteAsync($"/api/v1/media/{advisorPhoto.Id}")).StatusCode.Should().Be(HttpStatusCode.OK);
        (await ListAsync(advisor, $"/api/v1/media/requests/{requestId}")).Items.Should().BeEmpty();
        (await ListAsync(customer, $"/api/v1/media/requests/{requestId}")).Items.Should().BeEmpty();
        (await _factory.CreateClient().GetAsync(staffUrl)).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await admin.DeleteAsync($"/api/v1/media/{advisorPhoto.Id}")).StatusCode.Should().Be(HttpStatusCode.NotFound);

        // A garage can delete its own fresh upload.
        var garagePhoto = await UploadOkAsync(garage, $"/api/v1/media/jobs/{jobId}", Form(TinyPng, "oops.png", "image/png"));
        (await garage.DeleteAsync($"/api/v1/media/{garagePhoto.Id}")).StatusCode.Should().Be(HttpStatusCode.OK);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var actions = await db.AuditLogs.AsNoTracking()
            .Where(a => a.EntityName == nameof(ServiceMedia) && a.EntityId == advisorPhoto.Id.ToString())
            .Select(a => a.Action)
            .ToListAsync();
        actions.Should().Contain(new[] { "MEDIA_UPLOADED", "MEDIA_UPDATED", "MEDIA_DELETED" });
        var row = await db.ServiceMediaFiles.AsNoTracking().SingleAsync(m => m.Id == advisorPhoto.Id);
        row.IsDeleted.Should().BeTrue("deletes are soft so the audit trail still points at the row");
    }

    [Fact]
    public async Task SignedLinks_WithABadSignatureOrExpiry_AreRefused()
    {
        var (_, requestId, _) = await PackageJobAtCentralMetroAsync();
        var advisor = await SignedInAsync("advisor@brocomod.com");
        var media = await UploadOkAsync(advisor, $"/api/v1/media/requests/{requestId}", Form(TinyPng, "a.png", "image/png"));
        var anonymous = _factory.CreateClient();

        (await anonymous.GetAsync(media.Url)).StatusCode.Should().Be(HttpStatusCode.OK);

        var tampered = media.Url[..^3] + (media.Url.EndsWith("AAA") ? "BBB" : "AAA");
        (await anonymous.GetAsync(tampered)).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await anonymous.GetAsync($"/api/v1/media/{media.Id}/content")).StatusCode.Should().Be(HttpStatusCode.Forbidden);

        // The same id with another media's valid signature does not work either.
        var other = await UploadOkAsync(advisor, $"/api/v1/media/requests/{requestId}", Form(TinyPng, "b.png", "image/png"));
        var otherQuery = other.Url[other.Url.IndexOf('?')..];
        (await anonymous.GetAsync($"/api/v1/media/{media.Id}/content{otherQuery}")).StatusCode.Should().Be(HttpStatusCode.Forbidden);

        // A correctly signed but expired link.
        var signer = _factory.Services.GetRequiredService<MediaUrlSigner>();
        var expired = DateTimeOffset.UtcNow.AddMinutes(-5).ToUnixTimeSeconds();
        var sig = Uri.EscapeDataString($"s:{signer.Sign(media.Id, expired, "s")}");
        var expiredRes = await anonymous.GetAsync($"/api/v1/media/{media.Id}/content?exp={expired}&sig={sig}");
        expiredRes.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await MessageAsync(expiredRes)).Should().Contain("expired");
    }

    [Fact]
    public async Task WrongTypes_FakeFiles_AndOversizedFiles_AreRejectedWithClearMessages()
    {
        var (_, requestId, jobId) = await PackageJobAtCentralMetroAsync();
        var garage = await SignedInAsync(CentralMetroOwner);
        var url = $"/api/v1/media/jobs/{jobId}";

        var fake = await garage.PostAsync(url, Form(Encoding.UTF8.GetBytes("<html>not a photo</html>"), "photo.jpg", "image/jpeg"));
        fake.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await MessageAsync(fake)).Should().Contain("not a real JPG file");

        var gif = await garage.PostAsync(url, Form(Encoding.ASCII.GetBytes("GIF89a......"), "anim.gif", "image/gif"));
        gif.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await MessageAsync(gif)).Should().Contain("not a supported photo or video");

        var mislabelled = await garage.PostAsync(url, Form(TinyPng, "photo.png", "video/mp4"));
        mislabelled.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await MessageAsync(mislabelled)).Should().Contain("says it is video/mp4");

        var noFile = await garage.PostAsync(url, new MultipartFormDataContent { { new StringContent("hi"), "caption" } });
        noFile.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await MessageAsync(noFile)).Should().Contain("Choose a photo or video");

        var longCaption = await garage.PostAsync(url, Form(TinyPng, "a.png", "image/png", caption: new string('x', 501)));
        longCaption.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await MessageAsync(longCaption)).Should().Contain("at most 500 characters");

        // Size and count limits, with small limits so the test files stay tiny.
        await using var strict = _factory.WithWebHostBuilder(b =>
        {
            b.UseSetting("Media:MaxPhotoBytes", "100");
            b.UseSetting("Media:MaxItemsPerRequest", "1");
        });
        var strictClient = strict.CreateClient();
        var login = await strictClient.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(CentralMetroOwner, "Password123!"));
        var token = (await login.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(JsonOptions))!.Data!.AccessToken;
        strictClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var bigPhoto = TinyPng.Concat(new byte[200]).ToArray();
        var tooBig = await strictClient.PostAsync(url, Form(bigPhoto, "big.png", "image/png"));
        tooBig.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await MessageAsync(tooBig)).Should().Contain("Photos can be up to");

        await UploadOkAsync(strictClient, url, Form(TinyPng, "one.png", "image/png"));
        var overLimit = await strictClient.PostAsync(url, Form(TinyPng, "two.png", "image/png"));
        overLimit.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await MessageAsync(overLimit)).Should().Contain("the most allowed");

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        (await db.ServiceMediaFiles.CountAsync(m => m.ServiceRequestId == requestId)).Should().Be(1);
    }
}
