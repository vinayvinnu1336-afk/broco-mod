using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Constants;
using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Entities.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Geometries;

namespace BroCoMod.Infrastructure.Persistence;

public class DatabaseSeeder
{
    private readonly ApplicationDbContext _context;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IHostEnvironment _environment;
    private readonly IConfiguration _configuration;
    private readonly ILogger<DatabaseSeeder> _logger;

    public DatabaseSeeder(
        ApplicationDbContext context,
        IPasswordHasher passwordHasher,
        IHostEnvironment environment,
        IConfiguration configuration,
        ILogger<DatabaseSeeder> logger)
    {
        _context = context;
        _passwordHasher = passwordHasher;
        _environment = environment;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task SeedAsync()
    {
        _logger.LogInformation("Starting database initialization and seeding...");

        // 1. Seed Roles
        var roles = new[]
        {
            new Role(AppRoles.SuperAdmin, "Platform administrator with unrestricted system access"),
            new Role(AppRoles.Advisor, "Technical service advisor reviewing quotes and assisting customers"),
            new Role(AppRoles.GarageOwner, "Owner of a registered repair and modification workshop"),
            new Role(AppRoles.GarageManager, "Manager of repair workshop operations"),
            new Role(AppRoles.GarageStaff, "Workshop technician and staff member"),
            new Role(AppRoles.Customer, "Car owner requesting vehicle services and modifications")
        };

        foreach (var r in roles)
        {
            if (!await _context.Roles.AnyAsync(existing => existing.NormalizedName == r.NormalizedName))
            {
                _context.Roles.Add(r);
            }
        }
        await _context.SaveChangesAsync();

        // 2. Seed Permissions
        foreach (var permCode in AppPermissions.All)
        {
            if (!await _context.Permissions.AnyAsync(p => p.Code == permCode))
            {
                var category = permCode.Split('_').FirstOrDefault() switch
                {
                    "CUSTOMER" => "Customer",
                    "GARAGE" => "Garage",
                    "ADVISOR" => "Advisor",
                    "ADMIN" => "Admin",
                    _ => "General"
                };
                _context.Permissions.Add(new Permission(permCode, $"Permission for {permCode}", category));
            }
        }
        await _context.SaveChangesAsync();

        // 3. Seed Role-Permissions
        var allDbRoles = await _context.Roles.ToListAsync();
        var allDbPermissions = await _context.Permissions.ToListAsync();

        foreach (var role in allDbRoles)
        {
            var defaultCodes = AppPermissions.GetDefaultPermissionsForRole(role.Name);
            foreach (var code in defaultCodes)
            {
                var perm = allDbPermissions.FirstOrDefault(p => p.Code == code);
                if (perm != null)
                {
                    var exists = await _context.RolePermissions
                        .AnyAsync(rp => rp.RoleId == role.Id && rp.PermissionId == perm.Id);
                    if (!exists)
                    {
                        _context.RolePermissions.Add(new RolePermission { RoleId = role.Id, PermissionId = perm.Id });
                    }
                }
            }
        }
        await _context.SaveChangesAsync();

        // 4. Check if demo data should be seeded (strictly disabled in production unless explicit flag is enabled)
        var isDev = _environment.IsDevelopment();
        var enableDemoSeeding = _configuration.GetValue<bool>("EnableDemoSeeding", false);

        if (!isDev && !enableDemoSeeding)
        {
            _logger.LogInformation("Production environment detected ({Env}). Demo accounts, test credentials, and sample entities will NOT be seeded.", _environment.EnvironmentName);
            return;
        }

        _logger.LogInformation("Development/Demo mode detected ({Env}). Seeding demo accounts and workshop fixtures...", _environment.EnvironmentName);

        // 5. Ensure demo Garage exists
        var garage = await _context.Garages.FirstOrDefaultAsync();
        if (garage == null)
        {
            garage = new Garage(
                name: "Central Metro Motors",
                email: "info@centralmetro.com",
                phoneNumber: "+1 555 987 6543",
                address: "100 Performance Way, Metro City",
                longitude: 77.5946,
                latitude: 12.9716
            );
            _context.Garages.Add(garage);
            await _context.SaveChangesAsync();
        }

        // 5. Seed Demo Accounts (Password: Password123!)
        const string defaultPassword = "Password123!";

        // A. SUPER ADMIN
        await SeedUserIfNotExists(
            email: "admin@brocomod.com",
            fullName: "Super Admin",
            phoneNumber: "+1 555 000 0001",
            password: defaultPassword,
            roleName: AppRoles.SuperAdmin);

        // B. ADVISOR
        var advisorUser = await SeedUserIfNotExists(
            email: "advisor@brocomod.com",
            fullName: "Alex Vance (Lead Advisor)",
            phoneNumber: "+1 555 000 0002",
            password: defaultPassword,
            roleName: AppRoles.Advisor);

        if (advisorUser != null && !await _context.AdvisorProfiles.AnyAsync(ap => ap.UserId == advisorUser.Id))
        {
            _context.AdvisorProfiles.Add(new AdvisorProfile(advisorUser.Id, "ADV-1001", "European Performance Tuning", 50));
            await _context.SaveChangesAsync();
        }

        // C. GARAGE OWNER
        var garageOwnerUser = await SeedUserIfNotExists(
            email: "garage.owner@centralmetro.com",
            fullName: "Marcus Sterling (Owner)",
            phoneNumber: "+1 555 000 0003",
            password: defaultPassword,
            roleName: AppRoles.GarageOwner);

        if (garageOwnerUser != null && !await _context.GarageUsers.AnyAsync(gu => gu.UserId == garageOwnerUser.Id))
        {
            _context.GarageUsers.Add(new GarageUser(garageOwnerUser.Id, garage.Id, AppRoles.GarageOwner, "Owner & Master Tech"));
            await _context.SaveChangesAsync();
        }

        // D. CUSTOMER
        var customerUser = await SeedUserIfNotExists(
            email: "customer@brocomod.com",
            fullName: "Jordan Hayes",
            phoneNumber: "+1 555 000 0004",
            password: defaultPassword,
            roleName: AppRoles.Customer);

        if (customerUser != null)
        {
            var customerProfile = await _context.CustomerProfiles.FirstOrDefaultAsync(cp => cp.UserId == customerUser.Id);
            if (customerProfile == null)
            {
                customerProfile = new CustomerProfile(customerUser.Id, "45 Skyline Boulevard, Suite 12", "Email");
                _context.CustomerProfiles.Add(customerProfile);
                await _context.SaveChangesAsync();
            }

            // Seed demo vehicle
            if (!await _context.CustomerVehicles.AnyAsync(v => v.CustomerId == customerProfile.Id))
            {
                var vehicle = new CustomerVehicle(
                    customerProfile.Id,
                    make: "BMW",
                    model: "M340i xDrive",
                    year: 2022,
                    licensePlate: "BROCO-01",
                    vin: "WBA5U7C06NF123456",
                    mileage: 24500);
                _context.CustomerVehicles.Add(vehicle);
                await _context.SaveChangesAsync();
            }
        }

        _logger.LogInformation("Database initialization and seeding completed successfully.");
    }

    private async Task<User?> SeedUserIfNotExists(
        string email,
        string fullName,
        string phoneNumber,
        string password,
        string roleName)
    {
        var normalizedEmail = email.Trim().ToUpperInvariant();
        var user = await _context.Users
            .Include(u => u.UserRoles)
            .FirstOrDefaultAsync(u => u.NormalizedEmail == normalizedEmail);

        if (user != null)
        {
            return user;
        }

        var hash = _passwordHasher.HashPassword(password, out var salt);
        user = new User(
            email: email,
            fullName: fullName,
            phoneNumber: phoneNumber,
            passwordHash: hash,
            salt: salt);

        _context.Users.Add(user);

        var role = await _context.Roles.FirstOrDefaultAsync(r => r.NormalizedName == roleName.ToUpperInvariant());
        if (role != null)
        {
            _context.UserRoles.Add(new UserRole { User = user, Role = role });
        }

        await _context.SaveChangesAsync();
        return user;
    }
}
