# Razorpay setup (online payments)

BroCo takes two kinds of online payment: the customer's 10% booking advance and the garage's
commission to BroCo (see [money-flow.md](architecture/money-flow.md)). Both go through
**Razorpay**, which shows its own payment sheet on the page (cards, UPI, net banking, wallets) and
settles the money to your bank account.

Until you add your Razorpay keys, the app runs with a *development* gateway that marks payments as
paid without moving any money. That is fine for demos and testing on a laptop, never for real
customers.

There is no shared or sample Razorpay key: the keys belong to **your** Razorpay account, and the
secret must stay private (never paste it in chat, email or a screenshot). Setting this up takes
about 15 minutes. You need a mobile number, an email address and, later, your business documents
for Razorpay's KYC.

## 1. Create a Razorpay account and stay in Test mode

1. Open <https://dashboard.razorpay.com/signup> and sign up with your email and mobile number.
2. Sign in. In the dashboard there is a **Test mode / Live mode** switch (top of the page).
   Keep it on **Test mode** for now. In test mode no real money moves and you can pay with
   Razorpay's test cards and test UPI ids (step 5).
3. You can finish Razorpay's KYC (business details, bank account) any time; it is only needed
   before you switch to Live mode (step 6).

## 2. Generate your test keys

1. In the dashboard, open **Account & Settings** (or **Settings**) → **API Keys** → **Generate Test Key**.
2. Razorpay shows two values:
   - **Key Id**, which starts with `rzp_test_` (safe to show; it appears on the payment sheet), and
   - **Key Secret**, shown **only once**. Click **Download Key Details** or copy it somewhere safe
     straight away. If you lose it, generate a new key pair; the old one stops working.

## 3. Paste the keys into `.env` and switch the provider on

On the server (the folder with `docker-compose.yml`), open `.env` and set:

```
PAYMENT_PROVIDER=Razorpay
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=the-secret-you-just-copied
```

Then restart the API so it picks them up (no rebuild needed):

```
docker compose up -d backend
```

If `PAYMENT_PROVIDER` is `Razorpay` but a key is missing, the API refuses to start and the log says
exactly which value is empty. The website reads which provider is active from the API, so it needs
nothing.

Running without Docker (for example `dotnet run` on a laptop)? Set the same names as environment
variables (`PAYMENT_PROVIDER`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`)
before starting the API, or put them in `appsettings.Development.json` under
`"Payment": { "Provider": "Razorpay" }` and `"Razorpay": { "KeyId": "...", "KeySecret": "..." }`.

## 4. Set up the webhook (recommended; needs a public address)

The app confirms every payment itself the moment the customer finishes the payment sheet. The
webhook is Razorpay's second confirmation: if the customer's phone loses connection right after
paying, Razorpay still tells BroCo and the booking is confirmed.

1. Dashboard → **Account & Settings** → **Webhooks** → **Add New Webhook** (make sure you are still
   in Test mode; live mode has its own list).
2. **Webhook URL**: `https://<your-domain>/api/v1/payments/webhook/razorpay`
   (for example `https://broco.in/api/v1/payments/webhook/razorpay`).
3. **Secret**: type a long random text (for example from a password generator) and keep it.
4. **Active Events**: tick `payment.captured`, `payment.failed` and `refund.processed`
   (`order.paid` is also understood). Save.
5. Put the same secret in `.env` and restart the API:

```
RAZORPAY_WEBHOOK_SECRET=the-secret-you-typed-in-step-3
docker compose up -d backend
```

Webhooks need a public `https://` address. On a laptop (`localhost`) they never arrive, which is
fine: the payment sheet's own confirmation still marks payments paid. Without a webhook secret the
API simply ignores webhook calls.

## 5. Test a payment (Test mode, no real money)

1. Open the website, sign in as a customer and book a package (or accept a quote) until the
   **Pay ₹… now** button appears. The Razorpay sheet opens on the page.
2. Pay with one of Razorpay's test instruments. Razorpay keeps the current list at
   <https://razorpay.com/docs/payments/payments/test-card-details/> and
   <https://razorpay.com/docs/payments/payments/test-upi-details/>; as of October 2026 they are:
   - **Card** (domestic): Visa `4100 2800 0000 1007`, Mastercard `5555 5100 0008 1006`,
     RuPay `6527 6589 0000 1005`. International Visa `4012 8888 8888 1881`.
     Use **any future expiry date and any 3-digit CVV**; if an OTP screen appears, pick **Success**.
   - **UPI**: enter `success@razorpay` for a successful payment or `failure@razorpay` for a failed one.
     (In test mode, closing a UPI payment half-way counts as a success, a Razorpay limitation.)
3. Back in BroCo the booking shows **Booking confirmed** / the commission shows **Paid**, and the
   payment appears under Admin → Finance. In the Razorpay dashboard (Test mode → **Transactions** →
   **Payments**) you see the same payment with the BroCo payment number in its notes.
4. Also try: close the payment sheet without paying (BroCo keeps the **Pay now** button), and pay
   with `failure@razorpay` (BroCo shows Razorpay's reason, nothing is charged).
5. Refunds: an admin refund in BroCo (Admin → Finance → payment → Refund) creates the refund at
   Razorpay; in test mode it completes instantly.

## 6. Going live

1. Complete KYC in the Razorpay dashboard (business details, PAN, bank account, website). Razorpay
   activates Live mode once it is approved.
2. Switch the dashboard to **Live mode** and generate **live** keys (**API Keys** → **Generate Live
   Key**; they start with `rzp_live_`). Create the webhook again in Live mode (step 4) with a new secret.
3. Replace the three values in `.env` (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
   `RAZORPAY_WEBHOOK_SECRET`) and run `docker compose up -d backend`.
4. Make one small real booking yourself and refund it from Admin → Finance to see the whole loop.

Test and live payments never mix: a test key cannot charge a real card, and a live key cannot use
the test cards above.

## Troubleshooting

| What you see | What it means |
|---|---|
| API does not start, log says `Payment:Provider is Razorpay but ... is empty` | A key is missing in `.env`; check for typos in the variable names. |
| Payment sheet says "Authentication failed" or the API log says Razorpay rejected the keys | Key id and secret do not belong together (regenerate the key pair and paste both again), or a live key is used in test mode (or the other way round). |
| "The amount paid does not match the amount due" | The order was changed between opening the sheet and verifying; the customer should start the payment again. |
| Webhook calls show `400` in Razorpay's dashboard | `RAZORPAY_WEBHOOK_SECRET` differs from the secret typed in the dashboard, or the webhook belongs to the other mode (test/live). |
| You want demo payments again | Set `PAYMENT_PROVIDER=DevelopmentFake` (and `ALLOW_FAKE_PAYMENTS=true` outside development) and restart the API. |
