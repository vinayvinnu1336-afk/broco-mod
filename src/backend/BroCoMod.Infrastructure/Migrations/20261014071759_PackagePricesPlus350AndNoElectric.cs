using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BroCoMod.Infrastructure.Migrations
{
    /// <summary>
    /// Owner's catalogue changes of Oct 2026 for databases seeded earlier (new databases get them from the seed files):
    /// every package price goes up by ₹350; BroCo doesn't service electric cars, so electric-only models are retired
    /// and Electric is dropped from mixed fuel lists; BYD, Daewoo and DC Design are retired, as are Tesla, VinFast and
    /// Jayem, which only sold electric cars. Rows are deactivated, not deleted, so existing customer cars and bookings keep
    /// their history.
    /// </summary>
    public partial class PackagePricesPlus350AndNoElectric : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"UPDATE ""ServicePackagePrices"" SET ""Price"" = ""Price"" + 350, ""UpdatedAtUtc"" = now();");

            migrationBuilder.Sql(@"
UPDATE ""VehicleModels"" SET ""IsActive"" = false, ""UpdatedAtUtc"" = now()
WHERE ""IsActive"" AND ""Fuels"" = ARRAY['Electric']::text[];

UPDATE ""VehicleModels"" SET ""Fuels"" = array_remove(""Fuels"", 'Electric'), ""UpdatedAtUtc"" = now()
WHERE 'Electric' = ANY(""Fuels"") AND cardinality(""Fuels"") > 1;

UPDATE ""VehicleManufacturers"" SET ""IsActive"" = false, ""UpdatedAtUtc"" = now(), ""LogoUrl"" = CASE WHEN ""LogoUrl"" LIKE '/brands/%' THEN '' ELSE ""LogoUrl"" END
WHERE ""NormalizedName"" IN ('BYD', 'DAEWOO', 'DC DESIGN', 'TESLA', 'VINFAST', 'JAYEM');");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Only the price change is reversed; retired models and brands can be switched back on from Admin → Vehicle master.
            migrationBuilder.Sql(@"UPDATE ""ServicePackagePrices"" SET ""Price"" = ""Price"" - 350, ""UpdatedAtUtc"" = now();");
        }
    }
}
