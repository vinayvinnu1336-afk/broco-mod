using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BroCoMod.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddServiceMedia : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ServiceMedia",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceJobId = table.Column<Guid>(type: "uuid", nullable: true),
                    UploadedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    UploadedByRole = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    UploadedByName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    FileName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    StoragePath = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    ThumbnailPath = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    ThumbnailContentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Caption = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Stage = table.Column<int>(type: "integer", nullable: false),
                    IsVisibleToCustomer = table.Column<bool>(type: "boolean", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServiceMedia", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ServiceMedia_ServiceJobs_ServiceJobId",
                        column: x => x.ServiceJobId,
                        principalTable: "ServiceJobs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_ServiceMedia_ServiceRequests_ServiceRequestId",
                        column: x => x.ServiceRequestId,
                        principalTable: "ServiceRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ServiceMedia_ServiceJobId",
                table: "ServiceMedia",
                column: "ServiceJobId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceMedia_ServiceRequestId_IsDeleted",
                table: "ServiceMedia",
                columns: new[] { "ServiceRequestId", "IsDeleted" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ServiceMedia");
        }
    }
}
