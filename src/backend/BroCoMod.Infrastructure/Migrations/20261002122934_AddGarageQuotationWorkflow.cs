using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BroCoMod.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddGarageQuotationWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GarageNotes",
                table: "GarageQuotes");

            migrationBuilder.RenameColumn(
                name: "InternalCostBreakdown",
                table: "GarageQuotes",
                newName: "GarageRemarks");

            migrationBuilder.RenameColumn(
                name: "GarageInternalPrice",
                table: "GarageQuotes",
                newName: "TotalAmount");

            migrationBuilder.RenameColumn(
                name: "EstimatedDurationHours",
                table: "GarageQuotes",
                newName: "VersionNumber");

            migrationBuilder.CreateSequence(
                name: "GarageQuoteNumberSeq",
                startValue: 100001L);

            migrationBuilder.AddColumn<Guid>(
                name: "ConcurrencyToken",
                table: "GarageQuotes",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "CreatedByUserId",
                table: "GarageQuotes",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Currency",
                table: "GarageQuotes",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<decimal>(
                name: "DiscountAmount",
                table: "GarageQuotes",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "EstimatedCompletionDays",
                table: "GarageQuotes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "EstimatedCompletionHours",
                table: "GarageQuotes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ExpiredAtUtc",
                table: "GarageQuotes",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "GarageRequestId",
                table: "GarageQuotes",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<string>(
                name: "IdempotencyKey",
                table: "GarageQuotes",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "QuoteNumber",
                table: "GarageQuotes",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "SubmittedAtUtc",
                table: "GarageQuotes",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SubmittedByUserId",
                table: "GarageQuotes",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Subtotal",
                table: "GarageQuotes",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "TaxAmount",
                table: "GarageQuotes",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<Guid>(
                name: "UpdatedByUserId",
                table: "GarageQuotes",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ValidUntil",
                table: "GarageQuotes",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "WithdrawalReason",
                table: "GarageQuotes",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "WithdrawnAtUtc",
                table: "GarageQuotes",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "GarageQuoteLineItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    GarageQuoteId = table.Column<Guid>(type: "uuid", nullable: false),
                    LineType = table.Column<int>(type: "integer", nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Quantity = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    UnitPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TaxRate = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    DiscountAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ItemSubtotal = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    LineTax = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    LineTotal = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GarageQuoteLineItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GarageQuoteLineItems_GarageQuotes_GarageQuoteId",
                        column: x => x.GarageQuoteId,
                        principalTable: "GarageQuotes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "GarageQuoteVersions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    GarageQuoteId = table.Column<Guid>(type: "uuid", nullable: false),
                    VersionNumber = table.Column<int>(type: "integer", nullable: false),
                    Subtotal = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TaxAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    DiscountAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    EstimatedCompletionDays = table.Column<int>(type: "integer", nullable: true),
                    EstimatedCompletionHours = table.Column<int>(type: "integer", nullable: true),
                    ValidUntil = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    GarageRemarks = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    LineItemsJson = table.Column<string>(type: "text", nullable: false),
                    SubmittedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SubmittedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GarageQuoteVersions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GarageQuoteVersions_GarageQuotes_GarageQuoteId",
                        column: x => x.GarageQuoteId,
                        principalTable: "GarageQuotes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_GarageQuotes_GarageId_IdempotencyKey",
                table: "GarageQuotes",
                columns: new[] { "GarageId", "IdempotencyKey" });

            migrationBuilder.CreateIndex(
                name: "IX_GarageQuotes_GarageRequestId",
                table: "GarageQuotes",
                column: "GarageRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_GarageQuotes_QuoteNumber",
                table: "GarageQuotes",
                column: "QuoteNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GarageQuotes_Status",
                table: "GarageQuotes",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_GarageQuotes_SubmittedAtUtc",
                table: "GarageQuotes",
                column: "SubmittedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_GarageQuotes_ValidUntil",
                table: "GarageQuotes",
                column: "ValidUntil");

            migrationBuilder.CreateIndex(
                name: "IX_GarageQuoteLineItems_GarageQuoteId",
                table: "GarageQuoteLineItems",
                column: "GarageQuoteId");

            migrationBuilder.CreateIndex(
                name: "IX_GarageQuoteLineItems_GarageQuoteId_SortOrder",
                table: "GarageQuoteLineItems",
                columns: new[] { "GarageQuoteId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_GarageQuoteVersions_GarageQuoteId",
                table: "GarageQuoteVersions",
                column: "GarageQuoteId");

            migrationBuilder.CreateIndex(
                name: "IX_GarageQuoteVersions_GarageQuoteId_VersionNumber",
                table: "GarageQuoteVersions",
                columns: new[] { "GarageQuoteId", "VersionNumber" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_GarageQuotes_GarageRequests_GarageRequestId",
                table: "GarageQuotes",
                column: "GarageRequestId",
                principalTable: "GarageRequests",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_GarageQuotes_GarageRequests_GarageRequestId",
                table: "GarageQuotes");

            migrationBuilder.DropTable(
                name: "GarageQuoteLineItems");

            migrationBuilder.DropTable(
                name: "GarageQuoteVersions");

            migrationBuilder.DropIndex(
                name: "IX_GarageQuotes_GarageId_IdempotencyKey",
                table: "GarageQuotes");

            migrationBuilder.DropIndex(
                name: "IX_GarageQuotes_GarageRequestId",
                table: "GarageQuotes");

            migrationBuilder.DropIndex(
                name: "IX_GarageQuotes_QuoteNumber",
                table: "GarageQuotes");

            migrationBuilder.DropIndex(
                name: "IX_GarageQuotes_Status",
                table: "GarageQuotes");

            migrationBuilder.DropIndex(
                name: "IX_GarageQuotes_SubmittedAtUtc",
                table: "GarageQuotes");

            migrationBuilder.DropIndex(
                name: "IX_GarageQuotes_ValidUntil",
                table: "GarageQuotes");

            migrationBuilder.DropColumn(
                name: "ConcurrencyToken",
                table: "GarageQuotes");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "GarageQuotes");

            migrationBuilder.DropColumn(
                name: "Currency",
                table: "GarageQuotes");

            migrationBuilder.DropColumn(
                name: "DiscountAmount",
                table: "GarageQuotes");

            migrationBuilder.DropColumn(
                name: "EstimatedCompletionDays",
                table: "GarageQuotes");

            migrationBuilder.DropColumn(
                name: "EstimatedCompletionHours",
                table: "GarageQuotes");

            migrationBuilder.DropColumn(
                name: "ExpiredAtUtc",
                table: "GarageQuotes");

            migrationBuilder.DropColumn(
                name: "GarageRequestId",
                table: "GarageQuotes");

            migrationBuilder.DropColumn(
                name: "IdempotencyKey",
                table: "GarageQuotes");

            migrationBuilder.DropColumn(
                name: "QuoteNumber",
                table: "GarageQuotes");

            migrationBuilder.DropColumn(
                name: "SubmittedAtUtc",
                table: "GarageQuotes");

            migrationBuilder.DropColumn(
                name: "SubmittedByUserId",
                table: "GarageQuotes");

            migrationBuilder.DropColumn(
                name: "Subtotal",
                table: "GarageQuotes");

            migrationBuilder.DropColumn(
                name: "TaxAmount",
                table: "GarageQuotes");

            migrationBuilder.DropColumn(
                name: "UpdatedByUserId",
                table: "GarageQuotes");

            migrationBuilder.DropColumn(
                name: "ValidUntil",
                table: "GarageQuotes");

            migrationBuilder.DropColumn(
                name: "WithdrawalReason",
                table: "GarageQuotes");

            migrationBuilder.DropColumn(
                name: "WithdrawnAtUtc",
                table: "GarageQuotes");

            migrationBuilder.DropSequence(
                name: "GarageQuoteNumberSeq");

            migrationBuilder.RenameColumn(
                name: "VersionNumber",
                table: "GarageQuotes",
                newName: "EstimatedDurationHours");

            migrationBuilder.RenameColumn(
                name: "TotalAmount",
                table: "GarageQuotes",
                newName: "GarageInternalPrice");

            migrationBuilder.RenameColumn(
                name: "GarageRemarks",
                table: "GarageQuotes",
                newName: "InternalCostBreakdown");

            migrationBuilder.AddColumn<string>(
                name: "GarageNotes",
                table: "GarageQuotes",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: false,
                defaultValue: "");
        }
    }
}
