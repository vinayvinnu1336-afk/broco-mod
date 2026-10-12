using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BroCoMod.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPackagesCommissionAndLeads : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateSequence(
                name: "CommissionNumberSeq",
                startValue: 100001L);

            migrationBuilder.AddColumn<List<string>>(
                name: "Fuels",
                table: "VehicleModels",
                type: "text[]",
                nullable: false,
                defaultValueSql: "'{}'::text[]");

            migrationBuilder.AddColumn<string>(
                name: "Segment",
                table: "VehicleModels",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Hatchback");

            migrationBuilder.AddColumn<bool>(
                name: "IsPopular",
                table: "VehicleManufacturers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "AdvancePaidAmount",
                table: "ServiceRequests",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<DateTime>(
                name: "AdvancePaidAtUtc",
                table: "ServiceRequests",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "AdvancePaymentId",
                table: "ServiceRequests",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PackagePrice",
                table: "ServiceRequests",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ServicePackageCode",
                table: "ServiceRequests",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ServicePackageId",
                table: "ServiceRequests",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ServicePackageName",
                table: "ServiceRequests",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "VehicleFuel",
                table: "ServiceRequests",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "GarageId",
                table: "Payments",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "GarageCommissionId",
                table: "Payments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ServiceRequestId",
                table: "Payments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "GarageId",
                table: "Invoices",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.CreateTable(
                name: "GarageCommissions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CommissionNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    GarageId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceJobId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    Currency = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    ServiceValue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    AdvanceCollectedByPlatform = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    BalanceCollectedByGarage = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CommissionPercentage = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    CommissionAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TaxPercentage = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    TaxAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalDue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    DueAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PaidAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PaymentId = table.Column<Guid>(type: "uuid", nullable: true),
                    PaymentReference = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    SettledVia = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    SettledByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    WaiverReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    RemindersSent = table.Column<int>(type: "integer", nullable: false),
                    LastReminderAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GarageCommissions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GarageCommissions_Garages_GarageId",
                        column: x => x.GarageId,
                        principalTable: "Garages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_GarageCommissions_ServiceJobs_ServiceJobId",
                        column: x => x.ServiceJobId,
                        principalTable: "ServiceJobs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_GarageCommissions_ServiceRequests_ServiceRequestId",
                        column: x => x.ServiceRequestId,
                        principalTable: "ServiceRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Leads",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    MobileNumber = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    City = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    VehicleModelId = table.Column<Guid>(type: "uuid", nullable: true),
                    VehicleSummary = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    FuelType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    ServiceInterest = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Source = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Leads", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ServicePackages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Tagline = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    IntervalKm = table.Column<int>(type: "integer", nullable: false),
                    IntervalMonths = table.Column<int>(type: "integer", nullable: false),
                    DurationHours = table.Column<int>(type: "integer", nullable: false),
                    WarrantyKm = table.Column<int>(type: "integer", nullable: false),
                    WarrantyDays = table.Column<int>(type: "integer", nullable: false),
                    Includes = table.Column<List<string>>(type: "text[]", nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    IsRecommended = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServicePackages", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "VehicleManufacturerLogos",
                columns: table => new
                {
                    ManufacturerId = table.Column<Guid>(type: "uuid", nullable: false),
                    Content = table.Column<byte[]>(type: "bytea", nullable: false),
                    ContentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VehicleManufacturerLogos", x => x.ManufacturerId);
                    table.ForeignKey(
                        name: "FK_VehicleManufacturerLogos_VehicleManufacturers_ManufacturerId",
                        column: x => x.ManufacturerId,
                        principalTable: "VehicleManufacturers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ServicePackagePrices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ServicePackageId = table.Column<Guid>(type: "uuid", nullable: false),
                    VehicleModelId = table.Column<Guid>(type: "uuid", nullable: false),
                    FuelType = table.Column<int>(type: "integer", nullable: false),
                    Price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServicePackagePrices", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ServicePackagePrices_ServicePackages_ServicePackageId",
                        column: x => x.ServicePackageId,
                        principalTable: "ServicePackages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ServicePackagePrices_VehicleModels_VehicleModelId",
                        column: x => x.VehicleModelId,
                        principalTable: "VehicleModels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_VehicleManufacturers_IsPopular",
                table: "VehicleManufacturers",
                column: "IsPopular");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceRequests_ServicePackageId",
                table: "ServiceRequests",
                column: "ServicePackageId");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_GarageCommissionId",
                table: "Payments",
                column: "GarageCommissionId");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_ServiceRequestId",
                table: "Payments",
                column: "ServiceRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_GarageCommissions_CommissionNumber",
                table: "GarageCommissions",
                column: "CommissionNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GarageCommissions_GarageId_Status",
                table: "GarageCommissions",
                columns: new[] { "GarageId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_GarageCommissions_ServiceJobId",
                table: "GarageCommissions",
                column: "ServiceJobId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GarageCommissions_ServiceRequestId",
                table: "GarageCommissions",
                column: "ServiceRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_GarageCommissions_Status_DueAtUtc",
                table: "GarageCommissions",
                columns: new[] { "Status", "DueAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_Leads_CreatedAtUtc",
                table: "Leads",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_Leads_Status",
                table: "Leads",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_ServicePackagePrices_ServicePackageId_VehicleModelId_FuelTy~",
                table: "ServicePackagePrices",
                columns: new[] { "ServicePackageId", "VehicleModelId", "FuelType" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ServicePackagePrices_VehicleModelId",
                table: "ServicePackagePrices",
                column: "VehicleModelId");

            migrationBuilder.CreateIndex(
                name: "IX_ServicePackages_Code",
                table: "ServicePackages",
                column: "Code",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GarageCommissions");

            migrationBuilder.DropTable(
                name: "Leads");

            migrationBuilder.DropTable(
                name: "ServicePackagePrices");

            migrationBuilder.DropTable(
                name: "VehicleManufacturerLogos");

            migrationBuilder.DropTable(
                name: "ServicePackages");

            migrationBuilder.DropIndex(
                name: "IX_VehicleManufacturers_IsPopular",
                table: "VehicleManufacturers");

            migrationBuilder.DropIndex(
                name: "IX_ServiceRequests_ServicePackageId",
                table: "ServiceRequests");

            migrationBuilder.DropIndex(
                name: "IX_Payments_GarageCommissionId",
                table: "Payments");

            migrationBuilder.DropIndex(
                name: "IX_Payments_ServiceRequestId",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "Fuels",
                table: "VehicleModels");

            migrationBuilder.DropColumn(
                name: "Segment",
                table: "VehicleModels");

            migrationBuilder.DropColumn(
                name: "IsPopular",
                table: "VehicleManufacturers");

            migrationBuilder.DropColumn(
                name: "AdvancePaidAmount",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "AdvancePaidAtUtc",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "AdvancePaymentId",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "PackagePrice",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "ServicePackageCode",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "ServicePackageId",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "ServicePackageName",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "VehicleFuel",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "GarageCommissionId",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "ServiceRequestId",
                table: "Payments");

            migrationBuilder.DropSequence(
                name: "CommissionNumberSeq");

            migrationBuilder.AlterColumn<Guid>(
                name: "GarageId",
                table: "Payments",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "GarageId",
                table: "Invoices",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);
        }
    }
}
