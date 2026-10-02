# Commercial Pricing Model & Financial Calculations

## 1. Overview
BroCo Mod implements a two-tier financial architecture:
1. **Tier 1 (Wholesale Execution Cost):** The raw cost submitted by the partner garage (`GarageQuote`), encompassing workshop labor hours and supplier parts cost.
2. **Tier 2 (Commercial Retail Price):** The curated customer price (`CustomerQuotation`), factoring in quality inspections, warranty guarantees, promotional discounts, and statutory taxes.

---

## 2. Server-Side Financial Calculation Engine
All totals are calculated strictly on the backend to guarantee decimal precision and prevent client-side manipulation.

### Line Item Calculations:
For each line item $i$:
$$\text{Gross}_i = \text{Quantity}_i \times \text{UnitPrice}_i$$
$$\text{Net}_i = \max(0, \text{Gross}_i - \text{DiscountAmount}_i)$$
$$\text{LineTax}_i = \frac{\text{Net}_i \times \text{TaxRate}_i}{100}$$
$$\text{LineTotal}_i = \text{Net}_i + \text{LineTax}_i$$

### Quotation-Level Recalculations:
$$\text{CustomerSubtotal} = \sum_{i} \text{Net}_i$$
$$\text{TaxableAfterDiscount} = \max(0, \text{CustomerSubtotal} - \text{CustomerDiscount})$$

If an overall quotation promotional discount is applied, taxes are scaled proportionally:
$$\text{DiscountRatio} = \frac{\text{TaxableAfterDiscount}}{\text{CustomerSubtotal}}$$
$$\text{CustomerTax} = \text{Round}\left(\sum_{i} \text{LineTax}_i \times \text{DiscountRatio},\ 2\right)$$
$$\text{CustomerTotal} = \text{TaxableAfterDiscount} + \text{CustomerTax}$$

---

## 3. Decimal Precision & Rounding Rules
- All currency calculations use `decimal` in C# (`numeric(18,2)` in PostgreSQL).
- Rounding follows standard commercial half-up rounding (`MidpointRounding.AwayFromZero`).
- Subtotal, taxes, and totals can never be negative:
  - If discounts exceed subtotal, taxable base is clamped to 0.
  - Zero total quotations are rejected upon submission or transition to `ReadyToSend`.

---

## 4. Automatic Quotation Expiry
- All quotations carry a mandatory UTC expiration timestamp (`ValidUntilUtc`).
- A background worker (`QuoteExpirationBackgroundService`) executes periodically to transition unresponded quotations from `Sent`, `ReadyToSend`, or `Draft` into `Expired` status.
- Once expired, a quotation cannot be accepted by a customer or sent without an advisor creating a formal revision.
