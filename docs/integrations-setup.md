# Integrations setup: Google Maps, Razorpay, email, SMS and WhatsApp

This page is for the owner. BroCo is already built to use five outside services. Each one stays
**off** until you paste its keys into the server, and BroCo keeps working without it: in-app
notifications always work, the booking form works without a map, and payments run in demo mode.

| Integration | What it does in BroCo | Settings (in `/opt/broco-mod/.env`) | Detailed guide |
|---|---|---|---|
| Google Maps | Map, place search and address autofill on the booking page | `GOOGLE_MAPS_BROWSER_KEY`, `GOOGLE_MAPS_SERVER_KEY` | [google-maps-setup.md](google-maps-setup.md) |
| Razorpay | The customer's 10% booking advance and the garage commission | `PAYMENT_PROVIDER`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | [razorpay-setup.md](razorpay-setup.md) |
| Email (Zoho ZeptoMail) | Password reset codes by email, booking confirmations, quotation ready, payment receipts, commission reminders | `ZEPTOMAIL_API_TOKEN`, `ZEPTOMAIL_API_HOST`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME` | [below](#3-email-zoho-zeptomail) |
| SMS (Gupshup, DLT) | Password reset codes by SMS, booking confirmed, quotation ready, payment received, commission reminders | `SMS_PROVIDER`, `GUPSHUP_SMS_USERID`, `GUPSHUP_SMS_PASSWORD`, `SMS_SENDER_ID`, `DLT_ENTITY_ID`, `DLT_TEMPLATE_*` | [below](#4-sms-gupshup-enterprise--dlt) |
| WhatsApp (Gupshup), optional | Password reset codes by WhatsApp (SMS is used if WhatsApp fails) | `WHATSAPP_PROVIDER`, `GUPSHUP_WA_API_KEY`, `GUPSHUP_WA_SOURCE_NUMBER`, `GUPSHUP_WA_APP_NAME`, `WA_TEMPLATE_OTP` | [below](#5-whatsapp-gupshup-optional) |

**Never send keys, passwords or tokens in chat, email or screenshots.** They belong to your accounts.
Paste them only into the server, with the script below.

---

## How to put keys on the server (2 minutes, any time)

1. Open the server terminal (hPanel → VPS → your server → **Browser terminal**, or `ssh root@your-server-ip`).
2. Run:

   ```bash
   sudo bash /opt/broco-mod/scripts/deploy/set-keys.sh
   ```

3. The script asks, one service at a time, "Google Maps keys? [y/N]", "Razorpay keys? [y/N]" and so on.
   Answer `y` for the ones you have keys for. For each setting it shows the current value
   (secrets only as "set" or "empty") and you paste the new one.
   - **Press Enter on an empty line to keep the current value.**
   - Secrets (Razorpay secret, ZeptoMail token, Gupshup password, WhatsApp API key, Maps server key)
     are not shown while you type or paste. Paste once and press Enter.
4. The script then
   - backs up the old file (`.env.bak-<date>-<time>` next to it),
   - writes the new values (other lines and comments stay as they are),
   - switches `PAYMENT_PROVIDER=Razorpay` when you gave Razorpay keys, and `SMS_PROVIDER=Gupshup` /
     `WHATSAPP_PROVIDER=Gupshup` when you gave Gupshup credentials,
   - restarts only the API (`docker compose up -d backend`, a few seconds; the website stays up), and
   - prints which integrations are now configured.

Without questions (useful for one value), pass `NAME=value` pairs. Put each pair in single quotes if it
contains spaces or symbols:

```bash
sudo bash /opt/broco-mod/scripts/deploy/set-keys.sh 'DLT_TEMPLATE_BOOKING=1107161234567890123'
sudo bash /opt/broco-mod/scripts/deploy/set-keys.sh --show      # only print what is configured
```

To undo a change: `cp /opt/broco-mod/.env.bak-<date>-<time> /opt/broco-mod/.env` and then
`cd /opt/broco-mod && docker compose up -d backend`.

## How to check that the keys work

1. Sign in to BroCo as admin → **System health** → **Integrations**. Each service shows
   **Configured**, **Partly configured**, **Not configured** or **Error** with the reason
   (for example "DLT_TEMPLATE_OTP is empty"). Secret values are never shown, only whether they are set.
   Razorpay also shows **Test** or **Live** mode from the key id.
2. Press **Send test email**: BroCo emails your own admin address through ZeptoMail and shows
   ZeptoMail's answer (accepted, or the exact error such as "Invalid API Token").
3. Type your mobile number and press **Send test SMS** or **Send test WhatsApp**: BroCo sends the
   verification-code message with a random code and shows Gupshup's answer. Seeing "accepted" means
   Gupshup took the message; the phone should receive it within a minute. If the SMS does not arrive
   although it was accepted, the text or template id does not match DLT (see step 4.4).
4. Finally try the real flow: log out → **Forgot password?** → your mobile number → the code arrives.

Test sends are limited to 10 per 10 minutes per admin, because each one is a real (paid) message.

---

## 1. Google Maps

Follow [google-maps-setup.md](google-maps-setup.md). You end with two keys: a **browser key**
(Maps JavaScript API + Places API, restricted to your domain) and a **server key** (Geocoding API,
restricted to the server's IP). Run `set-keys.sh`, answer `y` to "Google Maps keys?".
The website reads the browser key from the API at runtime (`GET /api/v1/config/public`), so no
rebuild is needed.

## 2. Razorpay

Follow [razorpay-setup.md](razorpay-setup.md): Key Id (`rzp_test_…` first, `rzp_live_…` after KYC),
Key Secret and the webhook secret for `https://your-domain/api/v1/payments/webhook/razorpay`.
Run `set-keys.sh`, answer `y` to "Razorpay keys?". If `PAYMENT_PROVIDER=Razorpay` but a key is
missing, the API refuses to start and says which one (on purpose: better than a failed payment).
The script warns you if the API did not come back up.

