using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Entities;
using Microsoft.EntityFrameworkCore;

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
    }
}
