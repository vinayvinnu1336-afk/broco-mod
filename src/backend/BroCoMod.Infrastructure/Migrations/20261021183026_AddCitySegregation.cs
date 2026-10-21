using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BroCoMod.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCitySegregation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "City",
                table: "ServiceRequests",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "City",
                table: "Garages",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "City",
                table: "AdvisorProfiles",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "RemovedAtUtc",
                table: "AdvisorProfiles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ServiceRequests_City",
                table: "ServiceRequests",
                column: "City");

            migrationBuilder.CreateIndex(
                name: "IX_Garages_City",
                table: "Garages",
                column: "City");

            migrationBuilder.CreateIndex(
                name: "IX_AdvisorProfiles_City",
                table: "AdvisorProfiles",
                column: "City");

            // Backfill. The three live service areas as configured in appsettings ServiceAreas when this migration
            // was written (centre and radius); the nearest area containing the pin wins, else the address decides.
            const string areas = """
                WITH areas(city, lat, lng, radius_km) AS (
                    VALUES ('Hyderabad', 17.385, 78.4867, 40), ('Bengaluru', 12.9716, 77.5946, 40), ('Mancherial', 18.8714, 79.4443, 25))
                """;

            migrationBuilder.Sql(areas + """

                UPDATE "Garages" g
                SET "City" = COALESCE((
                    SELECT a.city FROM areas a
                    WHERE ST_DWithin(g."Location", ST_SetSRID(ST_MakePoint(a.lng, a.lat), 4326)::geography, a.radius_km * 1000)
                    ORDER BY ST_Distance(g."Location", ST_SetSRID(ST_MakePoint(a.lng, a.lat), 4326)::geography)
                    LIMIT 1), '')
                WHERE g."City" = '';
                """);

            migrationBuilder.Sql("""
                UPDATE "Garages"
                SET "City" = CASE
                    WHEN "Address" ILIKE '%hyderabad%' OR "Address" ILIKE '%secunderabad%' THEN 'Hyderabad'
                    WHEN "Address" ILIKE '%bengaluru%' OR "Address" ILIKE '%bangalore%' THEN 'Bengaluru'
                    WHEN "Address" ILIKE '%mancherial%' THEN 'Mancherial'
                    ELSE '' END
                WHERE "City" = '';
                """);

            migrationBuilder.Sql(areas + """

                UPDATE "ServiceRequests" sr
                SET "City" = COALESCE((
                    SELECT a.city FROM areas a
                    WHERE ST_DWithin(sr."CustomerLocation", ST_SetSRID(ST_MakePoint(a.lng, a.lat), 4326)::geography, a.radius_km * 1000)
                    ORDER BY ST_Distance(sr."CustomerLocation", ST_SetSRID(ST_MakePoint(a.lng, a.lat), 4326)::geography)
                    LIMIT 1), '')
                WHERE sr."City" = '';
                """);

            migrationBuilder.Sql("""
                UPDATE "ServiceRequests" sr
                SET "City" = CASE
                    WHEN lower(sl."City") IN ('hyderabad', 'secunderabad') OR left(sl."Pincode", 3) IN ('500', '501', '502') THEN 'Hyderabad'
                    WHEN lower(sl."City") IN ('bengaluru', 'bangalore') OR left(sl."Pincode", 3) IN ('560', '562') THEN 'Bengaluru'
                    WHEN lower(sl."City") = 'mancherial' OR left(sl."Pincode", 3) = '504' THEN 'Mancherial'
                    ELSE '' END
                FROM "ServiceLocations" sl
                WHERE sl."Id" = sr."ServiceLocationId" AND sr."City" = '';
                """);

            // Every advisor starts in Hyderabad; the owner moves them in Admin → Advisors.
            migrationBuilder.Sql("""UPDATE "AdvisorProfiles" SET "City" = 'Hyderabad' WHERE "City" = '';""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ServiceRequests_City",
                table: "ServiceRequests");

            migrationBuilder.DropIndex(
                name: "IX_Garages_City",
                table: "Garages");

            migrationBuilder.DropIndex(
                name: "IX_AdvisorProfiles_City",
                table: "AdvisorProfiles");

            migrationBuilder.DropColumn(
                name: "City",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "City",
                table: "Garages");

            migrationBuilder.DropColumn(
                name: "City",
                table: "AdvisorProfiles");

            migrationBuilder.DropColumn(
                name: "RemovedAtUtc",
                table: "AdvisorProfiles");
        }
    }
}
