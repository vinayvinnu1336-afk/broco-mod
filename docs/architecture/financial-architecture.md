# Financial & Payment Architecture

## 1. Executive Summary

Milestone 10 introduces the **Financial & Payment Foundation** for the BroCoMod automotive marketplace platform. It establishes a server-authoritative, secure, and auditable financial lifecycle designed to support both original customer quotations and subsequent additional work authorizations.

The core design philosophy is:
- **Server Authority**: The frontend never determines or passes payable amounts. Amounts are always resolved on the server from immutable quotation records.
- **Provider Agnostic**: All payment gateway interactions are abstracted behind the `IPaymentGateway` interface and `PaymentGatewayFactory`.
- **Decimal Precision**: All currency and financial arithmetic strictly utilizes 128-bit `decimal` (`decimal(18, 2)` in PostgreSQL) to prevent floating-point rounding errors.
- **Strict Immutability**: Accepted customer quotations, issued invoices, and financial ledger entries are immutable and append-only.
- **Escrow Settlement Flow**: Customer funds are received into an escrow state; garage settlements and tax invoices are automatically created upon successful payment verification.

---

## 2. Architecture Overview

```
+-------------------------------------------------------------------------------+
|                             CUSTOMER DOMAIN                                   |
|                                                                               |
|  Accepted Quotation ───────────────> Initiate Payment Order                   |
|                                             │                                 |
+─────────────────────────────────────────────┼─────────────────────────────────+
                                              ▼
+-------------------------------------------------------------------------------+
|                             PAYMENT DOMAIN                                    |
|                                                                               |
|        IPaymentGateway Order  <─────────────┼─────────────> Gateway Webhook   |
|                 │                                                  │          |
|                 ▼                                                  ▼          |
|      Verify Payment Signature ──────────────────────────────> Payment (Paid)  |
|                                                                    │          |
+────────────────────────────────────────────────────────────────────┼──────────+
                                                                     │
                 ┌───────────────────────────────────────────────────┼───────────────────────────────────┐
                 ▼                                                   ▼                                   ▼
+─────────────────────────────────+        +───────────────────────────────────+       +─────────────────────────────────+
|         INVOICE DOMAIN          |        |        SETTLEMENT DOMAIN          |       |         LEDGER DOMAIN           |
|                                 |        |                                   |       |                                 |
|  • Sequential Tax Invoice       |        |  • Platform Fee (10%)             |       |  • Double-Entry Style Entries   |
|  • Line Items Snapshot (JSON)   |        |  • GST on Commission (18%)        |       |  • Escrow Account Tracking      |
|  • Subtotal + GST Calculation   |        |  • Net Workshop Payable           |       |  • Compensating Adjustments     |
|  • Audit & Legal Compliance     |        |  • Bank/IMPS Payout Tracking      |       |  • Append-Only Audit Trail      |
+─────────────────────────────────+        +───────────────────────────────────+       +─────────────────────────────────+
```

---

## 3. Core Entities

### 3.1 Payment (`Payments` table)
- `Id` (UUID, Primary Key)
- `PaymentNumber` (`PAY-YYYYMMDD-XXXXX` from sequence `PaymentNumberSeq`)
- `CustomerId` (Customer User/Profile ID)
- `GarageId` (Selected Garage ID)
- `ServiceJobId` (Associated ServiceJob ID, optional)
- `CustomerQuotationId` (Associated CustomerQuotation ID, optional)
- `AdditionalWorkQuotationId` (Associated AdditionalWorkQuotation ID, optional)
- `Amount` (`decimal(18, 2)`)
- `Currency` (`INR`, 3 chars)
- `Status` (`PaymentStatus`: `Pending`, `Paid`, `Failed`, `Refunded`, `PartiallyRefunded`, `Cancelled`)
- `Purpose` (`PaymentPurpose`: `ServiceQuotation`, `AdditionalWork`)
- `PaymentMethod` (`Card`, `UPI`, `NetBanking`, `Wallet`)
- `GatewayProvider` (`DevelopmentFake`, `Razorpay`, etc.)
- `GatewayOrderId` (Gateway order reference)
- `GatewayPaymentId` (Gateway transaction reference, unique with provider)
- `GatewaySignature` (HMAC SHA-256 signature)
- `IdempotencyKey` (Optional unique idempotency token)
- `PaidAtUtc`, `RefundedAmount`, `RefundReason`, `FailureReason`

### 3.2 Invoice (`Invoices` table)
- `Id` (UUID, Primary Key)
- `InvoiceNumber` (`INV-YYYYMMDD-XXXXX` from sequence `InvoiceNumberSeq`)
- `PaymentId` (Unique 1:1 foreign key with Payment)
- `CustomerId`, `GarageId`, `ServiceJobId`, `CustomerQuotationId`
- `SubTotal`, `TaxRatePercent`, `TaxAmount`, `TotalAmount`
- `Currency` (`INR`)
- `Status` (`InvoiceStatus`: `Draft`, `Issued`, `Paid`, `Void`)
- `IssuedAtUtc`, `PaidAtUtc`
- `CustomerName`, `CustomerEmail`, `CustomerPhone`, `CustomerBillingAddress`
- `GarageName`, `GarageAddress`, `GarageGstNumber`
- `LineItemsJson` (Full itemized JSON snapshot preserving description, qty, unitPrice, lineTotal)

### 3.3 GarageSettlement (`GarageSettlements` table)
- `Id` (UUID, Primary Key)
- `SettlementNumber` (`SET-YYYYMMDD-XXXXX` from sequence `SettlementNumberSeq`)
- `PaymentId` (Unique 1:1 foreign key with Payment)
- `GarageId`, `ServiceJobId`
- `GrossAmount` (`decimal(18, 2)`)
- `PlatformFeeRatePercent` (e.g. 10.00%)
- `PlatformFeeAmount` (e.g. 10% of Gross)
- `PlatformFeeGstRatePercent` (e.g. 18.00%)
- `PlatformFeeGstAmount` (e.g. 18% of Platform Fee)
- `TotalPlatformFee` (`PlatformFeeAmount + PlatformFeeGstAmount`)
- `NetPayableToGarage` (`GrossAmount - TotalPlatformFee`)
- `Currency` (`INR`)
- `Status` (`SettlementStatus`: `Pending`, `Processing`, `Completed`, `Failed`, `OnHold`)
- `PayoutReference` (Bank transfer / UTR reference)
- `PayoutProcessedAtUtc`, `PaymentReceivedAtUtc`

### 3.4 FinancialLedgerEntry (`FinancialLedgerEntries` table)
- `Id` (UUID, Primary Key)
- `EntryNumber` (`LED-YYYYMMDD-XXXXX`)
- `EntryType` (`LedgerEntryType`: `PaymentCaptured`, `PlatformFeeDeducted`, `GstOnPlatformFee`, `GaragePayout`, `RefundDebit`, `Adjustment`)
- `AccountType` (`ESCROW`, `CUSTOMER`, `PLATFORM_REVENUE`, `GARAGE_PAYABLE`, `TAX_GST`)
- `Amount` (`decimal(18, 2)`)
- `Currency` (`INR`)
- `Direction` (`Credit`, `Debit`)
- `PaymentId`, `SettlementId`
- `Description`, `BalanceAfter`, `CreatedAtUtc`
