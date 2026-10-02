using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Entities.Identity;
using BroCoMod.Domain.Entities.VehicleMaster;
using BroCoMod.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using UserRole = BroCoMod.Domain.Entities.Identity.UserRole;

namespace BroCoMod.Infrastructure.Persistence;

public class ApplicationDbContext : DbContext, IApplicationDbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<Garage> Garages => Set<Garage>();
    public DbSet<ServiceRequest> ServiceRequests => Set<ServiceRequest>();
    public DbSet<GarageQuote> GarageQuotes => Set<GarageQuote>();
    public DbSet<CustomerQuotation> CustomerQuotations => Set<CustomerQuotation>();

    // Identity & Authorization
    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<CustomerProfile> CustomerProfiles => Set<CustomerProfile>();
    public DbSet<GarageUser> GarageUsers => Set<GarageUser>();
    public DbSet<AdvisorProfile> AdvisorProfiles => Set<AdvisorProfile>();
    public DbSet<CustomerVehicle> CustomerVehicles => Set<CustomerVehicle>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    // Vehicle Master Catalog
    public DbSet<VehicleManufacturer> VehicleManufacturers => Set<VehicleManufacturer>();
    public DbSet<VehicleModel> VehicleModels => Set<VehicleModel>();
    public DbSet<VehicleVariant> VehicleVariants => Set<VehicleVariant>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Enable PostGIS extension in PostgreSQL
        modelBuilder.HasPostgresExtension("postgis");

        // Garage configuration
        modelBuilder.Entity<Garage>(builder =>
        {
            builder.HasKey(g => g.Id);
            builder.Property(g => g.Name).IsRequired().HasMaxLength(200);
            builder.Property(g => g.Email).IsRequired().HasMaxLength(200);
            builder.Property(g => g.PhoneNumber).HasMaxLength(50);
            builder.Property(g => g.Address).HasMaxLength(500);

            // PostGIS spatial geography column with spatial indexing
            builder.Property(g => g.Location)
                .HasColumnType("geography(Point, 4326)")
                .IsRequired();

            builder.HasIndex(g => g.Location)
                .HasMethod("GIST");
        });

        // ServiceRequest configuration
        modelBuilder.Entity<ServiceRequest>(builder =>
        {
            builder.HasKey(sr => sr.Id);
            builder.Property(sr => sr.VehicleMake).IsRequired().HasMaxLength(100);
            builder.Property(sr => sr.VehicleModel).IsRequired().HasMaxLength(100);
            builder.Property(sr => sr.Description).HasMaxLength(2000);

            // PostGIS spatial geography column with spatial indexing
            builder.Property(sr => sr.CustomerLocation)
                .HasColumnType("geography(Point, 4326)")
                .IsRequired();

            builder.HasIndex(sr => sr.CustomerLocation)
                .HasMethod("GIST");

            builder.HasMany(sr => sr.GarageQuotes)
                .WithOne(gq => gq.ServiceRequest)
                .HasForeignKey(gq => gq.ServiceRequestId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(sr => sr.CustomerQuotation)
                .WithOne(cq => cq.ServiceRequest)
                .HasForeignKey<CustomerQuotation>(cq => cq.ServiceRequestId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // GarageQuote configuration (Confidential internal quote)
        modelBuilder.Entity<GarageQuote>(builder =>
        {
            builder.HasKey(gq => gq.Id);
            builder.Property(gq => gq.GarageInternalPrice)
                .HasPrecision(18, 2)
                .IsRequired();
            builder.Property(gq => gq.InternalCostBreakdown)
                .HasMaxLength(4000);
            builder.Property(gq => gq.GarageNotes)
                .HasMaxLength(2000);

            builder.HasOne(gq => gq.Garage)
                .WithMany(g => g.Quotes)
                .HasForeignKey(gq => gq.GarageId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // CustomerQuotation configuration (Sanitized customer proposal)
        modelBuilder.Entity<CustomerQuotation>(builder =>
        {
            builder.HasKey(cq => cq.Id);
            builder.Property(cq => cq.CustomerFacingPrice)
                .HasPrecision(18, 2)
                .IsRequired();
            builder.Property(cq => cq.AdvisorMarginApplied)
                .HasPrecision(18, 2)
                .IsRequired();
            builder.Property(cq => cq.ScopeSummary)
                .HasMaxLength(2000);
            builder.Property(cq => cq.AdvisorNotes)
                .HasMaxLength(2000);
        });

        // User configuration
        modelBuilder.Entity<User>(builder =>
        {
            builder.HasKey(u => u.Id);
            builder.Property(u => u.Email).IsRequired().HasMaxLength(256);
            builder.Property(u => u.NormalizedEmail).IsRequired().HasMaxLength(256);
            builder.Property(u => u.FullName).IsRequired().HasMaxLength(200);
            builder.Property(u => u.PhoneNumber).HasMaxLength(50);
            builder.Property(u => u.PasswordHash).IsRequired();
            builder.Property(u => u.Salt).IsRequired();

            builder.HasIndex(u => u.NormalizedEmail).IsUnique();

            builder.HasOne(u => u.CustomerProfile)
                .WithOne(cp => cp.User)
                .HasForeignKey<CustomerProfile>(cp => cp.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(u => u.GarageUser)
                .WithOne(gu => gu.User)
                .HasForeignKey<GarageUser>(gu => gu.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(u => u.AdvisorProfile)
                .WithOne(ap => ap.User)
                .HasForeignKey<AdvisorProfile>(ap => ap.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Role configuration
        modelBuilder.Entity<Role>(builder =>
        {
            builder.HasKey(r => r.Id);
            builder.Property(r => r.Name).IsRequired().HasMaxLength(100);
            builder.Property(r => r.NormalizedName).IsRequired().HasMaxLength(100);
            builder.Property(r => r.Description).HasMaxLength(500);

            builder.HasIndex(r => r.NormalizedName).IsUnique();
        });

        // Permission configuration
        modelBuilder.Entity<Permission>(builder =>
        {
            builder.HasKey(p => p.Id);
            builder.Property(p => p.Code).IsRequired().HasMaxLength(100);
            builder.Property(p => p.Description).HasMaxLength(500);
            builder.Property(p => p.Category).HasMaxLength(100);

            builder.HasIndex(p => p.Code).IsUnique();
        });

        // UserRole configuration
        modelBuilder.Entity<UserRole>(builder =>
        {
            builder.HasKey(ur => new { ur.UserId, ur.RoleId });

            builder.HasOne(ur => ur.User)
                .WithMany(u => u.UserRoles)
                .HasForeignKey(ur => ur.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(ur => ur.Role)
                .WithMany(r => r.UserRoles)
                .HasForeignKey(ur => ur.RoleId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // RolePermission configuration
        modelBuilder.Entity<RolePermission>(builder =>
        {
            builder.HasKey(rp => new { rp.RoleId, rp.PermissionId });

            builder.HasOne(rp => rp.Role)
                .WithMany(r => r.RolePermissions)
                .HasForeignKey(rp => rp.RoleId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(rp => rp.Permission)
                .WithMany(p => p.RolePermissions)
                .HasForeignKey(rp => rp.PermissionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // RefreshToken configuration
        modelBuilder.Entity<RefreshToken>(builder =>
        {
            builder.HasKey(rt => rt.Id);
            builder.Property(rt => rt.TokenHash).IsRequired().HasMaxLength(256);
            builder.Property(rt => rt.ReplacedByTokenHash).HasMaxLength(256);
            builder.Property(rt => rt.ReasonRevoked).HasMaxLength(500);

            builder.HasIndex(rt => rt.TokenHash);
            builder.HasIndex(rt => rt.UserId);

            builder.HasOne(rt => rt.User)
                .WithMany(u => u.RefreshTokens)
                .HasForeignKey(rt => rt.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // CustomerProfile configuration
        modelBuilder.Entity<CustomerProfile>(builder =>
        {
            builder.HasKey(cp => cp.Id);
            builder.Property(cp => cp.Address).HasMaxLength(500);
            builder.Property(cp => cp.PreferredContactMethod).HasMaxLength(50);
            builder.HasIndex(cp => cp.UserId).IsUnique();
        });

        // GarageUser configuration
        modelBuilder.Entity<GarageUser>(builder =>
        {
            builder.HasKey(gu => gu.Id);
            builder.Property(gu => gu.RoleName).IsRequired().HasMaxLength(50);
            builder.Property(gu => gu.Title).HasMaxLength(100);
            builder.HasIndex(gu => gu.UserId).IsUnique();

            builder.HasOne(gu => gu.Garage)
                .WithMany()
                .HasForeignKey(gu => gu.GarageId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // AdvisorProfile configuration
        modelBuilder.Entity<AdvisorProfile>(builder =>
        {
            builder.HasKey(ap => ap.Id);
            builder.Property(ap => ap.EmployeeCode).IsRequired().HasMaxLength(50);
            builder.Property(ap => ap.Specialization).HasMaxLength(100);
            builder.HasIndex(ap => ap.UserId).IsUnique();
        });

        // VehicleManufacturer configuration
        modelBuilder.Entity<VehicleManufacturer>(builder =>
        {
            builder.HasKey(vm => vm.Id);
            builder.Property(vm => vm.Name).IsRequired().HasMaxLength(100);
            builder.Property(vm => vm.NormalizedName).IsRequired().HasMaxLength(100);
            builder.Property(vm => vm.Country).HasMaxLength(100);
            builder.Property(vm => vm.LogoUrl).HasMaxLength(500);

            builder.HasIndex(vm => vm.NormalizedName).IsUnique();
            builder.HasIndex(vm => vm.IsActive);
            builder.HasIndex(vm => vm.DisplayOrder);

            builder.HasMany(vm => vm.Models)
                .WithOne(m => m.Manufacturer)
                .HasForeignKey(m => m.ManufacturerId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // VehicleModel configuration
        modelBuilder.Entity<VehicleModel>(builder =>
        {
            builder.HasKey(m => m.Id);
            builder.Property(m => m.Name).IsRequired().HasMaxLength(100);
            builder.Property(m => m.NormalizedName).IsRequired().HasMaxLength(100);
            builder.Property(m => m.BodyType).IsRequired().HasMaxLength(50);

            builder.HasIndex(m => m.ManufacturerId);
            builder.HasIndex(m => new { m.ManufacturerId, m.NormalizedName }).IsUnique();
            builder.HasIndex(m => m.IsActive);

            builder.HasMany(m => m.Variants)
                .WithOne(v => v.Model)
                .HasForeignKey(v => v.ModelId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // VehicleVariant configuration
        modelBuilder.Entity<VehicleVariant>(builder =>
        {
            builder.HasKey(v => v.Id);
            builder.Property(v => v.Name).IsRequired().HasMaxLength(100);
            builder.Property(v => v.Transmission).IsRequired().HasMaxLength(50);

            builder.HasIndex(v => v.ModelId);
            builder.HasIndex(v => new { v.ModelId, v.Name });
            builder.HasIndex(v => v.FuelType);
            builder.HasIndex(v => v.IsActive);
        });

        // CustomerVehicle configuration
        modelBuilder.Entity<CustomerVehicle>(builder =>
        {
            builder.HasKey(cv => cv.Id);
            builder.Property(cv => cv.Make).IsRequired().HasMaxLength(100);
            builder.Property(cv => cv.Model).IsRequired().HasMaxLength(100);
            builder.Property(cv => cv.VariantName).HasMaxLength(100);
            builder.Property(cv => cv.LicensePlate).IsRequired().HasMaxLength(50);
            builder.Property(cv => cv.Vin).HasMaxLength(50);
            builder.Property(cv => cv.Transmission).HasMaxLength(50);
            builder.Property(cv => cv.Color).HasMaxLength(50);

            builder.HasIndex(cv => cv.CustomerId);
            builder.HasIndex(cv => new { cv.CustomerId, cv.IsActive });
            builder.HasIndex(cv => new { cv.CustomerId, cv.IsPrimary });
            builder.HasIndex(cv => cv.ManufacturerId);
            builder.HasIndex(cv => cv.ModelId);

            builder.HasOne(cv => cv.Manufacturer)
                .WithMany()
                .HasForeignKey(cv => cv.ManufacturerId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(cv => cv.ModelEntity)
                .WithMany()
                .HasForeignKey(cv => cv.ModelId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(cv => cv.Variant)
                .WithMany()
                .HasForeignKey(cv => cv.VariantId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // AuditLog configuration
        modelBuilder.Entity<AuditLog>(builder =>
        {
            builder.HasKey(al => al.Id);
            builder.Property(al => al.Action).IsRequired().HasMaxLength(100);
            builder.Property(al => al.UserEmail).HasMaxLength(256);
            builder.Property(al => al.EntityName).HasMaxLength(100);
            builder.Property(al => al.EntityId).HasMaxLength(100);
            builder.Property(al => al.IpAddress).HasMaxLength(50);

            builder.HasIndex(al => al.TimestampUtc);
            builder.HasIndex(al => al.UserId);
            builder.HasIndex(al => al.Action);
        });
    }
}
