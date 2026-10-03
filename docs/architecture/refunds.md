# Refunds & Compensating Transactions

## 1. Refund Policy & Rules

1. **Authorization**: Only Super Admins holding the `Permissions.Payments.Refund` permission can issue refunds.
2. **Eligibility**:
   - Refunds can only be issued on payments with status `Paid` or `PartiallyRefunded`.
   - Pending, failed, or cancelled payments cannot be refunded.
3. **Amount Limits**:
   - `RefundAmount` must be greater than zero.
   - Cumulative refunded amount cannot exceed `Original Payment Amount - Previously Refunded Amount`.
4. **Mandatory Reason**: A non-empty justification reason must be supplied for audit tracking.

---

## 2. Execution Flow

When an admin triggers a refund (`POST /api/v1/admin/finance/payments/{id}/refund`):
1. The payment record is fetched and validated against the above rules.
2. The payment gateway's `RefundPaymentAsync` method is invoked.
3. Upon gateway confirmation:
   - `Payment.RecordRefund(refundAmount, reason)` updates `RefundedAmount`.
   - If `RefundedAmount == Amount`, status becomes `Refunded`.
   - If `RefundedAmount < Amount`, status becomes `PartiallyRefunded`.
4. The `FinancialLedgerService` writes a compensating entry (`RefundDebit`) debiting the platform Escrow account and crediting the Customer account.
5. In-app notifications are dispatched to both the customer and the affected workshop.
6. An immutable audit log entry (`PAYMENT_REFUNDED`) is persisted.
