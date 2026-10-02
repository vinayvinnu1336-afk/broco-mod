using BroCoMod.Application.Authorization;
using BroCoMod.Application.Interfaces;
using BroCoMod.Infrastructure.Persistence;
using BroCoMod.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
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
        services.AddScoped<IIdentityService, IdentityService>();

        // Portal Services
        services.AddScoped<ICustomerPortalService, CustomerPortalService>();
        services.AddScoped<IGaragePortalService, GaragePortalService>();
        services.AddScoped<IAdvisorPortalService, AdvisorPortalService>();
        services.AddScoped<IAdminPortalService, AdminPortalService>();

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

        services.AddSingleton<ICacheService, RedisCacheService>();

        return services;
    }
}
