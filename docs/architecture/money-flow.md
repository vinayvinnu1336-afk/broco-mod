# How money moves in BroCo

BroCo is a booking platform. It doesn't hold the full payment for a service.
It earns from two 10% charges: a booking advance from the customer and a commission from the garage.

## Example: Standard service priced at ₹5,000

| Step | Who pays | Amount | How |
|---|---|---|---|
| 1. Booking | Customer → BroCo | ₹500 (10%) | Online at checkout |
| 2. After the service | Customer → Garage | ₹4,500 (the rest) | Cash or UPI at the garage at handover |
| 3. After handover | Garage → BroCo | ₹500 commission (10%) | Online from Garage portal → Commission, or offline (an admin records it) |

**Result:** the garage keeps ₹4,500 − ₹500 = ₹4,000 net. BroCo earns ₹1,000.

BroCo adds no tax on top of any of these amounts: quotes, quotations, invoices and commission are just the amounts above.

## Prices
- **Packages** (Basic / Standard / Premium) have a fixed price for each car model and fuel type.
  - Admins set these under Admin → Packages & prices: per model, or in bulk by segment.
  - The server reads the price from the database when a booking is made; it never trusts a price sent by the browser.
- **Other services** (AC, batteries, denting and painting, repairs…) work through quotes.
  - Nearby garages quote, and the advisor sends the customer exactly the garage's quote. There is **no markup**: the API refuses to send a customer quote whose total differs from the garage quote by more than ₹1.
  - When the customer accepts, they pay the same 10% advance.
- **Extra work** found during a job: the advisor approves it, and the customer pays for it at the garage. It is added to the service value that commission is calculated on.

## Rules the system enforces
- **The advance must be paid before work starts.** A garage can't mark the car as received until it is.
- **Package bookings skip bidding.** Once the customer has paid the advance, the advisor picks a nearby garage (Advisor → request → Assign a garage). The job is then confirmed at the package price.
- **Commission is created automatically** when the garage marks the car as *handed over*:
  - Commission = platform fee % (Admin → Settings, default 10%) × service value. Nothing is added on top: the garage owes exactly the commission.
- **Reminders:** a commission is due 24 hours after handover (`Commission:DueHours`). Garages get an in-app reminder, plus SMS, email or WhatsApp once those providers are connected, every 12 hours (`Commission:ReminderIntervalHours`). The Garage portal also shows a banner.
- **Blocking:** a garage with a commission overdue for more than 3 days (`Commission:BlockNewJobsAfterOverdueDays`, 0 = never) can't be assigned new jobs until it pays.
- **Admins** can mark a commission as received (UPI or bank reference) or waive it with a reason. Both actions are written to the audit log.
- **Two checkouts for the same due:** each online commission payment records which dues it covers (`GarageCommissionPaymentAllocations`). Whichever checkout is paid first settles the due. If a second one is also paid, it settles nothing. It is then logged as `GARAGE_COMMISSION_OVERPAID` and admins get a notification to refund or credit the garage.
- **Refunds:** an admin can refund a customer's booking advance in full or in part (Admin → Payments). Commission payments can't be refunded there, because the commission would still show as paid. Waive or adjust the commission instead.

## Ledger entries
| Event | Debit | Credit |
|---|---|---|
| Booking advance paid | PLATFORM_CASH | PLATFORM_BOOKING_FEE |
| Booking advance refunded | PLATFORM_BOOKING_FEE | PLATFORM_CASH |
| Commission paid | PLATFORM_CASH (commission) | PLATFORM_COMMISSION (commission) |

Older ledger rows from before tax was removed (October 2026) may still carry a separate tax account; they are kept as history. The `RemoveGst` migration set the tax rate to 0 and recalculated every still-due commission to the commission alone.

Each customer gets a receipt for their advance (Customer → Invoices). It shows the service total and the balance they pay at the garage.

The old full-payment, escrow and garage-payout records (`GarageSettlement`) are kept for history but are no longer created.

## Settings (`appsettings.json` / `.env`)
| Setting | Default | `.env` |
|---|---|---|
| `Payment:Provider` | `DevelopmentFake` (demo: paid without money; refused outside Development unless `Payment:AllowFakeGateway`) | `PAYMENT_PROVIDER` = `Razorpay` for real payments |
| `Razorpay:KeyId` / `Razorpay:KeySecret` | empty (API refuses to start when the provider is Razorpay) | `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` ([razorpay-setup.md](../razorpay-setup.md)) |
| `Razorpay:WebhookSecret` | empty (webhooks ignored; checkout verification still confirms payments) | `RAZORPAY_WEBHOOK_SECRET` |
| `Booking:AdvancePercentage` | 10 | `BOOKING_ADVANCE_PERCENT` |
| `Commission:DueHours` | 24 | `COMMISSION_DUE_HOURS` |
| `Commission:ReminderIntervalHours` | 12 | `COMMISSION_REMINDER_HOURS` |
| `Commission:BlockNewJobsAfterOverdueDays` | 3 | `COMMISSION_BLOCK_AFTER_DAYS` |
| `ServiceAreas` | Hyderabad live; other cities "coming soon" | edit `appsettings.json` |
| `GoogleMaps:ServerApiKey` | empty (pincode/pin cross-check off) | `GOOGLE_MAPS_SERVER_KEY` |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (frontend build) | empty (fallback address form) | `GOOGLE_MAPS_BROWSER_KEY` |
