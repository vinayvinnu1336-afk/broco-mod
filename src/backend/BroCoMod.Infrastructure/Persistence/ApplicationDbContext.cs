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
    public DbSet<GarageQuoteLineItem> GarageQuoteLineItems => Set<GarageQuoteLineItem>();
    public DbSet<GarageQuoteVersion> GarageQuoteVersions => Set<GarageQuoteVersion>();
    public DbSet<CustomerQuotation> CustomerQuotations => Set<CustomerQuotation>();
    public DbSet<CustomerQuotationLineItem> CustomerQuotationLineItems => Set<CustomerQuotationLineItem>();
    public DbSet<CustomerQuotationVersion> CustomerQuotationVersions => Set<CustomerQuotationVersion>();
    public DbSet<GarageAssignment> GarageAssignments => Set<GarageAssignment>();
    public DbSet<AdvisorRequestNote> AdvisorRequestNotes => Set<AdvisorRequestNote>();
    public DbSet<CustomerQuotationDecision> CustomerQuotationDecisions => Set<CustomerQuotationDecision>();
    public DbSet<ServiceJob> ServiceJobs => Set<ServiceJob>();
    public DbSet<ServiceInspection> ServiceInspections => Set<ServiceInspection>();
    public DbSet<ServiceJobActivity> ServiceJobActivities => Set<ServiceJobActivity>();
    public DbSet<AdditionalWorkRequest> AdditionalWorkRequests => Set<AdditionalWorkRequest>();

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

    // Service Booking & Dispatch
    public DbSet<ServiceLocation> ServiceLocations => Set<ServiceLocation>();
    public DbSet<GarageRequest> GarageRequests => Set<GarageRequest>();
    public DbSet<Notification> Notifications => Set<Notification>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Enable PostGIS extension in PostgreSQL
        modelBuilder.HasPostgresExtension("postgis");

        // Generated atomically via PostgreSQL sequence ServiceRequestNumberSeq.
        // The BM-XXXXXX identifier is a unique human-readable service request reference. Sequence values are not guaranteed to be gapless.
        modelBuilder.HasSequence<long>("ServiceRequestNumberSeq")
            .StartsAt(100001)
            .IncrementsBy(1);

        // Generated atomically via PostgreSQL sequence GarageQuoteNumberSeq.
        // The BQ-XXXXXX identifier is a unique human-readable quote reference. Sequence values are not guaranteed to be gapless.
        modelBuilder.HasSequence<long>("GarageQuoteNumberSeq")
            .StartsAt(100001)
            .IncrementsBy(1);

        // Generated atomically via PostgreSQL sequence CustomerQuotationNumberSeq.
        // The CQ-XXXXXX identifier is a unique human-readable customer quotation reference. Sequence values are not guaranteed to be gapless.
        modelBuilder.HasSequence<long>("CustomerQuotationNumberSeq")
            .StartsAt(100001)
            .IncrementsBy(1);

        // Generated atomically via PostgreSQL sequence ServiceJobNumberSeq.
        // The JOB-XXXXXX identifier is a unique human-readable job reference. Sequence values are not guaranteed to be gapless.
        modelBuilder.HasSequence<long>("ServiceJobNumberSeq")
            .StartsAt(100001)
            .IncrementsBy(1);

        // Garage configuration
        modelBuilder.Entity<Garage>(builder =>
        {
            builder.HasKey(g => g.Id);
            builder.Property(g => g.Name).IsRequired().HasMaxLength(200);
            builder.Property(g => g.Email).IsRequired().HasMaxLength(200);
            builder.Property(g => g.PhoneNumber).HasMaxLength(50);
            builder.Property(g => g.Address).HasMaxLength(500);
            builder.Property(g => g.IsVerified).HasDefaultValue(true);
            builder.Property(g => g.IsOperational).HasDefaultValue(true);
            builder.Property(g => g.Status).HasDefaultValue(GarageStatus.Verified).HasSentinel((GarageStatus)0).IsRequired();
            builder.Property(g => g.ServiceRadiusKm).HasDefaultValue(10.0).IsRequired();
            builder.Property(g => g.StatusReason).HasMaxLength(1000);
            builder.Property(g => g.ConcurrencyToken).IsConcurrencyToken();

            // PostGIS spatial geography column with spatial indexing
            builder.Property(g => g.Location)
                .HasColumnType("geography(Point, 4326)")
                .IsRequired();

            builder.HasIndex(g => g.Location)
                .HasMethod("GIST");

            builder.HasIndex(g => g.Status);
            builder.HasIndex(g => g.IsActive);
        });

        // ServiceLocation configuration
        modelBuilder.Entity<ServiceLocation>(builder =>
        {
            builder.HasKey(sl => sl.Id);
            builder.Property(sl => sl.AddressLine1).IsRequired().HasMaxLength(250);
            builder.Property(sl => sl.AddressLine2).HasMaxLength(250);
            builder.Property(sl => sl.City).IsRequired().HasMaxLength(100);
            builder.Property(sl => sl.State).IsRequired().HasMaxLength(100);
            builder.Property(sl => sl.Pincode).IsRequired().HasMaxLength(20);
            builder.Property(sl => sl.Country).IsRequired().HasMaxLength(100);

            builder.Property(sl => sl.Location)
                .HasColumnType("geography(Point, 4326)")
                .IsRequired();

            builder.HasIndex(sl => sl.Location)
                .HasMethod("GIST");

            builder.HasIndex(sl => sl.City);
            builder.HasIndex(sl => sl.Pincode);
        });

        // ServiceRequest configuration
        modelBuilder.Entity<ServiceRequest>(builder =>
        {
            builder.HasKey(sr => sr.Id);
            builder.Property(sr => sr.RequestNumber).IsRequired().HasMaxLength(50);
            builder.Property(sr => sr.VehicleMake).IsRequired().HasMaxLength(100);
            builder.Property(sr => sr.VehicleModel).IsRequired().HasMaxLength(100);
            builder.Property(sr => sr.VehicleLicensePlate).HasMaxLength(50);
            builder.Property(sr => sr.ProblemDescription).IsRequired().HasMaxLength(4000);
            builder.Property(sr => sr.ServiceCategory).HasMaxLength(100);
            builder.Property(sr => sr.CancellationReason).HasMaxLength(1000);
            builder.Property(sr => sr.IdempotencyKey).HasMaxLength(128);

            // PostGIS spatial geography column with spatial indexing
            builder.Property(sr => sr.CustomerLocation)
                .HasColumnType("geography(Point, 4326)")
                .IsRequired();

            builder.HasIndex(sr => sr.CustomerLocation)
                .HasMethod("GIST");

            builder.HasIndex(sr => sr.RequestNumber).IsUnique();
            builder.HasIndex(sr => sr.CustomerId);
            builder.HasIndex(sr => sr.CustomerVehicleId);
            builder.HasIndex(sr => sr.Status);
            builder.HasIndex(sr => sr.CreatedAtUtc);
            builder.HasIndex(sr => sr.AssignedAdvisorId);
            builder.HasIndex(sr => new { sr.CustomerId, sr.IdempotencyKey });

            builder.HasOne(sr => sr.CustomerProfile)
                .WithMany()
                .HasForeignKey(sr => sr.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(sr => sr.CustomerVehicle)
                .WithMany()
                .HasForeignKey(sr => sr.CustomerVehicleId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(sr => sr.ServiceLocation)
                .WithMany()
                .HasForeignKey(sr => sr.ServiceLocationId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(sr => sr.AssignedAdvisor)
                .WithMany()
                .HasForeignKey(sr => sr.AssignedAdvisorId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.HasMany(sr => sr.GarageRequests)
                .WithOne(gr => gr.ServiceRequest)
                .HasForeignKey(gr => gr.ServiceRequestId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasMany(sr => sr.GarageQuotes)
                .WithOne(gq => gq.ServiceRequest)
                .HasForeignKey(gq => gq.ServiceRequestId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(sr => sr.CustomerQuotation)
                .WithOne(cq => cq.ServiceRequest)
                .HasForeignKey<CustomerQuotation>(cq => cq.ServiceRequestId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // GarageRequest configuration
        modelBuilder.Entity<GarageRequest>(builder =>
        {
            builder.HasKey(gr => gr.Id);
            builder.Property(gr => gr.DeclineReason).HasMaxLength(1000);

            // UNIQUE constraint: Prevent duplicate requests to same garage for same service request
            builder.HasIndex(gr => new { gr.ServiceRequestId, gr.GarageId }).IsUnique();
            builder.HasIndex(gr => gr.GarageId);
            builder.HasIndex(gr => gr.Status);
            builder.HasIndex(gr => gr.CreatedAtUtc);

            builder.HasOne(gr => gr.Garage)
                .WithMany(g => g.GarageRequests)
                .HasForeignKey(gr => gr.GarageId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // Notification configuration
        modelBuilder.Entity<Notification>(builder =>
        {
            builder.HasKey(n => n.Id);
            builder.Property(n => n.Title).IsRequired().HasMaxLength(200);
            builder.Property(n => n.Message).IsRequired().HasMaxLength(2000);
            builder.Property(n => n.Type).IsRequired().HasMaxLength(100);
            builder.Property(n => n.ReferenceType).HasMaxLength(50);
            builder.Property(n => n.MetadataJson).HasMaxLength(4000);
            builder.Property(n => n.Status).HasDefaultValue(NotificationStatus.Sent).HasSentinel((NotificationStatus)0).IsRequired();
            builder.Property(n => n.RetryCount).HasDefaultValue(0).IsRequired();
            builder.Property(n => n.ErrorSummary).HasMaxLength(2000);
            builder.Property(n => n.ConcurrencyToken).IsConcurrencyToken();

            builder.HasIndex(n => n.UserId);
            builder.HasIndex(n => n.IsRead);
            builder.HasIndex(n => n.CreatedAtUtc);
            builder.HasIndex(n => n.Status);

            builder.HasOne(n => n.User)
                .WithMany(u => u.Notifications)
                .HasForeignKey(n => n.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // GarageQuote configuration (Confidential internal quote)
        modelBuilder.Entity<GarageQuote>(builder =>
        {
            builder.HasKey(gq => gq.Id);
            builder.Property(gq => gq.QuoteNumber).IsRequired().HasMaxLength(50);
            builder.Property(gq => gq.Currency).IsRequired().HasMaxLength(10);
            builder.Property(gq => gq.Subtotal).HasPrecision(18, 2);
            builder.Property(gq => gq.TaxAmount).HasPrecision(18, 2);
            builder.Property(gq => gq.DiscountAmount).HasPrecision(18, 2);
            builder.Property(gq => gq.TotalAmount).HasPrecision(18, 2);
            builder.Property(gq => gq.GarageRemarks).HasMaxLength(4000);
            builder.Property(gq => gq.WithdrawalReason).HasMaxLength(1000);
            builder.Property(gq => gq.IdempotencyKey).HasMaxLength(128);

            builder.HasIndex(gq => gq.QuoteNumber).IsUnique();
            builder.HasIndex(gq => gq.GarageRequestId);
            builder.HasIndex(gq => gq.GarageId);
            builder.HasIndex(gq => gq.ServiceRequestId);
            builder.HasIndex(gq => gq.Status);
            builder.HasIndex(gq => gq.ValidUntil);
            builder.HasIndex(gq => gq.SubmittedAtUtc);
            builder.HasIndex(gq => new { gq.GarageId, gq.IdempotencyKey });

            builder.HasOne(gq => gq.Garage)
                .WithMany(g => g.Quotes)
                .HasForeignKey(gq => gq.GarageId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(gq => gq.GarageRequest)
                .WithMany(gr => gr.Quotes)
                .HasForeignKey(gq => gq.GarageRequestId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(gq => gq.ServiceRequest)
                .WithMany(sr => sr.GarageQuotes)
                .HasForeignKey(gq => gq.ServiceRequestId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasMany(gq => gq.LineItems)
                .WithOne(li => li.GarageQuote)
                .HasForeignKey(li => li.GarageQuoteId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasMany(gq => gq.Versions)
                .WithOne(v => v.GarageQuote)
                .HasForeignKey(v => v.GarageQuoteId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // GarageQuoteLineItem configuration
        modelBuilder.Entity<GarageQuoteLineItem>(builder =>
        {
            builder.HasKey(li => li.Id);
            builder.Property(li => li.Description).IsRequired().HasMaxLength(500);
            builder.Property(li => li.Quantity).HasPrecision(18, 2);
            builder.Property(li => li.UnitPrice).HasPrecision(18, 2);
            builder.Property(li => li.TaxRate).HasPrecision(5, 2);
            builder.Property(li => li.DiscountAmount).HasPrecision(18, 2);
            builder.Property(li => li.ItemSubtotal).HasPrecision(18, 2);
            builder.Property(li => li.LineTax).HasPrecision(18, 2);
            builder.Property(li => li.LineTotal).HasPrecision(18, 2);

            builder.HasIndex(li => li.GarageQuoteId);
            builder.HasIndex(li => new { li.GarageQuoteId, li.SortOrder });
        });

        // GarageQuoteVersion configuration
        modelBuilder.Entity<GarageQuoteVersion>(builder =>
        {
            builder.HasKey(v => v.Id);
            builder.Property(v => v.LineItemsJson).IsRequired();
            builder.Property(v => v.Subtotal).HasPrecision(18, 2);
            builder.Property(v => v.TaxAmount).HasPrecision(18, 2);
            builder.Property(v => v.DiscountAmount).HasPrecision(18, 2);
            builder.Property(v => v.TotalAmount).HasPrecision(18, 2);
            builder.Property(v => v.GarageRemarks).HasMaxLength(4000);

            builder.HasIndex(v => v.GarageQuoteId);
            builder.HasIndex(v => new { v.GarageQuoteId, v.VersionNumber }).IsUnique();
        });

        // CustomerQuotation configuration (Sanitized customer proposal)
        modelBuilder.Entity<CustomerQuotation>(builder =>
        {
            builder.HasKey(cq => cq.Id);
            builder.Property(cq => cq.QuotationNumber).IsRequired().HasMaxLength(32);
            builder.Property(cq => cq.Currency).IsRequired().HasMaxLength(10);
            builder.Property(cq => cq.CustomerSubtotal).HasPrecision(18, 2);
            builder.Property(cq => cq.CustomerDiscount).HasPrecision(18, 2);
            builder.Property(cq => cq.CustomerTax).HasPrecision(18, 2);
            builder.Property(cq => cq.CustomerTotal).HasPrecision(18, 2);
            builder.Property(cq => cq.CustomerFacingPrice).HasPrecision(18, 2);
            builder.Property(cq => cq.AdvisorMarginApplied).HasPrecision(18, 2);
            builder.Property(cq => cq.ScopeSummary).HasMaxLength(2000);
            builder.Property(cq => cq.AdvisorNotes).HasMaxLength(2000);
            builder.Property(cq => cq.AdvisorRemarks).HasMaxLength(2000);
            builder.Property(cq => cq.ConcurrencyToken).IsConcurrencyToken();

            builder.HasIndex(cq => cq.QuotationNumber).IsUnique();
            builder.HasIndex(cq => cq.ServiceRequestId);
            builder.HasIndex(cq => cq.AssignedGarageId);
            builder.HasIndex(cq => cq.Status);
            builder.HasIndex(cq => cq.AdvisorId);

            builder.HasOne(cq => cq.ServiceRequest)
                .WithOne(sr => sr.CustomerQuotation)
                .HasForeignKey<CustomerQuotation>(cq => cq.ServiceRequestId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(cq => cq.GarageAssignment)
                .WithMany(ga => ga.CustomerQuotations)
                .HasForeignKey(cq => cq.GarageAssignmentId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.HasMany(cq => cq.LineItems)
                .WithOne(li => li.CustomerQuotation)
                .HasForeignKey(li => li.CustomerQuotationId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasMany(cq => cq.Versions)
                .WithOne(v => v.CustomerQuotation)
                .HasForeignKey(v => v.CustomerQuotationId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // CustomerQuotationLineItem configuration
        modelBuilder.Entity<CustomerQuotationLineItem>(builder =>
        {
            builder.HasKey(li => li.Id);
            builder.Property(li => li.Description).IsRequired().HasMaxLength(500);
            builder.Property(li => li.Quantity).HasPrecision(18, 2);
            builder.Property(li => li.UnitPrice).HasPrecision(18, 2);
            builder.Property(li => li.TaxRate).HasPrecision(5, 2);
            builder.Property(li => li.DiscountAmount).HasPrecision(18, 2);
            builder.Property(li => li.LineTotal).HasPrecision(18, 2);

            builder.HasIndex(li => li.CustomerQuotationId);
            builder.HasIndex(li => new { li.CustomerQuotationId, li.SortOrder });
        });

        // CustomerQuotationVersion configuration
        modelBuilder.Entity<CustomerQuotationVersion>(builder =>
        {
            builder.HasKey(v => v.Id);
            builder.Property(v => v.LineItemsJson).IsRequired();
            builder.Property(v => v.CustomerSubtotal).HasPrecision(18, 2);
            builder.Property(v => v.CustomerDiscount).HasPrecision(18, 2);
            builder.Property(v => v.CustomerTax).HasPrecision(18, 2);
            builder.Property(v => v.CustomerTotal).HasPrecision(18, 2);
            builder.Property(v => v.AdvisorRemarks).HasMaxLength(2000);
            builder.Property(v => v.ScopeSummary).HasMaxLength(2000);

            builder.HasIndex(v => v.CustomerQuotationId);
            builder.HasIndex(v => new { v.CustomerQuotationId, v.VersionNumber }).IsUnique();
        });

        // GarageAssignment configuration
        modelBuilder.Entity<GarageAssignment>(builder =>
        {
            builder.HasKey(ga => ga.Id);
            builder.Property(ga => ga.AssignmentReason).HasMaxLength(1000);
            builder.Property(ga => ga.CancellationReason).HasMaxLength(1000);

            builder.HasIndex(ga => ga.GarageId);
            builder.HasIndex(ga => ga.SelectedQuoteId);
            builder.HasIndex(ga => ga.Status);
            builder.HasIndex(ga => ga.AssignedByAdvisorId);

            // Single active or confirmed assignment constraint per ServiceRequest
            builder.HasIndex(ga => ga.ServiceRequestId)
                .IsUnique()
                .HasFilter("\"Status\" IN (1, 4)"); // Status 1 = Assigned, 4 = Confirmed

            builder.HasOne(ga => ga.ServiceRequest)
                .WithMany(sr => sr.GarageAssignments)
                .HasForeignKey(ga => ga.ServiceRequestId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(ga => ga.Garage)
                .WithMany()
                .HasForeignKey(ga => ga.GarageId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(ga => ga.SelectedQuote)
                .WithMany()
                .HasForeignKey(ga => ga.SelectedQuoteId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // AdvisorRequestNote configuration (Internal notes)
        modelBuilder.Entity<AdvisorRequestNote>(builder =>
        {
            builder.HasKey(n => n.Id);
            builder.Property(n => n.Note).IsRequired().HasMaxLength(2000);
            builder.Property(n => n.AdvisorName).IsRequired().HasMaxLength(200);

            builder.HasIndex(n => n.ServiceRequestId);
            builder.HasIndex(n => n.AdvisorId);
            builder.HasIndex(n => n.CreatedAtUtc);

            builder.HasOne(n => n.ServiceRequest)
                .WithMany(sr => sr.AdvisorNotes)
                .HasForeignKey(n => n.ServiceRequestId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // CustomerQuotationDecision configuration
        modelBuilder.Entity<CustomerQuotationDecision>(builder =>
        {
            builder.HasKey(d => d.Id);
            builder.Property(d => d.DecisionCategory).HasMaxLength(100);
            builder.Property(d => d.DecisionReason).HasMaxLength(1000);
            builder.Property(d => d.IdempotencyKey).HasMaxLength(128);
            builder.Property(d => d.ClientIpAddress).HasMaxLength(45);
            builder.Property(d => d.UserAgent).HasMaxLength(500);

            builder.HasIndex(d => d.CustomerQuotationId).IsUnique(); // At most one decision per quotation
            builder.HasIndex(d => d.CustomerQuotationVersionId);
            builder.HasIndex(d => d.CustomerId);
            builder.HasIndex(d => d.Decision);
            builder.HasIndex(d => d.DecidedAtUtc);
            builder.HasIndex(d => new { d.CustomerId, d.IdempotencyKey });

            builder.HasOne(d => d.CustomerQuotation)
                .WithOne(cq => cq.Decision)
                .HasForeignKey<CustomerQuotationDecision>(d => d.CustomerQuotationId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(d => d.CustomerQuotationVersion)
                .WithMany()
                .HasForeignKey(d => d.CustomerQuotationVersionId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(d => d.Customer)
                .WithMany()
                .HasForeignKey(d => d.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);
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
            builder.HasIndex(al => new { al.EntityName, al.EntityId });
        });

        // ServiceJob configuration (Operational service execution)
        modelBuilder.Entity<ServiceJob>(builder =>
        {
            builder.HasKey(j => j.Id);
            builder.Property(j => j.JobNumber).IsRequired().HasMaxLength(32);
            builder.Property(j => j.CustomerComplaintSnapshot).HasMaxLength(4000);
            builder.Property(j => j.GarageInternalNotes).HasMaxLength(4000);
            builder.Property(j => j.CustomerFacingNotes).HasMaxLength(4000);
            builder.Property(j => j.CancellationReason).HasMaxLength(1000);
            builder.Property(j => j.ConcurrencyToken).IsConcurrencyToken();

            builder.HasIndex(j => j.JobNumber).IsUnique();
            builder.HasIndex(j => j.GarageAssignmentId).IsUnique();
            builder.HasIndex(j => j.ServiceRequestId);
            builder.HasIndex(j => j.GarageId);
            builder.HasIndex(j => j.CustomerQuotationId);
            builder.HasIndex(j => j.Status);
            builder.HasIndex(j => j.ScheduledStartAtUtc);
            builder.HasIndex(j => j.CreatedAtUtc);

            builder.HasOne(j => j.ServiceRequest)
                .WithOne(sr => sr.ServiceJob)
                .HasForeignKey<ServiceJob>(j => j.ServiceRequestId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(j => j.GarageAssignment)
                .WithOne(ga => ga.ServiceJob)
                .HasForeignKey<ServiceJob>(j => j.GarageAssignmentId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(j => j.CustomerQuotation)
                .WithOne(cq => cq.ServiceJob)
                .HasForeignKey<ServiceJob>(j => j.CustomerQuotationId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(j => j.Garage)
                .WithMany(g => g.ServiceJobs)
                .HasForeignKey(j => j.GarageId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasMany(j => j.Inspections)
                .WithOne(i => i.ServiceJob)
                .HasForeignKey(i => i.ServiceJobId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasMany(j => j.Activities)
                .WithOne(a => a.ServiceJob)
                .HasForeignKey(a => a.ServiceJobId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasMany(j => j.AdditionalWorkRequests)
                .WithOne(r => r.ServiceJob)
                .HasForeignKey(r => r.ServiceJobId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ServiceInspection configuration (Workshop intake physical inspection)
        modelBuilder.Entity<ServiceInspection>(builder =>
        {
            builder.HasKey(i => i.Id);
            builder.Property(i => i.Findings).HasMaxLength(4000);
            builder.Property(i => i.Recommendations).HasMaxLength(4000);
            builder.Property(i => i.CustomerVisibleSummary).HasMaxLength(4000);

            builder.HasIndex(i => i.ServiceJobId);
            builder.HasIndex(i => i.InspectorUserId);
            builder.HasIndex(i => i.OverallSeverity);
            builder.HasIndex(i => i.CreatedAtUtc);
        });

        // ServiceJobActivity configuration (Operational activity timeline log)
        modelBuilder.Entity<ServiceJobActivity>(builder =>
        {
            builder.HasKey(a => a.Id);
            builder.Property(a => a.Message).IsRequired().HasMaxLength(2000);

            builder.HasIndex(a => a.ServiceJobId);
            builder.HasIndex(a => a.ActivityType);
            builder.HasIndex(a => a.IsCustomerVisible);
            builder.HasIndex(a => a.CreatedAtUtc);
        });

        // AdditionalWorkRequest configuration (Discovered work needing advisor review)
        modelBuilder.Entity<AdditionalWorkRequest>(builder =>
        {
            builder.HasKey(r => r.Id);
            builder.Property(r => r.Description).IsRequired().HasMaxLength(2000);
            builder.Property(r => r.EstimatedAdditionalAmount).HasPrecision(18, 2);
            builder.Property(r => r.Reason).IsRequired().HasMaxLength(2000);
            builder.Property(r => r.AdvisorRemarks).HasMaxLength(2000);

            builder.HasIndex(r => r.ServiceJobId);
            builder.HasIndex(r => r.Status);
            builder.HasIndex(r => r.ReviewedByAdvisorId);
            builder.HasIndex(r => r.CreatedAtUtc);
        });
    }
}
