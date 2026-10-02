using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BroCoMod.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomerQuotationDecisionAndBookingConfirmation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_GarageAssignments_ServiceRequestId",
                table: "GarageAssignments");

            migrationBuilder.AddColumn<Guid>(
                name: "AcceptedVersionId",
                table: "CustomerQuotations",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ConcurrencyToken",
                table: "CustomerQuotations",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateTable(
                name: "CustomerQuotationDecisions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CustomerQuotationId = table.Column<Guid>(type: "uuid", nullable: false),
                    CustomerQuotationVersionId = table.Column<Guid>(type: "uuid", nullable: false),
                    VersionNumber = table.Column<int>(type: "integer", nullable: false),
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: false),
                    Decision = table.Column<int>(type: "integer", nullable: false),
                    DecisionCategory = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    DecisionReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    IdempotencyKey = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    ClientIpAddress = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: true),
                    UserAgent = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    DecidedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CustomerQuotationDecisions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CustomerQuotationDecisions_CustomerQuotationVersions_Custom~",
                        column: x => x.CustomerQuotationVersionId,
                        principalTable: "CustomerQuotationVersions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CustomerQuotationDecisions_CustomerQuotations_CustomerQuota~",
                        column: x => x.CustomerQuotationId,
                        principalTable: "CustomerQuotations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CustomerQuotationDecisions_Users_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_GarageAssignments_ServiceRequestId",
                table: "GarageAssignments",
                column: "ServiceRequestId",
                unique: true,
                filter: "\"Status\" IN (1, 4)");

            migrationBuilder.CreateIndex(
                name: "IX_CustomerQuotationDecisions_CustomerId",
                table: "CustomerQuotationDecisions",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_CustomerQuotationDecisions_CustomerId_IdempotencyKey",
                table: "CustomerQuotationDecisions",
                columns: new[] { "CustomerId", "IdempotencyKey" });

            migrationBuilder.CreateIndex(
                name: "IX_CustomerQuotationDecisions_CustomerQuotationId",
                table: "CustomerQuotationDecisions",
                column: "CustomerQuotationId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CustomerQuotationDecisions_CustomerQuotationVersionId",
                table: "CustomerQuotationDecisions",
                column: "CustomerQuotationVersionId");

            migrationBuilder.CreateIndex(
                name: "IX_CustomerQuotationDecisions_DecidedAtUtc",
                table: "CustomerQuotationDecisions",
                column: "DecidedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_CustomerQuotationDecisions_Decision",
                table: "CustomerQuotationDecisions",
                column: "Decision");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CustomerQuotationDecisions");

            migrationBuilder.DropIndex(
                name: "IX_GarageAssignments_ServiceRequestId",
                table: "GarageAssignments");

            migrationBuilder.DropColumn(
                name: "AcceptedVersionId",
                table: "CustomerQuotations");

            migrationBuilder.DropColumn(
                name: "ConcurrencyToken",
                table: "CustomerQuotations");

            migrationBuilder.CreateIndex(
                name: "IX_GarageAssignments_ServiceRequestId",
                table: "GarageAssignments",
                column: "ServiceRequestId",
                unique: true,
                filter: "\"Status\" = 1");
        }
    }
}
