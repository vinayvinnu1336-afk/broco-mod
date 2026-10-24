using BroCoMod.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BroCoMod.Infrastructure.Migrations
{
    /// <summary>
    /// Owner's change of Oct 2026: every package (Basic, Standard, Premium) carries a 1,000 km warranty, matching the
    /// "Up to 1,000 km warranty" line on the homepage. New databases get it from service-packages.json. Data only.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261024150000_PackageWarranty1000Km")]
    public partial class PackageWarranty1000Km : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"UPDATE ""ServicePackages"" SET ""WarrantyKm"" = 1000, ""UpdatedAtUtc"" = now() WHERE ""WarrantyKm"" > 1000;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"UPDATE ""ServicePackages"" SET ""WarrantyKm"" = 2000 WHERE ""Code"" = 'STANDARD';");
            migrationBuilder.Sql(@"UPDATE ""ServicePackages"" SET ""WarrantyKm"" = 3000 WHERE ""Code"" = 'PREMIUM';");
        }
    }
}
