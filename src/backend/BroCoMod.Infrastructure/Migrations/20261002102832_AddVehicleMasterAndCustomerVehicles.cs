using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BroCoMod.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddVehicleMasterAndCustomerVehicles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DELETE FROM \"CustomerVehicles\";");

            migrationBuilder.AddColumn<string>(
                name: "Color",
                table: "CustomerVehicles",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "FuelType",
                table: "CustomerVehicles",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "CustomerVehicles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsPrimary",
                table: "CustomerVehicles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "ManufacturerId",
                table: "CustomerVehicles",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "ModelId",
                table: "CustomerVehicles",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<string>(
                name: "Transmission",
                table: "CustomerVehicles",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "VariantId",
                table: "CustomerVehicles",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "VariantName",
                table: "CustomerVehicles",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "VehicleManufacturers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    NormalizedName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Country = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    LogoUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VehicleManufacturers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "VehicleModels",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ManufacturerId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    NormalizedName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    BodyType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    YearFrom = table.Column<int>(type: "integer", nullable: false),
                    YearTo = table.Column<int>(type: "integer", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VehicleModels", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VehicleModels_VehicleManufacturers_ManufacturerId",
                        column: x => x.ManufacturerId,
                        principalTable: "VehicleManufacturers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "VehicleVariants",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ModelId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Transmission = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    FuelType = table.Column<int>(type: "integer", nullable: false),
                    EngineDisplacementCc = table.Column<int>(type: "integer", nullable: true),
                    Horsepower = table.Column<int>(type: "integer", nullable: true),
                    YearFrom = table.Column<int>(type: "integer", nullable: false),
                    YearTo = table.Column<int>(type: "integer", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VehicleVariants", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VehicleVariants_VehicleModels_ModelId",
                        column: x => x.ModelId,
                        principalTable: "VehicleModels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CustomerVehicles_CustomerId_IsActive",
                table: "CustomerVehicles",
                columns: new[] { "CustomerId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_CustomerVehicles_CustomerId_IsPrimary",
                table: "CustomerVehicles",
                columns: new[] { "CustomerId", "IsPrimary" });

            migrationBuilder.CreateIndex(
                name: "IX_CustomerVehicles_ManufacturerId",
                table: "CustomerVehicles",
                column: "ManufacturerId");

            migrationBuilder.CreateIndex(
                name: "IX_CustomerVehicles_ModelId",
                table: "CustomerVehicles",
                column: "ModelId");

            migrationBuilder.CreateIndex(
                name: "IX_CustomerVehicles_VariantId",
                table: "CustomerVehicles",
                column: "VariantId");

            migrationBuilder.CreateIndex(
                name: "IX_VehicleManufacturers_DisplayOrder",
                table: "VehicleManufacturers",
                column: "DisplayOrder");

            migrationBuilder.CreateIndex(
                name: "IX_VehicleManufacturers_IsActive",
                table: "VehicleManufacturers",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_VehicleManufacturers_NormalizedName",
                table: "VehicleManufacturers",
                column: "NormalizedName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_VehicleModels_IsActive",
                table: "VehicleModels",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_VehicleModels_ManufacturerId",
                table: "VehicleModels",
                column: "ManufacturerId");

            migrationBuilder.CreateIndex(
                name: "IX_VehicleModels_ManufacturerId_NormalizedName",
                table: "VehicleModels",
                columns: new[] { "ManufacturerId", "NormalizedName" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_VehicleVariants_FuelType",
                table: "VehicleVariants",
                column: "FuelType");

            migrationBuilder.CreateIndex(
                name: "IX_VehicleVariants_IsActive",
                table: "VehicleVariants",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_VehicleVariants_ModelId",
                table: "VehicleVariants",
                column: "ModelId");

            migrationBuilder.CreateIndex(
                name: "IX_VehicleVariants_ModelId_Name",
                table: "VehicleVariants",
                columns: new[] { "ModelId", "Name" });

            migrationBuilder.AddForeignKey(
                name: "FK_CustomerVehicles_VehicleManufacturers_ManufacturerId",
                table: "CustomerVehicles",
                column: "ManufacturerId",
                principalTable: "VehicleManufacturers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_CustomerVehicles_VehicleModels_ModelId",
                table: "CustomerVehicles",
                column: "ModelId",
                principalTable: "VehicleModels",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_CustomerVehicles_VehicleVariants_VariantId",
                table: "CustomerVehicles",
                column: "VariantId",
                principalTable: "VehicleVariants",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CustomerVehicles_VehicleManufacturers_ManufacturerId",
                table: "CustomerVehicles");

            migrationBuilder.DropForeignKey(
                name: "FK_CustomerVehicles_VehicleModels_ModelId",
                table: "CustomerVehicles");

            migrationBuilder.DropForeignKey(
                name: "FK_CustomerVehicles_VehicleVariants_VariantId",
                table: "CustomerVehicles");

            migrationBuilder.DropTable(
                name: "VehicleVariants");

            migrationBuilder.DropTable(
                name: "VehicleModels");

            migrationBuilder.DropTable(
                name: "VehicleManufacturers");

            migrationBuilder.DropIndex(
                name: "IX_CustomerVehicles_CustomerId_IsActive",
                table: "CustomerVehicles");

            migrationBuilder.DropIndex(
                name: "IX_CustomerVehicles_CustomerId_IsPrimary",
                table: "CustomerVehicles");

            migrationBuilder.DropIndex(
                name: "IX_CustomerVehicles_ManufacturerId",
                table: "CustomerVehicles");

            migrationBuilder.DropIndex(
                name: "IX_CustomerVehicles_ModelId",
                table: "CustomerVehicles");

            migrationBuilder.DropIndex(
                name: "IX_CustomerVehicles_VariantId",
                table: "CustomerVehicles");

            migrationBuilder.DropColumn(
                name: "Color",
                table: "CustomerVehicles");

            migrationBuilder.DropColumn(
                name: "FuelType",
                table: "CustomerVehicles");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "CustomerVehicles");

            migrationBuilder.DropColumn(
                name: "IsPrimary",
                table: "CustomerVehicles");

            migrationBuilder.DropColumn(
                name: "ManufacturerId",
                table: "CustomerVehicles");

            migrationBuilder.DropColumn(
                name: "ModelId",
                table: "CustomerVehicles");

            migrationBuilder.DropColumn(
                name: "Transmission",
                table: "CustomerVehicles");

            migrationBuilder.DropColumn(
                name: "VariantId",
                table: "CustomerVehicles");

            migrationBuilder.DropColumn(
                name: "VariantName",
                table: "CustomerVehicles");
        }
    }
}
