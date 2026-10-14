using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BroCoMod.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCommissionPaymentAllocations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "GarageCommissionPaymentAllocations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PaymentId = table.Column<Guid>(type: "uuid", nullable: false),
                    GarageCommissionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GarageCommissionPaymentAllocations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GarageCommissionPaymentAllocations_GarageCommissions_Garage~",
                        column: x => x.GarageCommissionId,
                        principalTable: "GarageCommissions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_GarageCommissionPaymentAllocations_Payments_PaymentId",
                        column: x => x.PaymentId,
                        principalTable: "Payments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_GarageCommissionPaymentAllocations_GarageCommissionId",
                table: "GarageCommissionPaymentAllocations",
                column: "GarageCommissionId");

            migrationBuilder.CreateIndex(
                name: "IX_GarageCommissionPaymentAllocations_PaymentId_GarageCommissi~",
                table: "GarageCommissionPaymentAllocations",
                columns: new[] { "PaymentId", "GarageCommissionId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GarageCommissionPaymentAllocations");
        }
    }
}
