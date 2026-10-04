using System.Text;
using System.Threading.RateLimiting;
using BroCoMod.Application.Authorization;
using BroCoMod.Domain.Constants;
using BroCoMod.Infrastructure;
using BroCoMod.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// Configure Swagger with JWT Bearer Authorization support
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new()
    {
        Title = "BroCo Mod API",
        Version = "v1",
        Description = "Modular Monolith Backend for BroCo Mod Automotive Service Platform"
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

// Configure JWT Bearer Authentication
var jwtSecret = builder.Configuration["Jwt:Secret"] ?? "BroCoMod-Super-Secret-Production-Grade-Key-2026-Security-First!";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "BroCoMod";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "BroCoModApp";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false; // set to true in strict production HTTPS environments
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

// Configure Rate Limiting for Authentication Endpoints
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddFixedWindowLimiter("auth-rate-limit", opt =>
    {
        opt.PermitLimit = 30; // 30 requests per minute
        opt.Window = TimeSpan.FromMinutes(1);
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        opt.QueueLimit = 5;
    });
});

// Configure Health Checks
var postgresConn = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Host=localhost;Port=5432;Database=broco_mod;Username=postgres;Password=postgres";
var redisConn = builder.Configuration.GetConnectionString("Redis")
    ?? "localhost:6379";

builder.Services.AddHealthChecks()
    .AddNpgSql(postgresConn, name: "postgres", failureStatus: HealthStatus.Degraded, tags: new[] { "db", "sql", "postgres" })
    .AddRedis(redisConn, name: "redis", failureStatus: HealthStatus.Degraded, tags: new[] { "cache", "redis" });

// Configure CORS for Next.js frontend
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(
                "http://localhost",
                "http://localhost:80",
                "http://localhost:3000",
                "http://localhost:3005",
                "http://127.0.0.1",
                "http://127.0.0.1:80",
                "http://127.0.0.1:3000",
                "http://127.0.0.1:3005"
            )
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment() || app.Environment.IsEnvironment("Docker"))
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "BroCo Mod API v1");
        c.RoutePrefix = "swagger";
    });
}

app.UseCors("AllowFrontend");

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/healthz");

// Apply EF Core database migrations & seed initial roles/permissions/demo accounts
using (var scope = app.Services.CreateScope())
{
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    try
    {
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        if (db.Database.CanConnect())
        {
            logger.LogInformation("Database reachable. Applying EF Core migrations...");
            db.Database.Migrate();
            logger.LogInformation("Database migrations applied successfully.");

            var seeder = scope.ServiceProvider.GetRequiredService<DatabaseSeeder>();
            await seeder.SeedAsync();
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
