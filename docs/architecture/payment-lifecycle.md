# Payment Lifecycle & Gateway Integration

## 1. Flow Overview

```
1. Customer Accepts Quotation (M7)
            │
            ▼
2. Customer Initiates Payment (POST /api/v1/customer/payments/initiate)
   - Resolves Customer & Quotation from database
   - Server calculates Authoritative Amount = Quotation.CustomerTotal
   - IPaymentGateway.CreatePaymentOrderAsync generates external order ID
   - Creates Payment record in database with Status = Pending
   - Returns Payment ID, Payment Number, Gateway Order ID, and Checkout Details
            │
            ▼
3. Customer Checkout via Payment Gateway / Webhook
   - Razorpay / DevelopmentFake gateway UI or direct card/UPI flow
            │
   ┌────────┴────────┐
   ▼                 ▼
[Client Verify]   [Gateway Webhook]
POST /payments/   POST /payments/webhook/{provider}
verify            Signature validation via HMAC-SHA256
   │                 │
   └────────┬────────┘
            ▼
4. Server Verification & Completion (Atomic Execution)
   - Idempotency guard: checks if already marked Paid
   - Verifies gateway signature: HMAC-SHA256(orderId + "|" + paymentId, secret)
   - Transitions Payment to Status = Paid
   - Generates Tax Invoice (InvoiceService)
   - Creates Workshop Settlement in Escrow (SettlementService)
   - Records Double-Entry Ledger Transactions (FinancialLedgerService)
   - Dispatches In-App & Push Notifications to Customer and Garage
   - Writes immutable Audit Log
```

---

## 2. Gateway Abstraction: `IPaymentGateway`

To avoid coupling the business domain to any single third-party payment provider, the `IPaymentGateway` interface decouples all gateway interactions:

```csharp
public interface IPaymentGateway
{
    string ProviderName { get; }
    Task<CreatePaymentOrderResult> CreatePaymentOrderAsync(CreatePaymentOrderParams parameters, CancellationToken ct);
    Task<VerifyPaymentResult> VerifyPaymentAsync(VerifyPaymentParams parameters, CancellationToken ct);
    Task<ProcessWebhookResult> HandleWebhookAsync(string payload, string signatureHeader, CancellationToken ct);
    Task<RefundPaymentResult> RefundPaymentAsync(RefundPaymentParams parameters, CancellationToken ct);
}
```

The `PaymentGatewayFactory` resolves the configured gateway at runtime (`DevelopmentFake` in development/testing, extensible to `Razorpay`, `Stripe`, etc. in production).

---

## 3. Idempotency & Concurrency

- **Idempotency-Key Support**: Customer payment initiation supports an optional `Idempotency-Key` HTTP header. If a duplicate request arrives with the same key, the existing pending payment order is returned without duplicating database entities or gateway orders.
- **Gateway Signature Validation**: The server re-computes the HMAC-SHA256 hash using the server-side gateway secret key. Untrusted or modified payloads are rejected with HTTP 400 Bad Request.
- **Idempotent Webhook Processing**: Webhook calls are idempotent. If a payment is already marked `Paid`, the webhook acknowledges with HTTP 200 OK without creating duplicate invoices or settlement records.
