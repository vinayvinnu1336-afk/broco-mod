# Invoice Lifecycle

## 1. Overview

In BroCoMod, an invoice is the legal and fiscal representation of a completed financial transaction between the vehicle owner, the executing workshop, and the BroCoMod platform.

Invoices are generated **only after successful payment verification**. Unverified or pending payments never issue an invoice.

---

## 2. Invoicing Lifecycle

```
[Payment Verified (Paid)]
           │
           ▼
[Invoice Generation: InvoiceService]
  • Increments PostgreSQL Sequence: InvoiceNumberSeq -> INV-YYYYMMDD-XXXXX
  • Queries Quotation Line Items
  • Creates JSON snapshot of all line items (immutable record)
  • Resolves Customer Billing Details
  • Status = Paid
           │
           ├──────────────────────────────┐
           ▼                              ▼
[Customer View]                   [Admin Void Action]
• Printable Invoice               • In exceptional disputes,
• Full line-item breakdown         Admin can mark Void
• Digital Verification Seal       • Preserves record (no hard delete)
```

---

## 3. Amounts & Data Integrity

All invoices record:
- **SubTotal**: Sum of parts, labour, and consumable lines.
- **DiscountAmount**: Any discount given.
- **TotalAmount**: `SubTotal - DiscountAmount`. BroCo adds no tax (the legacy `TaxAmount` column is always 0).
- **LineItemsJson**: Complete, serialized JSON snapshot of all line items at the time of invoice issuance. If workshop rates or parts catalogs change subsequently, the issued invoice remains permanently accurate to the exact agreement made.