## 3. Email (Zoho ZeptoMail)

ZeptoMail sends transactional email (codes, confirmations, receipts). It is pay-as-you-go and
cheap; new accounts get free credits.

1. Sign up at <https://www.zoho.com/zeptomail/> (choose **India** as the data centre if asked; the
   console address is then `zeptomail.zoho.in`).
2. **Add your domain**: in the ZeptoMail console → **Domains** → **Add domain** → `brocomob.com`
   (or your domain). ZeptoMail shows DNS records (an **SPF** TXT record and a **DKIM** TXT record,
   sometimes a CNAME for bounces). Add them at your domain provider's DNS settings, wait 10-30
   minutes, then press **Verify** in ZeptoMail. Both must show "Verified".
3. **Mail Agent**: ZeptoMail creates one ("Mail Agent 1"); you can rename it "BroCo". Open it →
   **Setup Info** → **API** tab. Copy the **Send Mail Token** (a long string; ZeptoMail may show it as
   `Zoho-enczapikey xxxxx`; pasting it with or without that first word both work). Note the API
   host shown there: `api.zeptomail.in` for India accounts, `api.zeptomail.com` for others.
4. ZeptoMail may ask you to describe your use case before it lifts the sending limit on a new
   account. Say: "Transactional emails for our car service app: password reset codes, booking
   confirmations and payment receipts to our own customers."
5. Run `set-keys.sh`, answer `y` to "Email (ZeptoMail)?":

   | Setting | Value |
   |---|---|
   | `ZEPTOMAIL_API_TOKEN` | the Send Mail Token (secret) |
   | `ZEPTOMAIL_API_HOST` | `api.zeptomail.in` (default) or `api.zeptomail.com` |
   | `EMAIL_FROM_ADDRESS` | an address on the verified domain, default `noreply@brocomob.com` |
   | `EMAIL_FROM_NAME` | `BroCo` |

6. Admin → System health → **Send test email**.

