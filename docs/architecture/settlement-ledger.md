# Workshop Settlement & Financial Ledger

## 1. Escrow & Commission Model

BroCoMod operates on a marketplace escrow model:
1. When a customer pays ₹10,000 for a service quotation, the entire ₹10,000 enters the platform's escrow account (`ESCROW`).
2. The platform fee configuration is queried (seeded default: `PlatformFeeRatePercent = 10.00%`, `PlatformFeeGstRatePercent = 18.00%`).
3. For a ₹10,000 payment:
   - **Gross Amount**: `₹ 10,000.00`
   - **Platform Fee (10%)**: `₹ 1,000.00`
   - **GST on Platform Fee (18%)**: `₹ 180.00`
   - **Total Platform Fee**: `₹ 1,180.00`
   - **Net Payable to Workshop**: `₹ 10,000.00 - ₹ 1,180.00 = ₹ 8,820.00`
4. A `GarageSettlement` record is created with `Status = Pending`.
5. The workshop can view their pending payout, fee deductions, and net payable in the Workshop Finance portal (`/garage/finance`).
6. When the Super Admin disburses the payout via bank transfer (NEFT/RTGS/IMPS), the Admin records the transaction UTR reference via `/admin/finance/settlements/{id}/complete`. The settlement status transitions to `Completed`.

---

## 2. Double-Entry Style Ledger Entries

The `FinancialLedgerService` automatically posts balanced ledger entries to record all fund movements:

| Entry Type | Account Type | Direction | Amount | Description |
| :--- | :--- | :--- | :--- | :--- |
| `PaymentCaptured` | `ESCROW` | **Debit** | Full Amount | Customer payment deposited into Escrow |
| `PaymentCaptured` | `CUSTOMER` | **Credit** | Full Amount | Customer liability balance offset |
| `PlatformFeeDeducted` | `PLATFORM_REVENUE`| **Credit** | Platform Fee | Platform commission retained |
| `GstOnPlatformFee` | `TAX_GST` | **Credit** | GST Amount | GST collected on commission |
| `GaragePayout` | `GARAGE_PAYABLE`| **Credit** | Net Amount | Workshop payable credited |
| `GaragePayout` | `ESCROW` | **Credit** | Net Amount | Workshop payout disbursed from Escrow |
| `RefundDebit` | `ESCROW` | **Credit** | Refund Amt | Refund paid out of Escrow to Customer |

This structure ensures financial transparency, auditing readiness, and complete reconciliation capabilities.
