using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BroCoMod.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddServiceExecutionAndJobLifecycle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateSequence(
                name: "ServiceJobNumberSeq",
                startValue: 100001L);

            migrationBuilder.CreateTable(
                name: "ServiceJobs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    GarageAssignmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    CustomerQuotationId = table.Column<Guid>(type: "uuid", nullable: false),
                    GarageId = table.Column<Guid>(type: "uuid", nullable: false),
                    JobNumber = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    ScheduledStartAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    EstimatedCompletionAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ActualVehicleReceivedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ActualWorkStartedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ActualWorkCompletedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    VehicleReadyAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    HandedOverAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ClosedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CancelledAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CancellationReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CurrentMileageKm = table.Column<int>(type: "integer", nullable: true),
                    CustomerComplaintSnapshot = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    GarageInternalNotes = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    CustomerFacingNotes = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServiceJobs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ServiceJobs_CustomerQuotations_CustomerQuotationId",
                        column: x => x.CustomerQuotationId,
                        principalTable: "CustomerQuotations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ServiceJobs_GarageAssignments_GarageAssignmentId",
                        column: x => x.GarageAssignmentId,
                        principalTable: "GarageAssignments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ServiceJobs_Garages_GarageId",
                        column: x => x.GarageId,
                        principalTable: "Garages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ServiceJobs_ServiceRequests_ServiceRequestId",
                        column: x => x.ServiceRequestId,
                        principalTable: "ServiceRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AdditionalWorkRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceJobId = table.Column<Guid>(type: "uuid", nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    EstimatedAdditionalAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Reason = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    ReviewedByAdvisorId = table.Column<Guid>(type: "uuid", nullable: true),
                    AdvisorRemarks = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    ReviewedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdditionalWorkRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AdditionalWorkRequests_ServiceJobs_ServiceJobId",
                        column: x => x.ServiceJobId,
                        principalTable: "ServiceJobs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ServiceInspections",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceJobId = table.Column<Guid>(type: "uuid", nullable: false),
                    InspectorUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    InspectionStartedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    InspectionCompletedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Findings = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    Recommendations = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    CustomerVisibleSummary = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    OverallSeverity = table.Column<int>(type: "integer", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServiceInspections", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ServiceInspections_ServiceJobs_ServiceJobId",
                        column: x => x.ServiceJobId,
                        principalTable: "ServiceJobs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ServiceJobActivities",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceJobId = table.Column<Guid>(type: "uuid", nullable: false),
                    ActivityType = table.Column<int>(type: "integer", nullable: false),
                    Message = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    IsCustomerVisible = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServiceJobActivities", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ServiceJobActivities_ServiceJobs_ServiceJobId",
                        column: x => x.ServiceJobId,
                        principalTable: "ServiceJobs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AdditionalWorkRequests_CreatedAtUtc",
                table: "AdditionalWorkRequests",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_AdditionalWorkRequests_ReviewedByAdvisorId",
                table: "AdditionalWorkRequests",
                column: "ReviewedByAdvisorId");

            migrationBuilder.CreateIndex(
                name: "IX_AdditionalWorkRequests_ServiceJobId",
                table: "AdditionalWorkRequests",
                column: "ServiceJobId");

            migrationBuilder.CreateIndex(
                name: "IX_AdditionalWorkRequests_Status",
                table: "AdditionalWorkRequests",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceInspections_CreatedAtUtc",
                table: "ServiceInspections",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceInspections_InspectorUserId",
                table: "ServiceInspections",
                column: "InspectorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceInspections_OverallSeverity",
                table: "ServiceInspections",
                column: "OverallSeverity");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceInspections_ServiceJobId",
                table: "ServiceInspections",
                column: "ServiceJobId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceJobActivities_ActivityType",
                table: "ServiceJobActivities",
                column: "ActivityType");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceJobActivities_CreatedAtUtc",
                table: "ServiceJobActivities",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceJobActivities_IsCustomerVisible",
                table: "ServiceJobActivities",
                column: "IsCustomerVisible");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceJobActivities_ServiceJobId",
                table: "ServiceJobActivities",
                column: "ServiceJobId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceJobs_CreatedAtUtc",
                table: "ServiceJobs",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceJobs_CustomerQuotationId",
                table: "ServiceJobs",
                column: "CustomerQuotationId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ServiceJobs_GarageAssignmentId",
                table: "ServiceJobs",
                column: "GarageAssignmentId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ServiceJobs_GarageId",
                table: "ServiceJobs",
                column: "GarageId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceJobs_JobNumber",
                table: "ServiceJobs",
                column: "JobNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ServiceJobs_ScheduledStartAtUtc",
                table: "ServiceJobs",
                column: "ScheduledStartAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceJobs_ServiceRequestId",
                table: "ServiceJobs",
                column: "ServiceRequestId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ServiceJobs_Status",
                table: "ServiceJobs",
                column: "Status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AdditionalWorkRequests");

            migrationBuilder.DropTable(
                name: "ServiceInspections");

            migrationBuilder.DropTable(
                name: "ServiceJobActivities");

            migrationBuilder.DropTable(
                name: "ServiceJobs");

            migrationBuilder.DropSequence(
                name: "ServiceJobNumberSeq");
        }
    }
}
