using BroCoMod.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using StackExchange.Redis;

namespace BroCoMod.Api.Controllers;

[ApiController]
[Route("[controller]")]
public class HealthController : ControllerBase
{
    private readonly HealthCheckService _healthCheckService;
    private readonly ApplicationDbContext _dbContext;
    private readonly IConnectionMultiplexer? _redis;
    private readonly ILogger<HealthController> _logger;

    public HealthController(
        HealthCheckService healthCheckService,
        ApplicationDbContext dbContext,
        ILogger<HealthController> logger,
        IConnectionMultiplexer? redis = null)
    {
        _healthCheckService = healthCheckService;
        _dbContext = dbContext;
        _logger = logger;
        _redis = redis;
    }

    /// <summary>
    /// Comprehensive health endpoint verifying DB, PostGIS spatial engine, and Redis.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetHealth(CancellationToken cancellationToken)
    {
        var report = await _healthCheckService.CheckHealthAsync(cancellationToken);

        // Verify PostGIS extension explicitly
        bool postGisInstalled = false;
        string postGisVersion = "Unavailable";
        try
        {
            var connection = _dbContext.Database.GetDbConnection();
            await connection.OpenAsync(cancellationToken);
            using var cmd = connection.CreateCommand();
            cmd.CommandText = "SELECT postgis_full_version();";
            var result = await cmd.ExecuteScalarAsync(cancellationToken);
            if (result != null)
            {
                postGisInstalled = true;
                postGisVersion = result.ToString() ?? "Enabled";
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "PostGIS health probe check failed.");
        }

        // Verify Redis connection
        bool redisConnected = _redis != null && _redis.IsConnected;

        var entries = new Dictionary<string, object>
        {
            ["postgres"] = new
            {
                status = _dbContext.Database.CanConnect() ? "Healthy" : "Unhealthy",
                database = _dbContext.Database.GetDbConnection().Database
            },
            ["postgis"] = new
            {
                status = postGisInstalled ? "Healthy" : "Degraded",
                version = postGisVersion
            },
            ["redis"] = new
            {
                status = redisConnected ? "Healthy" : "Degraded",
                connected = redisConnected
            }
        };

        var response = new
        {
            status = report.Status.ToString(),
            totalDuration = report.TotalDuration.ToString(),
            postgisActive = postGisInstalled,
            redisActive = redisConnected,
            entries
        };

        return report.Status == HealthStatus.Unhealthy
            ? StatusCode(StatusCodes.Status503ServiceUnavailable, response)
            : Ok(response);
    }
}
