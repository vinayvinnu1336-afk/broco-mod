using System;
using Microsoft.EntityFrameworkCore.Migrations;
using NetTopologySuite.Geometries;

#nullable disable

namespace BroCoMod.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddServiceRequestAndGarageDispatch : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DELETE FROM \"CustomerQuotations\";");
            migrationBuilder.Sql("DELETE FROM \"GarageQuotes\";");
            migrationBuilder.Sql("DELETE FROM \"ServiceRequests\";");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "ServiceRequests");

            migrationBuilder.CreateSequence(
                name: "ServiceRequestNumberSeq",
                startValue: 100001L);

            migrationBuilder.AddColumn<Guid>(
                name: "AssignedAdvisorId",
                table: "ServiceRequests",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CancellationReason",
                table: "ServiceRequests",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CancelledAtUtc",
                table: "ServiceRequests",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CustomerVehicleId",
                table: "ServiceRequests",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IdempotencyKey",
                table: "ServiceRequests",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PreferredServiceDate",
                table: "ServiceRequests",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProblemDescription",
                table: "ServiceRequests",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "RequestNumber",
                table: "ServiceRequests",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ServiceCategory",
                table: "ServiceRequests",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "ServiceLocationId",
                table: "ServiceRequests",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SubmittedAtUtc",
                table: "ServiceRequests",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "VehicleLicensePlate",
                table: "ServiceRequests",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "IsOperational",
                table: "Garages",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsVerified",
                table: "Garages",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.CreateTable(
                name: "GarageRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    GarageId = table.Column<Guid>(type: "uuid", nullable: false),
                    DistanceKm = table.Column<double>(type: "double precision", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    SentAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ViewedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RespondedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeclinedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ExpiredAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeclineReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GarageRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GarageRequests_Garages_GarageId",
                        column: x => x.GarageId,
                        principalTable: "Garages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_GarageRequests_ServiceRequests_ServiceRequestId",
                        column: x => x.ServiceRequestId,
                        principalTable: "ServiceRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Notifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Message = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Channel = table.Column<int>(type: "integer", nullable: false),
                    Type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ReferenceId = table.Column<Guid>(type: "uuid", nullable: true),
                    ReferenceType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    IsRead = table.Column<bool>(type: "boolean", nullable: false),
                    ReadAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SentAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    MetadataJson = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    ServiceRequestId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Notifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Notifications_ServiceRequests_ServiceRequestId",
                        column: x => x.ServiceRequestId,
                        principalTable: "ServiceRequests",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Notifications_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ServiceLocations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AddressLine1 = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    AddressLine2 = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: true),
                    City = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    State = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Pincode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Country = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Location = table.Column<Point>(type: "geography(Point, 4326)", nullable: false),
                    Latitude = table.Column<double>(type: "double precision", nullable: false),
                    Longitude = table.Column<double>(type: "double precision", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServiceLocations", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ServiceRequests_AssignedAdvisorId",
                table: "ServiceRequests",
                column: "AssignedAdvisorId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceRequests_CreatedAtUtc",
                table: "ServiceRequests",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceRequests_CustomerId",
                table: "ServiceRequests",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceRequests_CustomerId_IdempotencyKey",
                table: "ServiceRequests",
                columns: new[] { "CustomerId", "IdempotencyKey" });

            migrationBuilder.CreateIndex(
                name: "IX_ServiceRequests_CustomerVehicleId",
                table: "ServiceRequests",
                column: "CustomerVehicleId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceRequests_RequestNumber",
                table: "ServiceRequests",
                column: "RequestNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ServiceRequests_ServiceLocationId",
                table: "ServiceRequests",
                column: "ServiceLocationId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceRequests_Status",
                table: "ServiceRequests",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_GarageRequests_CreatedAtUtc",
                table: "GarageRequests",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_GarageRequests_GarageId",
                table: "GarageRequests",
                column: "GarageId");

            migrationBuilder.CreateIndex(
                name: "IX_GarageRequests_ServiceRequestId_GarageId",
                table: "GarageRequests",
                columns: new[] { "ServiceRequestId", "GarageId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GarageRequests_Status",
                table: "GarageRequests",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_CreatedAtUtc",
                table: "Notifications",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_IsRead",
                table: "Notifications",
                column: "IsRead");

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_ServiceRequestId",
                table: "Notifications",
                column: "ServiceRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_UserId",
                table: "Notifications",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceLocations_City",
                table: "ServiceLocations",
                column: "City");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceLocations_Location",
                table: "ServiceLocations",
                column: "Location")
                .Annotation("Npgsql:IndexMethod", "GIST");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceLocations_Pincode",
                table: "ServiceLocations",
                column: "Pincode");

            migrationBuilder.AddForeignKey(
                name: "FK_ServiceRequests_AdvisorProfiles_AssignedAdvisorId",
                table: "ServiceRequests",
                column: "AssignedAdvisorId",
                principalTable: "AdvisorProfiles",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_ServiceRequests_CustomerProfiles_CustomerId",
                table: "ServiceRequests",
                column: "CustomerId",
                principalTable: "CustomerProfiles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ServiceRequests_CustomerVehicles_CustomerVehicleId",
                table: "ServiceRequests",
                column: "CustomerVehicleId",
                principalTable: "CustomerVehicles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ServiceRequests_ServiceLocations_ServiceLocationId",
                table: "ServiceRequests",
                column: "ServiceLocationId",
                principalTable: "ServiceLocations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ServiceRequests_AdvisorProfiles_AssignedAdvisorId",
                table: "ServiceRequests");

            migrationBuilder.DropForeignKey(
                name: "FK_ServiceRequests_CustomerProfiles_CustomerId",
                table: "ServiceRequests");

            migrationBuilder.DropForeignKey(
                name: "FK_ServiceRequests_CustomerVehicles_CustomerVehicleId",
                table: "ServiceRequests");

            migrationBuilder.DropForeignKey(
                name: "FK_ServiceRequests_ServiceLocations_ServiceLocationId",
                table: "ServiceRequests");

            migrationBuilder.DropTable(
                name: "GarageRequests");

            migrationBuilder.DropTable(
                name: "Notifications");

            migrationBuilder.DropTable(
                name: "ServiceLocations");

            migrationBuilder.DropIndex(
                name: "IX_ServiceRequests_AssignedAdvisorId",
                table: "ServiceRequests");

            migrationBuilder.DropIndex(
                name: "IX_ServiceRequests_CreatedAtUtc",
                table: "ServiceRequests");

            migrationBuilder.DropIndex(
                name: "IX_ServiceRequests_CustomerId",
                table: "ServiceRequests");

            migrationBuilder.DropIndex(
                name: "IX_ServiceRequests_CustomerId_IdempotencyKey",
                table: "ServiceRequests");

            migrationBuilder.DropIndex(
                name: "IX_ServiceRequests_CustomerVehicleId",
                table: "ServiceRequests");

            migrationBuilder.DropIndex(
                name: "IX_ServiceRequests_RequestNumber",
                table: "ServiceRequests");

            migrationBuilder.DropIndex(
                name: "IX_ServiceRequests_ServiceLocationId",
                table: "ServiceRequests");

            migrationBuilder.DropIndex(
                name: "IX_ServiceRequests_Status",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "AssignedAdvisorId",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "CancellationReason",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "CancelledAtUtc",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "CustomerVehicleId",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "IdempotencyKey",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "PreferredServiceDate",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "ProblemDescription",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "RequestNumber",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "ServiceCategory",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "ServiceLocationId",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "SubmittedAtUtc",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "VehicleLicensePlate",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "IsOperational",
                table: "Garages");

            migrationBuilder.DropColumn(
                name: "IsVerified",
                table: "Garages");

            migrationBuilder.DropSequence(
                name: "ServiceRequestNumberSeq");

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "ServiceRequests",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: false,
                defaultValue: "");
        }
    }
}
