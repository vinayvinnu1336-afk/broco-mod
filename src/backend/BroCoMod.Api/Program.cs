using BroCoMod.Infrastructure;
using BroCoMod.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new()
    {
        Title = "BroCo Mod API",
        Version = "v1",
        Description = "Modular Monolith Backend for BroCo Mod Automotive Service Platform"
    });
});

// Configure Infrastructure layer (PostgreSQL + PostGIS, Redis)
builder.Services.AddInfrastructure(builder.Configuration);

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
                "http://localhost:3000",
                "http://localhost:80",
                "http://127.0.0.1:3000"
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

app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/healthz");

// Automatically apply EF Core database migrations on startup if database is accessible
using (var scope = app.Services.CreateScope())
{
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    try
    {
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        if (db.Database.CanConnect())
        {
            logger.LogInformation("Database reachable. Applying EF Core migrations and verifying PostGIS extension...");
            db.Database.Migrate();
            logger.LogInformation("Database migrations applied successfully.");
        }
        else
        {
            logger.LogWarning("Database not yet reachable on startup. Migration application will be deferred.");
        }
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "Deferred database migration application on startup: {Message}", ex.Message);
    }
}

app.Run();

// Required for WebApplicationFactory in integration tests
public partial class Program { }
