using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BroCoMod.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SyncRequestStatusWithJobs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Bookings never left "confirmed" while the garage worked the job. Catch existing ones up:
            // job handed over / closed (9, 10) -> request Completed (11);
            // job received .. vehicle ready (3..8) -> request InProgress (10).
            // Cancelled (12) and already-completed requests are left alone.
            migrationBuilder.Sql("""
                UPDATE "ServiceRequests" sr
                SET "Status" = 11, "UpdatedAtUtc" = NOW()
                WHERE sr."Status" NOT IN (11, 12)
                  AND EXISTS (SELECT 1 FROM "ServiceJobs" j
                              WHERE j."ServiceRequestId" = sr."Id" AND j."Status" IN (9, 10));

                UPDATE "ServiceRequests" sr
                SET "Status" = 10, "UpdatedAtUtc" = NOW()
                WHERE sr."Status" NOT IN (10, 11, 12)
                  AND EXISTS (SELECT 1 FROM "ServiceJobs" j
                              WHERE j."ServiceRequestId" = sr."Id" AND j."Status" BETWEEN 3 AND 8);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}
