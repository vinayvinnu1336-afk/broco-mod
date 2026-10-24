using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BroCoMod.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddJobPaymentReceived : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PaymentMode",
                table: "ServiceJobs",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PaymentReceivedAmount",
                table: "ServiceJobs",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PaymentReceivedAtUtc",
                table: "ServiceJobs",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PaymentMode",
                table: "ServiceJobs");

            migrationBuilder.DropColumn(
                name: "PaymentReceivedAmount",
                table: "ServiceJobs");

            migrationBuilder.DropColumn(
                name: "PaymentReceivedAtUtc",
                table: "ServiceJobs");
        }
    }
}
