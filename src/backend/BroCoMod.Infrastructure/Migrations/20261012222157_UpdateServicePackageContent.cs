using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BroCoMod.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UpdateServicePackageContent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<decimal>(
                name: "DurationHours",
                table: "ServicePackages",
                type: "numeric(4,1)",
                precision: 4,
                scale: 1,
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer");

            // Package content supplied by BroCo (October 2026). Fresh databases get the same text from SeedData/service-packages.json.
            migrationBuilder.Sql(@"UPDATE ""ServicePackages"" SET ""Name"" = 'Basic Service', ""Tagline"" = 'Essential oil change, top-ups and a complete health check with OBD scan.', ""IntervalKm"" = 5000, ""IntervalMonths"" = 6, ""DurationHours"" = 3.5, ""WarrantyKm"" = 1000, ""WarrantyDays"" = 90, ""Includes"" = ARRAY['Fluids & Filters: Engine Oil (5W-30 Synthetic) + Oil Filter Replacement', 'Fluids & Filters: Coolant Top-Up (200 ml)', 'Fluids & Filters: Brake Fluid Top-Up', 'Fluids & Filters: Wiper Fluid Refill', 'Fluids & Filters: Air & AC Filter Cleaning', 'Safety Inspections: Spark / Glow Plug Check', 'Safety Inspections: Battery Health & Terminals Check', 'Health Report: Complete Vehicle Inspection + OBD Diagnostic Scan', 'Spa: Premium Foam Wash + Interior Vacuuming', 'Convenience: FREE Pick-up & Drop']::text[], ""UpdatedAtUtc"" = now() WHERE ""Code"" = 'BASIC';");
            migrationBuilder.Sql(@"UPDATE ""ServicePackages"" SET ""Name"" = 'Standard Service', ""Tagline"" = 'Our most-booked service: adds air filter replacement, brake care and plug cleaning.', ""IntervalKm"" = 10000, ""IntervalMonths"" = 12, ""DurationHours"" = 5, ""WarrantyKm"" = 2000, ""WarrantyDays"" = 90, ""Includes"" = ARRAY['Fluids & Filters: Engine Oil (5W-30 Synthetic) + Oil Filter Replacement', 'Fluids & Filters: Air Filter Replacement', 'Fluids & Filters: Coolant Top-Up (200 ml)', 'Fluids & Filters: Brake Fluid Top-Up', 'Fluids & Filters: Wiper Fluid Refill', 'Fluids & Filters: AC Filter Cleaning', 'Brake Care: Front Brake Cleaning + Rear Drum Cleaning + Brake Fluid Check & Adjustment', 'Safety Inspections: Spark / Glow Plug Check & Cleaning', 'Safety Inspections: Battery Health & Terminals Check', 'Health Report: Complete Vehicle Inspection + OBD Diagnostic Scan', 'Spa: Premium Foam Wash + Interior Vacuuming & Dashboard Polish', 'Convenience: FREE Pick-up & Drop']::text[], ""UpdatedAtUtc"" = now() WHERE ""Code"" = 'STANDARD';");
            migrationBuilder.Sql(@"UPDATE ""ServicePackages"" SET ""Name"" = 'Premium Service', ""Tagline"" = 'Complete care: wheel alignment & balancing, throttle body cleaning and a deep spa.', ""IntervalKm"" = 15000, ""IntervalMonths"" = 12, ""DurationHours"" = 7, ""WarrantyKm"" = 3000, ""WarrantyDays"" = 90, ""Includes"" = ARRAY['Fluids & Filters: Engine Oil (5W-30 Synthetic) + Oil Filter Replacement', 'Fluids & Filters: Air Filter Replacement', 'Fluids & Filters: AC Filter Replacement', 'Fluids & Filters: Fuel Filter Checking & Cleaning', 'Fluids & Filters: Coolant Top-Up (300 ml)', 'Fluids & Filters: Brake Fluid Top-Up', 'Fluids & Filters: Wiper Fluid Refill', 'Fluids & Filters: Gear Oil Top-Up', 'Brake Care: Front Brake Cleaning + Rear Drum Cleaning + Handbrake Adjustment', 'Performance Care: Throttle Body Cleaning', 'Wheel Care: Wheel Alignment + Wheel Balancing + Tyre Rotation (If Required)', 'Safety Inspections: Spark / Glow Plug Check, Cleaning & Gap Adjustment', 'Safety Inspections: Battery Health, Terminals & Water Check', 'Health Report: Complete Vehicle Inspection + OBD Diagnostic Scan', 'Spa: Premium Foam Wash + Interior Deep Vacuuming + Dashboard & Tyre Polish', 'Convenience: FREE Pick-up & Drop']::text[], ""UpdatedAtUtc"" = now() WHERE ""Code"" = 'PREMIUM';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "DurationHours",
                table: "ServicePackages",
                type: "integer",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(4,1)",
                oldPrecision: 4,
                oldScale: 1);
        }
    }
}
