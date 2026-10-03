# Invoice Lifecycle & Tax Compliance

## 1. Overview

In BroCoMod, a tax invoice is the legal and fiscal representation of a completed financial transaction between the vehicle owner, the executing workshop, and the BroCoMod platform.

Invoices are generated **only after successful payment verification**. Unverified or pending payments never issue an invoice.

---

## 2. Invoicing Lifecycle

```
[Payment Verified (Paid)]
           │
           ▼
[Invoice Generation: InvoiceService]
  • Increments PostgreSQL Sequence: InvoiceNumberSeq -> INV-YYYYMMDD-XXXXX
  • Queries Quotation Line Items & Tax Rates
  • Creates JSON snapshot of all line items (immutable record)
  • Resolves Customer Billing Address & Garage GST Information
  • Status = Paid
           │
           ├──────────────────────────────┐
           ▼                              ▼
[Customer View]                   [Admin Void Action]
• Printable Tax Invoice           • In exceptional disputes,
• Full GST breakdown               Admin can mark Void
• Digital Verification Seal       • Preserves record (no hard delete)
```

---

## 3. GST Calculation & Data Integrity

All invoices record:
- **SubTotal**: Sum of parts, labour, and consumable lines before tax.
- **TaxRatePercent**: Standard composite rate (e.g. 18.00%).
- **TaxAmount**: Calculated as `SubTotal * (TaxRatePercent / 100)`.
- **TotalAmount**: `SubTotal + TaxAmount`.
- **LineItemsJson**: Complete, serialized JSON snapshot of all line items at the time of invoice issuance. If workshop rates or parts catalogs change subsequently, the issued invoice remains permanently accurate to the exact agreement made.
