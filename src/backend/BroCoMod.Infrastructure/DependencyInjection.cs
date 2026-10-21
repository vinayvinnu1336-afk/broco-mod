using BroCoMod.Application.Authorization;
using BroCoMod.Application.Interfaces;
using BroCoMod.Infrastructure.Persistence;
using BroCoMod.Infrastructure.Services;
using BroCoMod.Infrastructure.Services.Media;
using BroCoMod.Infrastructure.Services.Messaging;
using BroCoMod.Infrastructure.Services.PaymentGateway;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StackExchange.Redis;

namespace BroCoMod.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var postgresConnection = configuration.GetConnectionString("DefaultConnection")
            ?? "Host=localhost;Port=5432;Database=broco_mod;Username=postgres;Password=postgres";

        services.AddDbContext<ApplicationDbContext>(options =>
        {
            options.UseNpgsql(postgresConnection, npgsqlOptions =>
            {
                npgsqlOptions.UseNetTopologySuite();
                npgsqlOptions.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName);
                npgsqlOptions.EnableRetryOnFailure(maxRetryCount: 3);
            });
        });

        services.AddScoped<IApplicationDbContext>(sp => sp.GetRequiredService<ApplicationDbContext>());
        services.AddScoped<IGarageService, GarageService>();
        services.AddScoped<IQuoteService, QuoteService>();

        // Identity & Security Services
        services.AddHttpContextAccessor();
        services.AddScoped<IPasswordHasher, PasswordHasher>();
        services.AddScoped<ITokenService, JwtTokenService>();
        services.AddScoped<IOtpProvider, OtpProvider>();
        services.AddScoped<IAuditService, AuditService>();
        services.AddScoped<ICurrentUserService, CurrentUserService>();
        // Advisors work in one city; every advisor-facing query is limited through this.
        services.AddScoped<IAdvisorCityScope, AdvisorCityScope>();
        services.AddScoped<IIdentityService, IdentityService>();

        // Portal & Vehicle Services
        services.AddScoped<ICustomerPortalService, CustomerPortalService>();
        services.AddScoped<IGaragePortalService, GaragePortalService>();
        services.AddScoped<IAdvisorPortalService, AdvisorPortalService>();
        services.AddScoped<IAdminPortalService, AdminPortalService>();
        services.AddScoped<IVehicleMasterService, VehicleMasterService>();
        services.AddScoped<ICustomerVehicleService, CustomerVehicleService>();

        // Service Booking & Dispatch Services
        services.AddScoped<IRequestNumberGenerator, RequestNumberGenerator>();
        services.AddScoped<IGarageMatchingService, GarageMatchingService>();
        services.AddScoped<INotificationProvider, InAppNotificationProvider>();
        services.AddScoped<INotificationProvider, EmailNotificationProvider>();
        services.AddScoped<INotificationProvider, SmsNotificationProvider>();
        services.AddScoped<INotificationProvider, WhatsAppNotificationProvider>();
        services.AddScoped<INotificationService, NotificationService>();

        // Email (ZeptoMail), SMS (Gupshup, DLT) and WhatsApp (Gupshup): docs/integrations-setup.md. Each sender
        // reads its keys on every send and reports "not configured" while they are empty. Headers carrying a
        // token are redacted from HttpClient logs; the SMS password travels in the POST body, which is never logged.
        services.AddHttpClient<IEmailSender, ZeptoMailEmailSender>(c => c.Timeout = TimeSpan.FromSeconds(15))
            .RedactLoggedHeaders(new[] { "Authorization" });
        services.AddHttpClient<ISmsSender, GupshupSmsSender>(c => c.Timeout = TimeSpan.FromSeconds(15));
        services.AddHttpClient<IWhatsAppSender, GupshupWhatsAppSender>(c => c.Timeout = TimeSpan.FromSeconds(15))
            .RedactLoggedHeaders(new[] { "apikey" });
        services.AddScoped<IOtpDelivery, OtpDeliveryService>();
        services.AddScoped<OtpRequestLimiter>();
        services.AddSingleton<ExternalNotificationQueue>();
        services.AddHostedService<ExternalNotificationWorker>();
        services.AddScoped<IIntegrationsService, IntegrationsService>();
        services.AddScoped<IServiceRequestService, ServiceRequestService>();

        // Garage Quotation Workflow Services
        services.AddScoped<IQuoteNumberGenerator, QuoteNumberGenerator>();
        services.AddScoped<IGarageQuoteService, GarageQuoteService>();
        services.AddHostedService<QuoteExpirationBackgroundService>();

        // Milestone 6: Advisor Review, Garage Assignment & Customer Quotation Services
        services.AddScoped<ICustomerQuotationNumberGenerator, CustomerQuotationNumberGenerator>();
        services.AddScoped<IAdvisorQuotationService, AdvisorQuotationService>();
        services.AddScoped<ICustomerQuotationService, CustomerQuotationService>();
        services.AddScoped<ICustomerDecisionService, CustomerDecisionService>();

        // Milestone 8: Service Execution & Garage Job Lifecycle Services
        services.AddScoped<IServiceJobNumberGenerator, ServiceJobNumberGenerator>();
        services.AddScoped<IServiceJobService, ServiceJobService>();
        services.AddScoped<IBookingCancellationService, BookingCancellationService>();

        // Milestone 9: Operations & Admin Control Center Services
        services.AddScoped<IAdminOperationsService, AdminOperationsService>();
        services.AddScoped<IAdminAdvisorAccountService, AdminAdvisorAccountService>();
        services.AddScoped<IAdminGarageAccountService, AdminGarageAccountService>();
        services.AddScoped<IAdvisorOperationsService, AdvisorOperationsService>();

        // Milestone 10: Financial & Payment Foundation Services
        services.AddScoped<DevelopmentFakePaymentGateway>();
        services.AddScoped<IPaymentGateway, DevelopmentFakePaymentGateway>();
        // Razorpay (docs/razorpay-setup.md). Both gateways are registered; Payment:Provider picks the one for
        // new payments and older rows keep theirs. The Authorization header carries the key secret, so it is
        // redacted from HttpClient logs. Missing keys stop the API at startup instead of at the first payment.
        services.AddHttpClient<RazorpayPaymentGateway>(c =>
        {
            c.BaseAddress = new Uri(RazorpayPaymentGateway.BaseUrl);
            c.Timeout = TimeSpan.FromSeconds(20);
        }).RedactLoggedHeaders(new[] { "Authorization" });
        services.AddScoped<IPaymentGateway>(sp => sp.GetRequiredService<RazorpayPaymentGateway>());
        services.AddOptions<RazorpayOptions>().Configure<IConfiguration>(RazorpayOptions.Bind).ValidateOnStart();
        services.AddSingleton<IValidateOptions<RazorpayOptions>, RazorpayOptionsValidator>();
        services.AddScoped<IPaymentGatewayFactory, PaymentGatewayFactory>();

        services.AddScoped<FinancialNumberGenerators>();
        services.AddScoped<IPaymentNumberGenerator>(sp => sp.GetRequiredService<FinancialNumberGenerators>());
        services.AddScoped<IInvoiceNumberGenerator>(sp => sp.GetRequiredService<FinancialNumberGenerators>());
        services.AddScoped<ISettlementNumberGenerator>(sp => sp.GetRequiredService<FinancialNumberGenerators>());
        services.AddScoped<IAdditionalWorkQuotationNumberGenerator>(sp => sp.GetRequiredService<FinancialNumberGenerators>());

        services.AddScoped<IFinancialLedgerService, FinancialLedgerService>();
        services.AddScoped<IInvoiceService, InvoiceService>();
        services.AddScoped<ISettlementService, SettlementService>();
        services.AddScoped<IPaymentService, PaymentService>();
        services.AddScoped<IAdminFinanceService, AdminFinanceService>();

        // Service packages, booking advance, garage commission & website enquiries
        services.AddScoped<ICatalogueService, CatalogueService>();
        services.AddSingleton<IServiceAreaService, ServiceAreaService>();
        // Pin -> address: Google when a server key is set, then OpenStreetMap (Geocoding:FallbackProvider).
        // Providers are tried in registration order. Google request URLs carry the key, so they are not logged.
        services.AddHttpClient<GoogleGeocodingService>(c => c.Timeout = TimeSpan.FromSeconds(5)).RemoveAllLoggers();
        services.AddTransient<IGeocodingService>(sp => sp.GetRequiredService<GoogleGeocodingService>());
        services.AddTransient<IReverseGeocodingProvider>(sp => sp.GetRequiredService<GoogleGeocodingService>());
        services.AddSingleton(_ => new NominatimRateGate());
        services.AddHttpClient<NominatimReverseGeocodingProvider>(c => c.Timeout = TimeSpan.FromSeconds(5));
        services.AddTransient<IReverseGeocodingProvider>(sp => sp.GetRequiredService<NominatimReverseGeocodingProvider>());
        services.AddSingleton<ReverseGeocodeCache>();
        services.AddScoped<IAddressLookupService, AddressLookupService>();
        services.AddScoped<ICommissionService, CommissionService>();
        services.AddScoped<ICommissionDuesService, CommissionService>();
        services.AddScoped<IPackageBookingService, PackageBookingService>();
        services.AddScoped<ILeadService, LeadService>();
        services.AddHostedService<CommissionReminderBackgroundService>();

        // Photos and videos on service requests (docs/architecture/media.md)
        services.Configure<MediaOptions>(configuration.GetSection(MediaOptions.SectionName));
        services.AddSingleton<IMediaStorage, LocalDiskMediaStorage>();
        services.AddSingleton<MediaUrlSigner>();
        services.AddScoped<IServiceMediaService, ServiceMediaService>();


        // Authorization Handlers & Seeder
        services.AddSingleton<IAuthorizationHandler, PermissionAuthorizationHandler>();
        services.AddScoped<DatabaseSeeder>();

        // Redis setup
        var redisConnection = configuration.GetConnectionString("Redis")
            ?? configuration["Redis:ConnectionString"]
            ?? "localhost:6379";

        try
        {
            var multiplexer = ConnectionMultiplexer.Connect(new ConfigurationOptions
            {
                EndPoints = { redisConnection },
                AbortOnConnectFail = false,
                ConnectTimeout = 3000,
                SyncTimeout = 3000
            });
            services.AddSingleton<IConnectionMultiplexer>(multiplexer);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Warning] Failed to connect to Redis on startup: {ex.Message}. Running in degraded cache mode.");
        }

        services.AddMemoryCache();
        services.AddSingleton<ICacheService, RedisCacheService>();

        return services;
    }
}