Emails BroCo sends (plain BroCo layout that reads well on phones, with a plain-text copy):
password reset code, mobile verification code (ready for later), booking confirmed, quotation ready,
payment receipt, garage commission due / overdue, and a generic message. Links in emails use
`PUBLIC_ORIGIN` from `.env` (for example `https://brocomob.com`).

## 4. SMS (Gupshup Enterprise + DLT)

In India every business SMS must be registered on the **DLT** (Distributed Ledger Technology)
platform of the telecom operators (TRAI rules). You register your business, a 6-letter sender name
and the exact text of each message; operators silently drop anything that does not match.
This takes a few days the first time, mostly waiting for approvals.

### 4.1 Register on a DLT portal (once)

1. Register your business as a **Principal Entity** on one operator's DLT portal (registration is
   shared with all operators), for example Jio (<https://trueconnect.jio.com>), Airtel
   (<https://www.airtel.in/business/commercial-communication>) or Vodafone Idea (<https://www.vilpower.in>).
   You need your PAN, GST or business registration and a letter of authorisation; there is a small fee.
2. When approved you get a **Principal Entity ID** (about 19 digits). This is `DLT_ENTITY_ID`.

### 4.2 Register the sender id (header)

On the DLT portal → **Headers** (Sender ID) → add a **6-letter** header in the **Transactional /
Service** category, for example `BROCOM`. This is `SMS_SENDER_ID`.

### 4.3 Register the five templates, exactly as written

On the DLT portal → **Content Templates** → add each template below. Choose:

- Template type: **Service Implicit** (for the verification code, operators also accept "Transactional / OTP" if offered),
- Header: your sender id (`BROCOM`),
- Variable: type each `{#var#}` exactly as shown (it is the DLT placeholder for a value up to 30 characters).

Copy the text **character for character**: spaces, full stops, "Rs" and the final "- BroCo"
all matter. BroCo sends exactly these texts (they are defined in one place in the code,
`src/backend/BroCoMod.Application/Common/SmsTemplates.cs`, and a test checks this page against it).

| Setting for the template id | Message | Text to register |
|---|---|---|
| `DLT_TEMPLATE_OTP` | Password reset / verification code | `{#var#} is your BroCo verification code. It is valid for 10 minutes. Do not share it with anyone. - BroCo` |
| `DLT_TEMPLATE_BOOKING` | Booking confirmed (customer) | `Your BroCo booking {#var#} for your {#var#} is confirmed. We will keep you updated. - BroCo` |
| `DLT_TEMPLATE_QUOTE` | Quotation ready (customer) | `Your BroCo quotation for booking {#var#} is ready. Open the BroCo app to review and accept it. - BroCo` |
| `DLT_TEMPLATE_PAYMENT` | Payment received (customer) | `We have received Rs {#var#} for {#var#}. Thank you for choosing BroCo. - BroCo` |
| `DLT_TEMPLATE_COMMISSION_REMINDER` | Commission due / overdue (garage) | `Reminder: BroCo commission of Rs {#var#} for job {#var#} is {#var#}. Please pay it from the Garage portal. - BroCo` |

What fills each `{#var#}`: the 6-digit code; booking number and car (e.g. "Maruti Swift"); booking
number; amount (e.g. "1,250") and what it was for (e.g. "booking SR-20261019-0001"); amount, job
number and "due" or "overdue".

Each approved template gets a **Template ID** (about 19 digits). Write each one down next to its
setting name. Only `DLT_TEMPLATE_OTP` is needed for password reset by SMS; a message whose template
id is empty is simply not sent by SMS (email and in-app still are).

### 4.4 Gupshup Enterprise SMS account

1. Sign up for Gupshup Enterprise SMS (<https://www.gupshup.io> → SMS → contact sales / sign up).
   Gupshup gives you an **Enterprise SMS account number** (user id, digits) and a **password**
   (the same one you use to log in at <https://enterprise.smsgupshup.com>).
2. On your DLT portal, add Gupshup as your **telemarketer** (DLT → Telemarketer / "Link TM",
   Gupshup gives you their telemarketer id), so Gupshup is allowed to deliver your messages.
3. In the Gupshup Enterprise panel, add your DLT details (entity id, header, templates) if their
   onboarding asks for them.
4. Run `set-keys.sh`, answer `y` to "SMS (Gupshup, DLT)?":

   | Setting | Value |
   |---|---|
   | `GUPSHUP_SMS_USERID` | Enterprise SMS account number |
   | `GUPSHUP_SMS_PASSWORD` | Enterprise SMS password (secret) |
   | `SMS_SENDER_ID` | your 6-letter header, e.g. `BROCOM` |
   | `DLT_ENTITY_ID` | Principal Entity ID |
   | `DLT_TEMPLATE_OTP` … `DLT_TEMPLATE_COMMISSION_REMINDER` | the five template ids |

   `SMS_PROVIDER` becomes `Gupshup` automatically. Set `SMS_PROVIDER=None` to switch SMS off again.
5. Admin → System health → **Send test SMS** to your own number.

## 5. WhatsApp (Gupshup, optional)

When WhatsApp is set up, password reset codes go by WhatsApp first; if WhatsApp fails (number not on
WhatsApp, template problem) BroCo sends the SMS instead. Other messages stay on SMS and email.

1. Sign up at <https://www.gupshup.io> → **WhatsApp** → create an **app** (choose "Access API").
   The app name you choose is `GUPSHUP_WA_APP_NAME`.
2. Connect a phone number that is **not** already used in the WhatsApp or WhatsApp Business app, and
   complete Meta (Facebook) Business verification when Gupshup asks. This number, with country code
   and no `+` (e.g. `919876543210`), is `GUPSHUP_WA_SOURCE_NUMBER`.
3. In the app's dashboard copy the **API key** (top right, or Settings) → `GUPSHUP_WA_API_KEY`.
4. **Submit the code template**: app dashboard → **Templates** → **Create template**:
   - Category: **Authentication** (Meta's one-time-password category; Meta writes the text itself),
   - Name: `broco_otp`, Language: **English**,
   - Options: tick **Add security recommendation**, set **code expires in 10 minutes**, button type
     **Copy code**,
   - The body Meta generates reads like: "*{{1}} is your verification code. For your security, do not share this code.*"
     followed by "*This code expires in 10 minutes.*" — `{{1}}` is the 6-digit code BroCo sends.
   Approval usually takes minutes to a day. When approved, copy the **template id** (a long id,
   shown in the template list or its details) → `WA_TEMPLATE_OTP`.
5. Run `set-keys.sh`, answer `y` to "WhatsApp (Gupshup)?". `WHATSAPP_PROVIDER` becomes `Gupshup`
   automatically; `WHATSAPP_PROVIDER=None` switches it off.
6. Admin → System health → **Send test WhatsApp** to your own number.

---

## Abuse protection for codes

A code can be requested at most **3 times per mobile number (or email) in 15 minutes** and
**10 times per internet address (IP) in 15 minutes** (`OTP_MAX_PER_NUMBER`, `OTP_MAX_PER_IP` in
`.env`). The IP limit is higher because mobile networks put many people behind one address. Each code
is 6 digits, valid 10 minutes, works once, and stops working after 5 wrong tries. The reset page
gives the same answer whether or not the number is registered. If one mobile number belongs to
several older accounts, no code is sent and the page tells people to reset with their email.

Not built yet (ready when wanted): verifying the mobile number with a code at sign-up. The template
and email for it already exist.

## All settings

| Setting | Required? | Example / default | Notes |
|---|---|---|---|
| `GOOGLE_MAPS_BROWSER_KEY` | optional | `AIza…` | public, restricted to your domain |
| `GOOGLE_MAPS_SERVER_KEY` | optional | `AIza…` | secret, restricted to the server IP |
| `PAYMENT_PROVIDER` | yes | `DevelopmentFake` → `Razorpay` | set automatically by `set-keys.sh` |
| `RAZORPAY_KEY_ID` | for payments | `rzp_test_…` / `rzp_live_…` | |
| `RAZORPAY_KEY_SECRET` | for payments | | secret |
| `RAZORPAY_WEBHOOK_SECRET` | recommended | | secret |
| `ZEPTOMAIL_API_TOKEN` | for email | | secret |
| `ZEPTOMAIL_API_HOST` | | `api.zeptomail.in` | `api.zeptomail.com` outside India |
| `EMAIL_FROM_ADDRESS` | | `noreply@brocomob.com` | on a verified domain |
| `EMAIL_FROM_NAME` | | `BroCo` | |
| `SMS_PROVIDER` | | empty = Gupshup when credentials are set | `Gupshup` or `None` |
| `GUPSHUP_SMS_USERID` | for SMS | digits | |
| `GUPSHUP_SMS_PASSWORD` | for SMS | | secret |
| `SMS_SENDER_ID` | for SMS | `BROCOM` | 6 letters, DLT header |
| `DLT_ENTITY_ID` | for SMS | 19 digits | |
| `DLT_TEMPLATE_OTP` | for SMS codes | 19 digits | |
| `DLT_TEMPLATE_BOOKING`, `DLT_TEMPLATE_QUOTE`, `DLT_TEMPLATE_PAYMENT`, `DLT_TEMPLATE_COMMISSION_REMINDER` | optional | 19 digits | |
| `WHATSAPP_PROVIDER` | | empty = Gupshup when API key + number are set | `Gupshup` or `None` |
| `GUPSHUP_WA_API_KEY` | for WhatsApp | | secret |
| `GUPSHUP_WA_SOURCE_NUMBER` | for WhatsApp | `919876543210` | |
| `GUPSHUP_WA_APP_NAME` | for WhatsApp | `BroCoApp` | |
| `WA_TEMPLATE_OTP` | for WhatsApp | | approved Authentication template id |
| `OTP_MAX_PER_NUMBER`, `OTP_MAX_PER_IP` | | `3`, `10` | per 15 minutes |

## For developers: the provider APIs used

- ZeptoMail: `POST https://{api.zeptomail.in|api.zeptomail.com}/v1.1/email`, header
  `Authorization: Zoho-enczapikey <send mail token>`, JSON `{from:{address,name}, to:[{email_address:{address,name}}], subject, htmlbody, textbody}`;
  success returns `request_id`. Source: <https://www.zoho.com/zeptomail/help/api/email-sending.html>
  (the page shows the `.com` host; India data-centre accounts use `.in`, shown on the Mail Agent's Setup Info page). Code:
  `src/backend/BroCoMod.Infrastructure/Services/Messaging/ZeptoMailEmailSender.cs`.
- Gupshup Enterprise SMS: `https://enterprise.smsgupshup.com/GatewayAPI/rest` with `method=sendMessage`,
  `send_to`, `msg`, `msg_type=text`, `userid`, `password`, `auth_scheme=plain`, `v=1.1`, `format=text`,
  `mask`, `principalEntityId`, `dltTemplateId`; answer `success | <number> | <id>`.
  Source: <https://docs.gupshup.io/docs/send-message-to-single-number>. BroCo sends the parameters as a
  form POST so the password is never in a URL. Code: `GupshupSmsSender.cs`.
- Gupshup WhatsApp: `POST https://api.gupshup.io/wa/api/v1/template/msg`, header `apikey`, form fields
  `channel=whatsapp`, `source`, `destination`, `src.name`, `template={"id":…,"params":[…]}`; answer
  `{"status":"submitted","messageId":…}`. Source: <https://docs.gupshup.io/docs/template-messages>.
  Code: `GupshupWhatsAppSender.cs`.
- Admin API: `GET /api/v1/admin/integrations`, `POST /api/v1/admin/integrations/test-email`,
  `POST /api/v1/admin/integrations/test-mobile` `{ mobileNumber, channel: "Sms" | "WhatsApp" }` (Super Admin only).
- Password reset: `POST /api/v1/auth/forgot-password` `{ mobileNumber }` or `{ email }`;
  `POST /api/v1/auth/reset-password` `{ mobileNumber, code, newPassword }` or `{ email, token, newPassword }`.
