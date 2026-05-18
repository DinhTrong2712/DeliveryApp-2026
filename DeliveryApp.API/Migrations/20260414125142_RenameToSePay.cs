using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DeliveryApp.API.Migrations
{
    /// <inheritdoc />
    public partial class RenameToSePay : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TingeeTransactions");

            migrationBuilder.CreateTable(
                name: "SePayTransactions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TransactionCode = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,0)", nullable: false),
                    Content = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Gateway = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    AccountNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    ReferenceCode = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    TransactionDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RawPayload = table.Column<string>(type: "text", nullable: true),
                    OrderId = table.Column<Guid>(type: "uuid", nullable: true),
                    MatchStatus = table.Column<string>(type: "text", nullable: false),
                    MatchedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    MatchedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SePayTransactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SePayTransactions_Orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.UpdateData(
                table: "SystemConfigs",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000011"),
                column: "Key",
                value: "sepay_apikey");

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000001"),
                column: "PasswordHash",
                value: "$2a$11$BleXgc/YiHMv8VDzNTBmKeMzegSlVOul/MNys9c8/BiEWijI9XiS.");

            migrationBuilder.CreateIndex(
                name: "IX_SePayTransactions_OrderId",
                table: "SePayTransactions",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_SePayTransactions_TransactionCode",
                table: "SePayTransactions",
                column: "TransactionCode",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SePayTransactions");

            migrationBuilder.CreateTable(
                name: "TingeeTransactions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrderId = table.Column<Guid>(type: "uuid", nullable: true),
                    AccountNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Amount = table.Column<decimal>(type: "numeric(18,0)", nullable: false),
                    Bank = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Content = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    MatchStatus = table.Column<string>(type: "text", nullable: false),
                    MatchedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    MatchedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    RawPayload = table.Column<string>(type: "text", nullable: true),
                    TransactionCode = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    TransactionDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    VaAccountNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TingeeTransactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TingeeTransactions_Orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.UpdateData(
                table: "SystemConfigs",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000011"),
                column: "Key",
                value: "tingee_secret_encrypted");

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000001"),
                column: "PasswordHash",
                value: "$2a$11$sGcFF7/09YbrURqd2GvObO8.AFvtr208RDHgJeQ9ooZdwb/Apgv2K");

            migrationBuilder.CreateIndex(
                name: "IX_TingeeTransactions_OrderId",
                table: "TingeeTransactions",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_TingeeTransactions_TransactionCode",
                table: "TingeeTransactions",
                column: "TransactionCode",
                unique: true);
        }
    }
}
