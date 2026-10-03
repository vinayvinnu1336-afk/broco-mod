using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Constants;
using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Entities.Identity;
using BroCoMod.Domain.Entities.VehicleMaster;
using BroCoMod.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Geometries;
using UserRole = BroCoMod.Domain.Entities.Identity.UserRole;

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

        // 4. Seed Essential Vehicle Master Catalog (Manufacturers, Models, Variants)
        await SeedVehicleMasterAsync();

        // 4b. Seed Default Platform Fee Policy (10% standard fee, 18% GST)
        if (!await _context.PlatformFeeConfigurations.AnyAsync())
        {
            var feePolicy = new PlatformFeeConfiguration(
                name: "Standard Automotive Commission",
                feePercentage: 10.0m,
                fixedFee: 0.0m,
                taxPercentage: 18.0m,
                isActive: true,
                effectiveFromUtc: DateTime.UtcNow.AddYears(-1)
            );
            _context.PlatformFeeConfigurations.Add(feePolicy);
            await _context.SaveChangesAsync();
        }


        // 5. Check if demo data should be seeded (strictly disabled in production unless explicit flag is enabled)
        var isDev = _environment.IsDevelopment();
        var enableDemoSeeding = _configuration.GetValue<bool>("EnableDemoSeeding", false);

        if (!isDev && !enableDemoSeeding)
        {
            _logger.LogInformation("Production environment detected ({Env}). Demo accounts, test credentials, and sample entities will NOT be seeded.", _environment.EnvironmentName);
            return;
        }

        _logger.LogInformation("Development/Demo mode detected ({Env}). Seeding demo accounts and workshop fixtures...", _environment.EnvironmentName);

        // 6. Ensure demo Garage exists
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

        // 7. Seed Demo Accounts (Password: Password123!)
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

            // Seed demo vehicle linked to Master Vehicle Catalog
            if (!await _context.CustomerVehicles.AnyAsync(v => v.CustomerId == customerProfile.Id))
            {
                var bmw = await _context.VehicleManufacturers.FirstOrDefaultAsync(m => m.NormalizedName == "BMW");
                var model3Series = bmw != null
                    ? await _context.VehicleModels.FirstOrDefaultAsync(m => m.ManufacturerId == bmw.Id && m.NormalizedName == "3 SERIES")
                    : null;
                var variantM340i = model3Series != null
                    ? await _context.VehicleVariants.FirstOrDefaultAsync(v => v.ModelId == model3Series.Id && v.Name == "M340i xDrive")
                    : null;

                if (bmw != null && model3Series != null)
                {
                    var vehicle = new CustomerVehicle(
                        customerProfile.Id,
                        bmw.Id,
                        bmw.Name,
                        model3Series.Id,
                        model3Series.Name,
                        variantM340i?.Id,
                        variantM340i?.Name ?? "M340i xDrive",
                        year: 2022,
                        fuelType: FuelType.Petrol,
                        transmission: "Automatic",
                        licensePlate: "BROCO-01",
                        vin: "WBA5U7C06NF123456",
                        mileage: 24500,
                        color: "Portimao Blue",
                        isPrimary: true);

                    _context.CustomerVehicles.Add(vehicle);
                    await _context.SaveChangesAsync();
                }
            }

            // Seed additional test garages around Bangalore with varying distances & states
            if (!await _context.Garages.AnyAsync(g => g.Name == "Indiranagar Auto Hub"))
            {
                _context.Garages.Add(new Garage(
                    name: "Indiranagar Auto Hub",
                    email: "indiranagar@autohub.com",
                    phoneNumber: "+91 80 2520 1122",
                    address: "12 100 Feet Road, Indiranagar, Bengaluru",
                    longitude: 77.6412,
                    latitude: 12.9784,
                    isVerified: true,
                    isOperational: true));
            }

            if (!await _context.Garages.AnyAsync(g => g.Name == "Koramangala Speed Works"))
            {
                _context.Garages.Add(new Garage(
                    name: "Koramangala Speed Works",
                    email: "koramangala@speedworks.in",
                    phoneNumber: "+91 80 4110 3344",
                    address: "88 80 Feet Road, 4th Block Koramangala, Bengaluru",
                    longitude: 77.6200,
                    latitude: 12.9352,
                    isVerified: true,
                    isOperational: true));
            }

            if (!await _context.Garages.AnyAsync(g => g.Name == "Whitefield Precision Garage"))
            {
                _context.Garages.Add(new Garage(
                    name: "Whitefield Precision Garage",
                    email: "contact@whitefieldprecision.com",
                    phoneNumber: "+91 80 6677 8899",
                    address: "205 ITPL Main Road, Whitefield, Bengaluru",
                    longitude: 77.7499,
                    latitude: 12.9698,
                    isVerified: true,
                    isOperational: true));
            }

            if (!await _context.Garages.AnyAsync(g => g.Name == "Jayanagar Auto Care (Pending Verification)"))
            {
                _context.Garages.Add(new Garage(
                    name: "Jayanagar Auto Care (Pending Verification)",
                    email: "service@jayanagarauto.com",
                    phoneNumber: "+91 80 2663 4455",
                    address: "4th Main, 9th Block Jayanagar, Bengaluru",
                    longitude: 77.5833,
                    latitude: 12.9300,
                    isVerified: false,
                    isOperational: true));
            }

            await _context.SaveChangesAsync();

            // Seed initial demo service request if none exists
            if (!await _context.ServiceRequests.AnyAsync())
            {
                var demoVehicle = await _context.CustomerVehicles.FirstOrDefaultAsync(v => v.CustomerId == customerProfile.Id);
                if (demoVehicle != null)
                {
                    var location = new ServiceLocation(
                        addressLine1: "45 Skyline Boulevard, Suite 12",
                        addressLine2: "Central Residency",
                        city: "Bengaluru",
                        state: "Karnataka",
                        pincode: "560001",
                        latitude: 12.9716,
                        longitude: 77.5946,
                        country: "India");
                    _context.ServiceLocations.Add(location);
                    await _context.SaveChangesAsync();

                    var demoRequest = new ServiceRequest(
                        requestNumber: "BM-100001",
                        customerId: customerProfile.Id,
                        customerVehicleId: demoVehicle.Id,
                        vehicleMake: demoVehicle.Make,
                        vehicleModel: demoVehicle.Model,
                        vehicleYear: demoVehicle.Year,
                        vehicleLicensePlate: demoVehicle.LicensePlate,
                        serviceLocationId: location.Id,
                        customerLocation: location.Location,
                        problemDescription: "High-speed brake judder and squeaking when braking from 80 km/h.",
                        serviceCategory: "Brakes & Suspension",
                        preferredServiceDate: DateTime.UtcNow.AddDays(2),
                        radiusKm: 10.0);

                    demoRequest.GarageRequests.Add(new GarageRequest(
                        demoRequest.Id,
                        garage.Id,
                        distanceKm: 2.4,
                        initialStatus: GarageRequestStatus.Notified));

                    demoRequest.MarkGaragesNotified();
                    _context.ServiceRequests.Add(demoRequest);
                    await _context.SaveChangesAsync();
                }
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

    private async Task SeedVehicleMasterAsync()
    {
        if (await _context.VehicleManufacturers.AnyAsync())
        {
            return;
        }

        _logger.LogInformation("Seeding reference Vehicle Master catalog (Manufacturers, Models, Variants)...");

        // 1. BMW
        var bmw = new VehicleManufacturer("BMW", "Germany", "/logos/bmw.svg", 1);
        _context.VehicleManufacturers.Add(bmw);
        await _context.SaveChangesAsync();

        var bmw3Series = new VehicleModel(bmw.Id, "3 Series", "Sedan", 2019);
        var bmwM3 = new VehicleModel(bmw.Id, "M3", "Sedan", 2021);
        var bmwM4 = new VehicleModel(bmw.Id, "M4", "Coupe", 2021);
        var bmwX5 = new VehicleModel(bmw.Id, "X5", "SUV", 2019);
        _context.VehicleModels.AddRange(bmw3Series, bmwM3, bmwM4, bmwX5);
        await _context.SaveChangesAsync();

        _context.VehicleVariants.AddRange(
            new VehicleVariant(bmw3Series.Id, "330i", "Automatic", FuelType.Petrol, 1998, 255, 2019),
            new VehicleVariant(bmw3Series.Id, "M340i xDrive", "Automatic", FuelType.Petrol, 2998, 382, 2020),
            new VehicleVariant(bmw3Series.Id, "330e", "Automatic", FuelType.PlugInHybrid, 1998, 288, 2020),
            new VehicleVariant(bmwM3.Id, "M3 Standard", "Manual", FuelType.Petrol, 2993, 473, 2021),
            new VehicleVariant(bmwM3.Id, "M3 Competition xDrive", "Automatic", FuelType.Petrol, 2993, 503, 2021),
            new VehicleVariant(bmwM4.Id, "M4 Competition", "Automatic", FuelType.Petrol, 2993, 503, 2021),
            new VehicleVariant(bmwX5.Id, "xDrive40i", "Automatic", FuelType.Petrol, 2998, 375, 2019),
            new VehicleVariant(bmwX5.Id, "xDrive45e", "Automatic", FuelType.PlugInHybrid, 2998, 389, 2020)
        );

        // 2. Audi
        var audi = new VehicleManufacturer("Audi", "Germany", "/logos/audi.svg", 2);
        _context.VehicleManufacturers.Add(audi);
        await _context.SaveChangesAsync();

        var audiA4 = new VehicleModel(audi.Id, "A4", "Sedan", 2016);
        var audiRs6 = new VehicleModel(audi.Id, "RS6 Avant", "Wagon", 2020);
        var audiEtron = new VehicleModel(audi.Id, "e-tron GT", "Sedan", 2021);
        _context.VehicleModels.AddRange(audiA4, audiRs6, audiEtron);
        await _context.SaveChangesAsync();

        _context.VehicleVariants.AddRange(
            new VehicleVariant(audiA4.Id, "40 TFSI", "Automatic", FuelType.Petrol, 1984, 201, 2016),
            new VehicleVariant(audiA4.Id, "45 TFSI quattro", "Automatic", FuelType.Petrol, 1984, 261, 2016),
            new VehicleVariant(audiRs6.Id, "RS6 4.0 TFSI quattro", "Automatic", FuelType.Petrol, 3996, 591, 2020),
            new VehicleVariant(audiEtron.Id, "RS e-tron GT", "Automatic", FuelType.Electric, null, 637, 2021)
        );

        // 3. Mercedes-Benz
        var mb = new VehicleManufacturer("Mercedes-Benz", "Germany", "/logos/mercedes.svg", 3);
        _context.VehicleManufacturers.Add(mb);
        await _context.SaveChangesAsync();

        var mbCClass = new VehicleModel(mb.Id, "C-Class", "Sedan", 2022);
        var mbAmgGt = new VehicleModel(mb.Id, "AMG GT", "Coupe", 2020);
        _context.VehicleModels.AddRange(mbCClass, mbAmgGt);
        await _context.SaveChangesAsync();

        _context.VehicleVariants.AddRange(
            new VehicleVariant(mbCClass.Id, "C300", "Automatic", FuelType.Petrol, 1999, 255, 2022),
            new VehicleVariant(mbCClass.Id, "AMG C43 4MATIC", "Automatic", FuelType.Petrol, 1991, 402, 2023),
            new VehicleVariant(mbCClass.Id, "AMG C63 S E Performance", "Automatic", FuelType.PlugInHybrid, 1991, 671, 2024),
            new VehicleVariant(mbAmgGt.Id, "GT 63 4MATIC+", "Automatic", FuelType.Petrol, 3982, 577, 2020)
        );

        // 4. Porsche
        var porsche = new VehicleManufacturer("Porsche", "Germany", "/logos/porsche.svg", 4);
        _context.VehicleManufacturers.Add(porsche);
        await _context.SaveChangesAsync();

        var porsche911 = new VehicleModel(porsche.Id, "911", "Coupe", 2019);
        var porscheTaycan = new VehicleModel(porsche.Id, "Taycan", "Sedan", 2020);
        _context.VehicleModels.AddRange(porsche911, porscheTaycan);
        await _context.SaveChangesAsync();

        _context.VehicleVariants.AddRange(
            new VehicleVariant(porsche911.Id, "Carrera", "Dual-Clutch", FuelType.Petrol, 2981, 379, 2019),
            new VehicleVariant(porsche911.Id, "Carrera 4S", "Dual-Clutch", FuelType.Petrol, 2981, 443, 2019),
            new VehicleVariant(porsche911.Id, "GT3", "Dual-Clutch", FuelType.Petrol, 3996, 502, 2021),
            new VehicleVariant(porsche911.Id, "Turbo S", "Dual-Clutch", FuelType.Petrol, 3745, 640, 2020),
            new VehicleVariant(porscheTaycan.Id, "4S", "Automatic", FuelType.Electric, null, 522, 2020),
            new VehicleVariant(porscheTaycan.Id, "Turbo S", "Automatic", FuelType.Electric, null, 750, 2020)
        );

        // 5. Toyota
        var toyota = new VehicleManufacturer("Toyota", "Japan", "/logos/toyota.svg", 5);
        _context.VehicleManufacturers.Add(toyota);
        await _context.SaveChangesAsync();

        var toyotaSupra = new VehicleModel(toyota.Id, "GR Supra", "Coupe", 2020);
        var toyotaYaris = new VehicleModel(toyota.Id, "GR Yaris", "Hatchback", 2020);
        _context.VehicleModels.AddRange(toyotaSupra, toyotaYaris);
        await _context.SaveChangesAsync();

        _context.VehicleVariants.AddRange(
            new VehicleVariant(toyotaSupra.Id, "2.0", "Automatic", FuelType.Petrol, 1998, 255, 2020),
            new VehicleVariant(toyotaSupra.Id, "3.0 Premium", "Automatic", FuelType.Petrol, 2998, 382, 2020),
            new VehicleVariant(toyotaYaris.Id, "Circuit Pack", "Manual", FuelType.Petrol, 1618, 257, 2020)
        );

        // 6. Volkswagen
        var vw = new VehicleManufacturer("Volkswagen", "Germany", "/logos/vw.svg", 6);
        _context.VehicleManufacturers.Add(vw);
        await _context.SaveChangesAsync();

        var vwGolf = new VehicleModel(vw.Id, "Golf", "Hatchback", 2020);
        _context.VehicleModels.Add(vwGolf);
        await _context.SaveChangesAsync();

        _context.VehicleVariants.AddRange(
            new VehicleVariant(vwGolf.Id, "GTI", "Automatic", FuelType.Petrol, 1984, 241, 2020),
            new VehicleVariant(vwGolf.Id, "R", "Automatic", FuelType.Petrol, 1984, 315, 2021)
        );

        // 7. Tesla
        var tesla = new VehicleManufacturer("Tesla", "USA", "/logos/tesla.svg", 7);
        _context.VehicleManufacturers.Add(tesla);
        await _context.SaveChangesAsync();

        var teslaModel3 = new VehicleModel(tesla.Id, "Model 3", "Sedan", 2018);
        _context.VehicleModels.Add(teslaModel3);
        await _context.SaveChangesAsync();

        _context.VehicleVariants.AddRange(
            new VehicleVariant(teslaModel3.Id, "Long Range AWD", "Direct Drive", FuelType.Electric, null, 425, 2018),
            new VehicleVariant(teslaModel3.Id, "Performance", "Direct Drive", FuelType.Electric, null, 510, 2019)
        );

        await _context.SaveChangesAsync();
        _logger.LogInformation("Vehicle Master catalog seeded successfully (7 manufacturers, 15 models, 24 variants).");
    }
}
