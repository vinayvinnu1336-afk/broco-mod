using System.Net;
using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using BroCoMod.Api.Infrastructure;
using BroCoMod.Application.Authorization;
using BroCoMod.Domain.Constants;
using BroCoMod.Infrastructure;
using BroCoMod.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new FlexibleEnumConverterFactory()));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

// Configure Swagger with JWT Bearer Authorization support
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new()
    {
        Title = "BroCo API",
        Version = "v1",
        Description = "Modular Monolith Backend for BroCo Automotive Service Platform"
    });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Example: \"Bearer {token}\"",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// Configure Infrastructure layer (PostgreSQL + PostGIS, Redis, Identity & Security Services)
builder.Services.AddInfrastructure(builder.Configuration);

// Configure JWT Bearer Authentication.
// The signing secret must come from configuration (appsettings.Development.json locally, the
// Jwt__Secret environment variable everywhere else). A missing or weak secret is a fatal startup error.
var jwtSecret = builder.Configuration["Jwt:Secret"];
if (string.IsNullOrWhiteSpace(jwtSecret) || jwtSecret.Length < 32)
{
    throw new InvalidOperationException(
        "Jwt:Secret is missing or shorter than 32 characters. Set the Jwt__Secret environment variable to a long random value.");
}
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "BroCoMod";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "BroCoModApp";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false; // TLS is terminated at the Nginx reverse proxy
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
        ValidateIssuer = true,
        ValidIssuer = jwtIssuer,
        ValidateAudience = true,
        ValidAudience = jwtAudience,
        ValidateLifetime = true,
        ClockSkew = TimeSpan.FromMinutes(1)
    };
});

// Configure Authorization Policies for every Platform Permission
builder.Services.AddAuthorization(options =>
{
    foreach (var permission in AppPermissions.All)
    {
        options.AddPolicy(permission, policy =>
            policy.Requirements.Add(new PermissionRequirement(permission)));
    }
});

// Trust X-Forwarded-For / X-Forwarded-Proto from the reverse proxy so rate limits and audit logs see the real client IP.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
    foreach (var proxy in builder.Configuration.GetSection("ReverseProxy:KnownProxies").Get<string[]>() ?? Array.Empty<string>())
    {
        if (IPAddress.TryParse(proxy, out var address))
        {
            options.KnownProxies.Add(address);
        }
    }
    if (options.KnownProxies.Count == 0)
    {
        // Docker / private networks only - the API is never exposed directly to the internet.
        options.KnownNetworks.Add(new Microsoft.AspNetCore.HttpOverrides.IPNetwork(IPAddress.Parse("10.0.0.0"), 8));
        options.KnownNetworks.Add(new Microsoft.AspNetCore.HttpOverrides.IPNetwork(IPAddress.Parse("172.16.0.0"), 12));
        options.KnownNetworks.Add(new Microsoft.AspNetCore.HttpOverrides.IPNetwork(IPAddress.Parse("192.168.0.0"), 16));
        options.KnownNetworks.Add(new Microsoft.AspNetCore.HttpOverrides.IPNetwork(IPAddress.Loopback, 8));
    }
});

// Configure Rate Limiting.
// Every bucket is partitioned per client (user id when signed in, otherwise IP) so one client
// can never exhaust the allowance of everyone else.
var authPermitPerMinute = builder.Configuration.GetValue("RateLimiting:AuthPermitPerMinute", 10);
var apiPermitPerMinute = builder.Configuration.GetValue("RateLimiting:ApiPermitPerMinute", 300);
var geoPermitPerMinute = builder.Configuration.GetValue("RateLimiting:GeoPermitPerMinute", 30);

static string ClientPartitionKey(HttpContext context) =>
    context.User.FindFirstValue(ClaimTypes.NameIdentifier)
    ?? context.User.FindFirstValue("sub")
    ?? context.Connection.RemoteIpAddress?.ToString()
    ?? "unknown";

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
        {
            context.HttpContext.Response.Headers.RetryAfter = ((int)retryAfter.TotalSeconds).ToString();
        }
        await context.HttpContext.Response.WriteAsJsonAsync(
            new { success = false, message = "Too many requests. Please wait a moment and try again.", errors = new[] { "rate_limited" } },
            cancellationToken);
    };

    options.AddPolicy("auth-rate-limit", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            $"auth:{context.Connection.RemoteIpAddress}",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = authPermitPerMinute,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));

    // Address lookups are billed (Google) or rationed (OpenStreetMap); a few per pin is plenty.
    options.AddPolicy("geo-rate-limit", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            $"geo:{ClientPartitionKey(context)}",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = geoPermitPerMinute,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));

    options.GlobalLimiter =PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetSlidingWindowLimiter(
            $"api:{ClientPartitionKey(context)}",
            _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = apiPermitPerMinute,
                Window = TimeSpan.FromMinutes(1),
                SegmentsPerWindow = 6,
                QueueLimit = 0
            }));
});

// Configure Health Checks.
// "live" has no dependencies (process is up); "ready" requires PostgreSQL so the load balancer
// stops sending traffic to an instance that cannot reach the database. Redis is optional (degraded).
var postgresConn = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Host=localhost;Port=5432;Database=broco_mod;Username=postgres;Password=postgres";
var redisConn = builder.Configuration.GetConnectionString("Redis")
    ?? "localhost:6379";

builder.Services.AddHealthChecks()
    .AddNpgSql(postgresConn, name: "postgres", failureStatus: HealthStatus.Unhealthy, tags: new[] { "ready", "db" })
    .AddRedis(redisConn, name: "redis", failureStatus: HealthStatus.Degraded, tags: new[] { "ready", "cache" });

// Configure CORS for the Next.js frontend. In production the frontend is served from the same
// origin through Nginx, so CORS only matters for local development or a separate frontend host.
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>();
if (allowedOrigins == null || allowedOrigins.Length == 0)
{
    allowedOrigins = new[]
    {
        "http://localhost",
        "http://localhost:3000",
        "http://localhost:3005",
        "http://127.0.0.1",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3005"
    };
}

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var app = builder.Build();

app.UseForwardedHeaders();
app.UseExceptionHandler();

// Configure the HTTP request pipeline.
var swaggerEnabled = builder.Configuration.GetValue("Swagger:Enabled", app.Environment.IsDevelopment());
if (swaggerEnabled)
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "BroCo API v1");
        c.RoutePrefix = "swagger";
    });
}

app.UseCors("AllowFrontend");

app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();

app.MapControllers();

app.MapHealthChecks("/healthz/live", new HealthCheckOptions { Predicate = _ => false }).DisableRateLimiting();
app.MapHealthChecks("/healthz/ready", new HealthCheckOptions { Predicate = c => c.Tags.Contains("ready") }).DisableRateLimiting();
app.MapHealthChecks("/healthz", new HealthCheckOptions { Predicate = c => c.Tags.Contains("ready") }).DisableRateLimiting();

// Apply EF Core database migrations & seed initial roles/permissions/demo accounts.
// Guarded by a PostgreSQL advisory lock so several replicas starting together never race each other.
if (builder.Configuration.GetValue("Database:MigrateOnStartup", true))
{
    using var scope = app.Services.CreateScope();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    try
    {
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        if (db.Database.CanConnect())
        {
            await DatabaseStartup.MigrateAndSeedAsync(db, scope.ServiceProvider, logger);
        }
        else
        {
            logger.LogWarning("Database not yet reachable on startup. Migration and seeding application will be deferred.");
        }
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "Deferred database migration or seeding on startup: {Message}", ex.Message);
    }
}

app.Run();

// Required for WebApplicationFactory in integration tests
public partial class Program { }
