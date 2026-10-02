using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BroCoMod.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAdvisorReviewAndCustomerQuotation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CustomerQuotations_ServiceRequests_ServiceRequestId",
                table: "CustomerQuotations");

            migrationBuilder.CreateSequence(
                name: "CustomerQuotationNumberSeq",
                startValue: 100001L);

            migrationBuilder.AddColumn<DateTime>(
                name: "AcceptedAtUtc",
                table: "CustomerQuotations",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "AdvisorId",
                table: "CustomerQuotations",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<string>(
                name: "AdvisorRemarks",
                table: "CustomerQuotations",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CancelledAtUtc",
                table: "CustomerQuotations",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Currency",
                table: "CustomerQuotations",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<decimal>(
                name: "CustomerDiscount",
                table: "CustomerQuotations",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "CustomerSubtotal",
                table: "CustomerQuotations",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "CustomerTax",
                table: "CustomerQuotations",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "CustomerTotal",
                table: "CustomerQuotations",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<Guid>(
                name: "GarageAssignmentId",
                table: "CustomerQuotations",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "QuotationNumber",
                table: "CustomerQuotations",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "RejectedAtUtc",
                table: "CustomerQuotations",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SentAtUtc",
                table: "CustomerQuotations",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ValidUntilUtc",
                table: "CustomerQuotations",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<int>(
                name: "VersionNumber",
                table: "CustomerQuotations",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "AdvisorRequestNotes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    AdvisorId = table.Column<Guid>(type: "uuid", nullable: false),
                    AdvisorName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Note = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    IsInternal = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdvisorRequestNotes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AdvisorRequestNotes_ServiceRequests_ServiceRequestId",
                        column: x => x.ServiceRequestId,
                        principalTable: "ServiceRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CustomerQuotationLineItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CustomerQuotationId = table.Column<Guid>(type: "uuid", nullable: false),
                    LineType = table.Column<int>(type: "integer", nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Quantity = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    UnitPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TaxRate = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    DiscountAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    LineTotal = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CustomerQuotationLineItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CustomerQuotationLineItems_CustomerQuotations_CustomerQuota~",
                        column: x => x.CustomerQuotationId,
                        principalTable: "CustomerQuotations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CustomerQuotationVersions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CustomerQuotationId = table.Column<Guid>(type: "uuid", nullable: false),
                    VersionNumber = table.Column<int>(type: "integer", nullable: false),
                    CustomerSubtotal = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CustomerDiscount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CustomerTax = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CustomerTotal = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ValidUntilUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AdvisorRemarks = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    ScopeSummary = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    LineItemsJson = table.Column<string>(type: "text", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CustomerQuotationVersions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CustomerQuotationVersions_CustomerQuotations_CustomerQuotat~",
                        column: x => x.CustomerQuotationId,
                        principalTable: "CustomerQuotations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "GarageAssignments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    GarageId = table.Column<Guid>(type: "uuid", nullable: false),
                    SelectedQuoteId = table.Column<Guid>(type: "uuid", nullable: false),
                    AssignedByAdvisorId = table.Column<Guid>(type: "uuid", nullable: false),
                    AssignedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    AssignmentReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CancelledAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CancellationReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    ConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GarageAssignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GarageAssignments_GarageQuotes_SelectedQuoteId",
                        column: x => x.SelectedQuoteId,
                        principalTable: "GarageQuotes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_GarageAssignments_Garages_GarageId",
                        column: x => x.GarageId,
                        principalTable: "Garages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_GarageAssignments_ServiceRequests_ServiceRequestId",
                        column: x => x.ServiceRequestId,
                        principalTable: "ServiceRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CustomerQuotations_AdvisorId",
                table: "CustomerQuotations",
                column: "AdvisorId");

            migrationBuilder.CreateIndex(
                name: "IX_CustomerQuotations_AssignedGarageId",
                table: "CustomerQuotations",
                column: "AssignedGarageId");

            migrationBuilder.CreateIndex(
                name: "IX_CustomerQuotations_GarageAssignmentId",
                table: "CustomerQuotations",
                column: "GarageAssignmentId");

            migrationBuilder.CreateIndex(
                name: "IX_CustomerQuotations_QuotationNumber",
                table: "CustomerQuotations",
                column: "QuotationNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CustomerQuotations_Status",
                table: "CustomerQuotations",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_AdvisorRequestNotes_AdvisorId",
                table: "AdvisorRequestNotes",
                column: "AdvisorId");

            migrationBuilder.CreateIndex(
                name: "IX_AdvisorRequestNotes_CreatedAtUtc",
                table: "AdvisorRequestNotes",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_AdvisorRequestNotes_ServiceRequestId",
                table: "AdvisorRequestNotes",
                column: "ServiceRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_CustomerQuotationLineItems_CustomerQuotationId",
                table: "CustomerQuotationLineItems",
                column: "CustomerQuotationId");

            migrationBuilder.CreateIndex(
                name: "IX_CustomerQuotationLineItems_CustomerQuotationId_SortOrder",
                table: "CustomerQuotationLineItems",
                columns: new[] { "CustomerQuotationId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_CustomerQuotationVersions_CustomerQuotationId",
                table: "CustomerQuotationVersions",
                column: "CustomerQuotationId");

            migrationBuilder.CreateIndex(
                name: "IX_CustomerQuotationVersions_CustomerQuotationId_VersionNumber",
                table: "CustomerQuotationVersions",
                columns: new[] { "CustomerQuotationId", "VersionNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GarageAssignments_AssignedByAdvisorId",
                table: "GarageAssignments",
                column: "AssignedByAdvisorId");

            migrationBuilder.CreateIndex(
                name: "IX_GarageAssignments_GarageId",
                table: "GarageAssignments",
                column: "GarageId");

            migrationBuilder.CreateIndex(
                name: "IX_GarageAssignments_SelectedQuoteId",
                table: "GarageAssignments",
                column: "SelectedQuoteId");

            migrationBuilder.CreateIndex(
                name: "IX_GarageAssignments_ServiceRequestId",
                table: "GarageAssignments",
                column: "ServiceRequestId",
                unique: true,
                filter: "\"Status\" = 1");

            migrationBuilder.CreateIndex(
                name: "IX_GarageAssignments_Status",
                table: "GarageAssignments",
                column: "Status");

            migrationBuilder.AddForeignKey(
                name: "FK_CustomerQuotations_GarageAssignments_GarageAssignmentId",
                table: "CustomerQuotations",
                column: "GarageAssignmentId",
                principalTable: "GarageAssignments",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_CustomerQuotations_ServiceRequests_ServiceRequestId",
                table: "CustomerQuotations",
                column: "ServiceRequestId",
                principalTable: "ServiceRequests",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CustomerQuotations_GarageAssignments_GarageAssignmentId",
                table: "CustomerQuotations");

            migrationBuilder.DropForeignKey(
                name: "FK_CustomerQuotations_ServiceRequests_ServiceRequestId",
                table: "CustomerQuotations");

            migrationBuilder.DropTable(
                name: "AdvisorRequestNotes");

            migrationBuilder.DropTable(
                name: "CustomerQuotationLineItems");

            migrationBuilder.DropTable(
                name: "CustomerQuotationVersions");

            migrationBuilder.DropTable(
                name: "GarageAssignments");

            migrationBuilder.DropIndex(
                name: "IX_CustomerQuotations_AdvisorId",
                table: "CustomerQuotations");

            migrationBuilder.DropIndex(
                name: "IX_CustomerQuotations_AssignedGarageId",
                table: "CustomerQuotations");

            migrationBuilder.DropIndex(
                name: "IX_CustomerQuotations_GarageAssignmentId",
                table: "CustomerQuotations");

            migrationBuilder.DropIndex(
                name: "IX_CustomerQuotations_QuotationNumber",
                table: "CustomerQuotations");

            migrationBuilder.DropIndex(
                name: "IX_CustomerQuotations_Status",
                table: "CustomerQuotations");

            migrationBuilder.DropColumn(
                name: "AcceptedAtUtc",
                table: "CustomerQuotations");

            migrationBuilder.DropColumn(
                name: "AdvisorId",
                table: "CustomerQuotations");

            migrationBuilder.DropColumn(
                name: "AdvisorRemarks",
                table: "CustomerQuotations");

            migrationBuilder.DropColumn(
                name: "CancelledAtUtc",
                table: "CustomerQuotations");

            migrationBuilder.DropColumn(
                name: "Currency",
                table: "CustomerQuotations");

            migrationBuilder.DropColumn(
                name: "CustomerDiscount",
                table: "CustomerQuotations");

            migrationBuilder.DropColumn(
                name: "CustomerSubtotal",
                table: "CustomerQuotations");

            migrationBuilder.DropColumn(
                name: "CustomerTax",
                table: "CustomerQuotations");

            migrationBuilder.DropColumn(
                name: "CustomerTotal",
                table: "CustomerQuotations");

            migrationBuilder.DropColumn(
                name: "GarageAssignmentId",
                table: "CustomerQuotations");

            migrationBuilder.DropColumn(
                name: "QuotationNumber",
                table: "CustomerQuotations");

            migrationBuilder.DropColumn(
                name: "RejectedAtUtc",
                table: "CustomerQuotations");

            migrationBuilder.DropColumn(
                name: "SentAtUtc",
                table: "CustomerQuotations");

            migrationBuilder.DropColumn(
                name: "ValidUntilUtc",
                table: "CustomerQuotations");

            migrationBuilder.DropColumn(
                name: "VersionNumber",
                table: "CustomerQuotations");

            migrationBuilder.DropSequence(
                name: "CustomerQuotationNumberSeq");

            migrationBuilder.AddForeignKey(
                name: "FK_CustomerQuotations_ServiceRequests_ServiceRequestId",
                table: "CustomerQuotations",
                column: "ServiceRequestId",
                principalTable: "ServiceRequests",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
