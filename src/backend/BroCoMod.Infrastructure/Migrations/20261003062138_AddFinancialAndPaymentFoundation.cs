using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BroCoMod.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddFinancialAndPaymentFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateSequence(
                name: "AdditionalWorkQuotationNumberSeq",
                startValue: 100001L);

            migrationBuilder.CreateSequence(
                name: "InvoiceNumberSeq",
                startValue: 100001L);

            migrationBuilder.CreateSequence(
                name: "PaymentNumberSeq",
                startValue: 100001L);

            migrationBuilder.CreateSequence(
                name: "SettlementNumberSeq",
                startValue: 100001L);

            migrationBuilder.CreateTable(
                name: "AdditionalWorkQuotations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    QuotationNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ServiceJobId = table.Column<Guid>(type: "uuid", nullable: false),
                    AdditionalWorkRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: false),
                    GarageId = table.Column<Guid>(type: "uuid", nullable: false),
                    Subtotal = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Tax = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Total = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Currency = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    CustomerRespondedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdditionalWorkQuotations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AdditionalWorkQuotations_AdditionalWorkRequests_AdditionalW~",
                        column: x => x.AdditionalWorkRequestId,
                        principalTable: "AdditionalWorkRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AdditionalWorkQuotations_ServiceJobs_ServiceJobId",
                        column: x => x.ServiceJobId,
                        principalTable: "ServiceJobs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PlatformFeeConfigurations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    FeePercentage = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    FixedFee = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TaxPercentage = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    EffectiveFromUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EffectiveToUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlatformFeeConfigurations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Payments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PaymentNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    CustomerQuotationId = table.Column<Guid>(type: "uuid", nullable: true),
                    AdditionalWorkQuotationId = table.Column<Guid>(type: "uuid", nullable: true),
                    ServiceJobId = table.Column<Guid>(type: "uuid", nullable: true),
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: false),
                    GarageId = table.Column<Guid>(type: "uuid", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Currency = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Purpose = table.Column<int>(type: "integer", nullable: false),
                    PaymentMethod = table.Column<int>(type: "integer", nullable: false),
                    GatewayProvider = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    GatewayOrderId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    GatewayPaymentId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    GatewaySignature = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IdempotencyKey = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    FailureReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    RefundedAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PaidAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Payments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Payments_AdditionalWorkQuotations_AdditionalWorkQuotationId",
                        column: x => x.AdditionalWorkQuotationId,
                        principalTable: "AdditionalWorkQuotations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Payments_CustomerQuotations_CustomerQuotationId",
                        column: x => x.CustomerQuotationId,
                        principalTable: "CustomerQuotations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Payments_Garages_GarageId",
                        column: x => x.GarageId,
                        principalTable: "Garages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Payments_ServiceJobs_ServiceJobId",
                        column: x => x.ServiceJobId,
                        principalTable: "ServiceJobs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "GarageSettlements",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SettlementNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    GarageId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceJobId = table.Column<Guid>(type: "uuid", nullable: false),
                    PaymentId = table.Column<Guid>(type: "uuid", nullable: false),
                    GrossAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PlatformFeePercentage = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PlatformFeeFixed = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PlatformFeeAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TaxOnPlatformFee = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalPlatformFee = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    NetPayableToGarage = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Currency = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    SettledAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PayoutTransactionRef = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ReferenceNotes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GarageSettlements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GarageSettlements_Garages_GarageId",
                        column: x => x.GarageId,
                        principalTable: "Garages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_GarageSettlements_Payments_PaymentId",
                        column: x => x.PaymentId,
                        principalTable: "Payments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_GarageSettlements_ServiceJobs_ServiceJobId",
                        column: x => x.ServiceJobId,
                        principalTable: "ServiceJobs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Invoices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    InvoiceNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    PaymentId = table.Column<Guid>(type: "uuid", nullable: false),
                    CustomerQuotationId = table.Column<Guid>(type: "uuid", nullable: true),
                    AdditionalWorkQuotationId = table.Column<Guid>(type: "uuid", nullable: true),
                    ServiceJobId = table.Column<Guid>(type: "uuid", nullable: true),
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: false),
                    GarageId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Subtotal = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    DiscountAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TaxAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Currency = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    BillingName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    BillingEmail = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    BillingAddress = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    LineItemsJson = table.Column<string>(type: "jsonb", nullable: false),
                    IssuedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PaidAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    VoidedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    VoidReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Invoices", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Invoices_AdditionalWorkQuotations_AdditionalWorkQuotationId",
                        column: x => x.AdditionalWorkQuotationId,
                        principalTable: "AdditionalWorkQuotations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Invoices_CustomerQuotations_CustomerQuotationId",
                        column: x => x.CustomerQuotationId,
                        principalTable: "CustomerQuotations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Invoices_Garages_GarageId",
                        column: x => x.GarageId,
                        principalTable: "Garages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Invoices_Payments_PaymentId",
                        column: x => x.PaymentId,
                        principalTable: "Payments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Invoices_ServiceJobs_ServiceJobId",
                        column: x => x.ServiceJobId,
                        principalTable: "ServiceJobs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "FinancialLedgerEntries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TransactionReference = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    EntryType = table.Column<int>(type: "integer", nullable: false),
                    DebitAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CreditAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Currency = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    AccountType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    AccountId = table.Column<Guid>(type: "uuid", nullable: true),
                    PaymentId = table.Column<Guid>(type: "uuid", nullable: true),
                    InvoiceId = table.Column<Guid>(type: "uuid", nullable: true),
                    SettlementId = table.Column<Guid>(type: "uuid", nullable: true),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FinancialLedgerEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FinancialLedgerEntries_GarageSettlements_SettlementId",
                        column: x => x.SettlementId,
                        principalTable: "GarageSettlements",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_FinancialLedgerEntries_Invoices_InvoiceId",
                        column: x => x.InvoiceId,
                        principalTable: "Invoices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_FinancialLedgerEntries_Payments_PaymentId",
                        column: x => x.PaymentId,
                        principalTable: "Payments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AdditionalWorkQuotations_AdditionalWorkRequestId",
                table: "AdditionalWorkQuotations",
                column: "AdditionalWorkRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_AdditionalWorkQuotations_CustomerId",
                table: "AdditionalWorkQuotations",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_AdditionalWorkQuotations_GarageId",
                table: "AdditionalWorkQuotations",
                column: "GarageId");

            migrationBuilder.CreateIndex(
                name: "IX_AdditionalWorkQuotations_QuotationNumber",
                table: "AdditionalWorkQuotations",
                column: "QuotationNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AdditionalWorkQuotations_ServiceJobId",
                table: "AdditionalWorkQuotations",
                column: "ServiceJobId");

            migrationBuilder.CreateIndex(
                name: "IX_AdditionalWorkQuotations_Status",
                table: "AdditionalWorkQuotations",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_FinancialLedgerEntries_AccountId",
                table: "FinancialLedgerEntries",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_FinancialLedgerEntries_AccountType",
                table: "FinancialLedgerEntries",
                column: "AccountType");

            migrationBuilder.CreateIndex(
                name: "IX_FinancialLedgerEntries_CreatedAtUtc",
                table: "FinancialLedgerEntries",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_FinancialLedgerEntries_EntryType",
                table: "FinancialLedgerEntries",
                column: "EntryType");

            migrationBuilder.CreateIndex(
                name: "IX_FinancialLedgerEntries_InvoiceId",
                table: "FinancialLedgerEntries",
                column: "InvoiceId");

            migrationBuilder.CreateIndex(
                name: "IX_FinancialLedgerEntries_PaymentId",
                table: "FinancialLedgerEntries",
                column: "PaymentId");

            migrationBuilder.CreateIndex(
                name: "IX_FinancialLedgerEntries_SettlementId",
                table: "FinancialLedgerEntries",
                column: "SettlementId");

            migrationBuilder.CreateIndex(
                name: "IX_FinancialLedgerEntries_TransactionReference",
                table: "FinancialLedgerEntries",
                column: "TransactionReference");

            migrationBuilder.CreateIndex(
                name: "IX_GarageSettlements_CreatedAtUtc",
                table: "GarageSettlements",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_GarageSettlements_GarageId",
                table: "GarageSettlements",
                column: "GarageId");

            migrationBuilder.CreateIndex(
                name: "IX_GarageSettlements_PaymentId",
                table: "GarageSettlements",
                column: "PaymentId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GarageSettlements_ServiceJobId",
                table: "GarageSettlements",
                column: "ServiceJobId");

            migrationBuilder.CreateIndex(
                name: "IX_GarageSettlements_SettlementNumber",
                table: "GarageSettlements",
                column: "SettlementNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GarageSettlements_Status",
                table: "GarageSettlements",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_AdditionalWorkQuotationId",
                table: "Invoices",
                column: "AdditionalWorkQuotationId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_CustomerId",
                table: "Invoices",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_CustomerQuotationId",
                table: "Invoices",
                column: "CustomerQuotationId");

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_GarageId",
                table: "Invoices",
                column: "GarageId");

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_InvoiceNumber",
                table: "Invoices",
                column: "InvoiceNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_IssuedAtUtc",
                table: "Invoices",
                column: "IssuedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_PaymentId",
                table: "Invoices",
                column: "PaymentId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_ServiceJobId",
                table: "Invoices",
                column: "ServiceJobId");

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_Status",
                table: "Invoices",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_AdditionalWorkQuotationId",
                table: "Payments",
                column: "AdditionalWorkQuotationId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Payments_CreatedAtUtc",
                table: "Payments",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_CustomerId",
                table: "Payments",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_CustomerQuotationId",
                table: "Payments",
                column: "CustomerQuotationId");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_GarageId",
                table: "Payments",
                column: "GarageId");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_GatewayProvider_GatewayPaymentId",
                table: "Payments",
                columns: new[] { "GatewayProvider", "GatewayPaymentId" },
                unique: true,
                filter: "\"GatewayPaymentId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_IdempotencyKey",
                table: "Payments",
                column: "IdempotencyKey",
                unique: true,
                filter: "\"IdempotencyKey\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_PaymentNumber",
                table: "Payments",
                column: "PaymentNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Payments_Purpose",
                table: "Payments",
                column: "Purpose");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_ServiceJobId",
                table: "Payments",
                column: "ServiceJobId");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_Status",
                table: "Payments",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_PlatformFeeConfigurations_EffectiveFromUtc",
                table: "PlatformFeeConfigurations",
                column: "EffectiveFromUtc");

            migrationBuilder.CreateIndex(
                name: "IX_PlatformFeeConfigurations_IsActive",
                table: "PlatformFeeConfigurations",
                column: "IsActive");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FinancialLedgerEntries");

            migrationBuilder.DropTable(
                name: "PlatformFeeConfigurations");

            migrationBuilder.DropTable(
                name: "GarageSettlements");

            migrationBuilder.DropTable(
                name: "Invoices");

            migrationBuilder.DropTable(
                name: "Payments");

            migrationBuilder.DropTable(
                name: "AdditionalWorkQuotations");

            migrationBuilder.DropSequence(
                name: "AdditionalWorkQuotationNumberSeq");

            migrationBuilder.DropSequence(
                name: "InvoiceNumberSeq");

            migrationBuilder.DropSequence(
                name: "PaymentNumberSeq");

            migrationBuilder.DropSequence(
                name: "SettlementNumberSeq");
        }
    }
}
