using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BroCoMod.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemoveGst : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // BroCo no longer charges GST. Columns stay (non-destructive) and simply hold 0 from now on.
            migrationBuilder.Sql(@"UPDATE ""PlatformFeeConfigurations"" SET ""TaxPercentage"" = 0 WHERE ""TaxPercentage"" <> 0;");

            // Still-due commissions: the garage owes just the commission. Paid and waived history is left as it was.
            migrationBuilder.Sql(@"UPDATE ""GarageCommissions"" SET ""TaxPercentage"" = 0, ""TaxAmount"" = 0, ""TotalDue"" = ""CommissionAmount"", ""UpdatedAtUtc"" = now()
                WHERE ""Status"" = 1 AND (""TaxAmount"" <> 0 OR ""TaxPercentage"" <> 0 OR ""TotalDue"" <> ""CommissionAmount"");");

            // Drafts nobody has sent yet are recalculated without tax so they don't go out with GST in the total.
            migrationBuilder.Sql(@"UPDATE ""GarageQuoteLineItems"" li SET ""TaxRate"" = 0, ""LineTax"" = 0, ""LineTotal"" = li.""ItemSubtotal""
                FROM ""GarageQuotes"" q WHERE li.""GarageQuoteId"" = q.""Id"" AND q.""Status"" = 1 AND (li.""TaxRate"" <> 0 OR li.""LineTax"" <> 0);");
            migrationBuilder.Sql(@"UPDATE ""GarageQuotes"" SET ""TaxAmount"" = 0, ""TotalAmount"" = ""Subtotal"" - ""DiscountAmount""
                WHERE ""Status"" = 1 AND ""TaxAmount"" <> 0;");
            migrationBuilder.Sql(@"UPDATE ""CustomerQuotationLineItems"" li SET ""TaxRate"" = 0
                FROM ""CustomerQuotations"" q WHERE li.""CustomerQuotationId"" = q.""Id"" AND q.""Status"" = 1 AND li.""TaxRate"" <> 0;");
            migrationBuilder.Sql(@"UPDATE ""CustomerQuotations"" SET ""CustomerTax"" = 0,
                ""CustomerTotal"" = GREATEST(0, ""CustomerSubtotal"" - ""CustomerDiscount""), ""CustomerFacingPrice"" = GREATEST(0, ""CustomerSubtotal"" - ""CustomerDiscount"")
                WHERE ""Status"" = 1 AND ""CustomerTax"" <> 0;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Data-only change; the old tax amounts are not restored.
        }
    }
}
