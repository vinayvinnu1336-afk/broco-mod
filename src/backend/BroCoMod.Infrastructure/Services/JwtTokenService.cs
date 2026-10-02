using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Entities.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace BroCoMod.Infrastructure.Services;

public class JwtTokenService : ITokenService
{
    private readonly IConfiguration _configuration;

    public JwtTokenService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public string GenerateAccessToken(
        User user,
        IEnumerable<string> roles,
        IEnumerable<string> permissions,
        Guid? customerId = null,
        Guid? garageId = null,
        string? garageRole = null)
    {
        var secret = _configuration["Jwt:Secret"] ?? "BroCoMod-Super-Secret-Production-Grade-Key-2026-Security-First!";
        var issuer = _configuration["Jwt:Issuer"] ?? "BroCoMod";
        var audience = _configuration["Jwt:Audience"] ?? "BroCoModApp";
        var expiryMinutesStr = _configuration["Jwt:ExpiryMinutes"] ?? "60";
        var expiryMinutes = int.TryParse(expiryMinutesStr, out var m) ? m : 60;

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Email, user.Email),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new(ClaimTypes.Name, user.FullName),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        foreach (var role in roles)
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
        }

        foreach (var perm in permissions)
        {
            claims.Add(new Claim("permission", perm));
        }

        if (customerId.HasValue)
        {
            claims.Add(new Claim("customer_id", customerId.Value.ToString()));
        }

        if (garageId.HasValue)
        {
            claims.Add(new Claim("garage_id", garageId.Value.ToString()));
        }

        if (!string.IsNullOrWhiteSpace(garageRole))
        {
            claims.Add(new Claim("garage_role", garageRole));
        }

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expiryMinutes),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string GenerateRefreshToken()
    {
        var randomBytes = RandomNumberGenerator.GetBytes(64);
        return Convert.ToBase64String(randomBytes);
    }

    public string HashToken(string token)
    {
        using var sha256 = SHA256.Create();
        var hashedBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(token));
        return Convert.ToBase64String(hashedBytes);
    }
}
