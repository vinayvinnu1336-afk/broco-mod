using System.Globalization;
using System.Text;
using BroCoMod.Domain.Enums;
using BroCoMod.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BroCoMod.Infrastructure.Migrations
{
    /// <summary>
    /// Owner's pricing rule of Oct 2026: every package costs GoMechanic's Hyderabad price for that model and fuel plus ₹350.
    /// Sets existing prices from SeedData/package-prices-by-model.json (new databases get them from the seeder). Rows the
    /// file keeps at BroCo's own price, and models or fuels it doesn't list, are left as they are. Data only: no schema change.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261024090000_PackagePricesFromGoMechanic")]
    public partial class PackagePricesFromGoMechanic : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            var values = new List<string>();
            foreach (var entry in ModelPackagePrices.Entries)
            {
                if (entry.Basis != null && entry.Basis.StartsWith("kept", StringComparison.OrdinalIgnoreCase)) continue;
                if (!Enum.TryParse<FuelType>(entry.Fuel, true, out var fuel)) continue;
                foreach (var (code, price) in ModelPackagePrices.PricesOf(entry))
                {
                    values.Add($"({Quote(entry.Brand)}, {Quote(entry.Model)}, {(int)fuel}, {Quote(code)}, {price.ToString(CultureInfo.InvariantCulture)})");
                }
            }
            if (values.Count == 0) return;

            var sql = new StringBuilder();
            sql.AppendLine(@"UPDATE ""ServicePackagePrices"" p SET ""Price"" = v.price, ""UpdatedAtUtc"" = now()");
            sql.AppendLine("FROM (VALUES");
            sql.AppendLine(string.Join(",\n", values));
            sql.AppendLine(@") AS v(brand, model, fuel, code, price)");
            sql.AppendLine(@"JOIN ""VehicleManufacturers"" mf ON upper(trim(mf.""Name"")) = upper(v.brand)");
            sql.AppendLine(@"JOIN ""VehicleModels"" vm ON vm.""ManufacturerId"" = mf.""Id"" AND upper(trim(vm.""Name"")) = upper(v.model)");
            sql.AppendLine(@"JOIN ""ServicePackages"" sp ON sp.""Code"" = v.code");
            sql.AppendLine(@"WHERE p.""VehicleModelId"" = vm.""Id"" AND p.""ServicePackageId"" = sp.""Id"" AND p.""FuelType"" = v.fuel;");
            migrationBuilder.Sql(sql.ToString());
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // The earlier per-segment prices aren't kept; set prices from Admin → Vehicle master if this is rolled back.
        }

        private static string Quote(string value) => "'" + value.Replace("'", "''") + "'";
    }
}
