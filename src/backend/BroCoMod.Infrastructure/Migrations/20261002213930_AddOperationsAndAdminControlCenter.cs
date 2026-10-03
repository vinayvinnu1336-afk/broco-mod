using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BroCoMod.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOperationsAndAdminControlCenter : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ConcurrencyToken",
                table: "Notifications",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<string>(
                name: "ErrorSummary",
                table: "Notifications",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastAttemptAtUtc",
                table: "Notifications",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RetryCount",
                table: "Notifications",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "Status",
                table: "Notifications",
                type: "integer",
                nullable: false,
                defaultValue: 3);

            migrationBuilder.AddColumn<Guid>(
                name: "ConcurrencyToken",
                table: "Garages",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<double>(
                name: "ServiceRadiusKm",
                table: "Garages",
                type: "double precision",
                nullable: false,
                defaultValue: 10.0);

            migrationBuilder.AddColumn<int>(
                name: "Status",
                table: "Garages",
                type: "integer",
                nullable: false,
                defaultValue: 2);

            migrationBuilder.AddColumn<DateTime>(
                name: "StatusChangedAtUtc",
                table: "Garages",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "StatusReason",
                table: "Garages",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_Status",
                table: "Notifications",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_Garages_IsActive",
                table: "Garages",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_Garages_Status",
                table: "Garages",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_EntityName_EntityId",
                table: "AuditLogs",
                columns: new[] { "EntityName", "EntityId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Notifications_Status",
                table: "Notifications");

            migrationBuilder.DropIndex(
                name: "IX_Garages_IsActive",
                table: "Garages");

            migrationBuilder.DropIndex(
                name: "IX_Garages_Status",
                table: "Garages");

            migrationBuilder.DropIndex(
                name: "IX_AuditLogs_EntityName_EntityId",
                table: "AuditLogs");

            migrationBuilder.DropColumn(
                name: "ConcurrencyToken",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "ErrorSummary",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "LastAttemptAtUtc",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "RetryCount",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "ConcurrencyToken",
                table: "Garages");

            migrationBuilder.DropColumn(
                name: "ServiceRadiusKm",
                table: "Garages");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Garages");

            migrationBuilder.DropColumn(
                name: "StatusChangedAtUtc",
                table: "Garages");

            migrationBuilder.DropColumn(
                name: "StatusReason",
                table: "Garages");
        }
    }
}
