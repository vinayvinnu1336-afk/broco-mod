# Google Maps setup

BroCo works without Google Maps. Until you add the keys, the booking page shows an address form: the
customer taps **Use my current location**, and BroCo fills in the street, area, city, state and pincode
from OpenStreetMap (free). With Google Maps you also get:

- a map on booking step 3 ("Where is your car?") where the customer can drag a pin,
- a search box that suggests places in India, nearest to Hyderabad first,
- addresses filled in from Google's data (usually more complete than OpenStreetMap),
- a check that the pincode the customer typed matches the pin on the map.

You need **two keys**: a *browser key* (used by the website) and a *server key* (used only by the
BroCo server). Keeping them separate means a key copied from the website cannot be used for anything
else.

This takes about 20 minutes. You need a Google account and a debit or credit card for billing.

## 1. Create a Google Cloud project and turn on billing

1. Open <https://console.cloud.google.com/> and sign in.
2. At the top, click the project picker, then **New project**. Name it `BroCo` and click **Create**.
   Make sure `BroCo` is selected in the project picker afterwards.
3. Open the menu (☰) → **Billing** and link a billing account (add your card if asked).
   Google Maps needs billing even though small sites usually stay inside the free monthly credit.
4. **Set a budget alert** so you are never surprised: ☰ → **Billing** → **Budgets & alerts** →
   **Create budget**. Pick a small monthly amount you are comfortable with and keep the email alerts
   at 50%, 90% and 100%.

## 2. Turn on the three APIs

Open ☰ → **APIs & Services** → **Library**. Search for each of these and click **Enable**:

1. **Maps JavaScript API** (the map on the website)
2. **Places API (New)** (the search box). If the Library also lists plain **Places API**, enable that too.
3. **Geocoding API** (turning a pin into an address, on the server)

## 3. Create the browser key

1. ☰ → **APIs & Services** → **Credentials** → **Create credentials** → **API key**.
2. Click the new key to edit it. Rename it `BroCo browser key`.
3. Under **Application restrictions** choose **Websites** and add these lines (use your own domain):
   - `https://yourdomain.com/*`
   - `https://www.yourdomain.com/*`
   - `http://localhost:3005/*` (only needed if you test on your own computer)
4. Under **API restrictions** choose **Restrict key** and tick only **Maps JavaScript API** and
   **Places API (New)** (and **Places API** if you enabled it).
5. Click **Save**, then copy the key (it starts with `AIza`).

## 4. Create the server key

1. **Create credentials** → **API key** again. Rename it `BroCo server key`.
2. Under **Application restrictions** choose **IP addresses** and add your server's public IP address
   (Hostinger shows it on the VPS overview page).
3. Under **API restrictions** choose **Restrict key** and tick only **Geocoding API**.
4. Click **Save** and copy the key.

Restrictions can take up to 5 minutes to start working.

## 5. Paste the keys into BroCo

On the server, open the `.env` file in the BroCo folder (the same file that has your passwords):

```bash
cd /opt/broco-mod
nano .env
```

Find these two lines and paste your keys after the `=` (no spaces, no quotes):

```
GOOGLE_MAPS_BROWSER_KEY=AIza...your browser key...
GOOGLE_MAPS_SERVER_KEY=AIza...your server key...
```

Save (`Ctrl+O`, `Enter`, `Ctrl+X`) and restart the BroCo server:

```bash
docker compose up -d backend
```

That's all. The website picks up the new browser key by itself; it does **not** need to be rebuilt.
To replace a key later, change it in `.env` and run the same command.

Running BroCo on your own computer without Docker? Set the same two values as environment variables
(`GOOGLE_MAPS_BROWSER_KEY`, `GOOGLE_MAPS_SERVER_KEY`) before starting the API, or put them in
`src/backend/BroCoMod.Api/appsettings.json` under `GoogleMaps` → `BrowserApiKey` / `ServerApiKey`
(never commit real keys).

## 6. Check that it works

1. Open your website, sign in as a customer and start a booking (**Book**).
2. On step 3, **Where is your car?**, you should see a map with a search box above it.
3. Tap **Use my current location** (allow location when the browser asks). The pin moves to you and
   the address fields below fill in, with "Filled from your location — please check". If that note
   also says "Address data © OpenStreetMap contributors", the address came from OpenStreetMap, so the
   server key is not being used yet (check step 4 and the restart).
4. Type a place in the search box: suggestions should be in India, Hyderabad first.

If the map does not appear and the page says "The map could not load", Google refused the browser key.
The booking still works with the address form. Usually one of these fixes it:

- the website address is missing from the key's **Websites** list (check `https://` and `www.`),
- **Maps JavaScript API** or **Places API (New)** is not enabled, or not ticked on the key,
- billing is not linked to the project.

The browser's developer console (F12 → Console) shows Google's exact reason.

If the map shows but the address does not fill in from Google, check the server key: it must have
**Geocoding API** ticked and your server's IP address in its list. The API log
(`docker compose logs backend | grep -i geocoding`) shows Google's answer, for example
`REQUEST_DENIED`.

## Good to know

- Without a server key, address autofill uses the public OpenStreetMap service, which allows about
  one lookup per second for the whole site. BroCo queues and caches lookups to stay within that. To
  switch it off, set `GEOCODING_FALLBACK_PROVIDER=None` in `.env`.
- Customers can always edit every address field after it is filled in.
- Each customer can do 30 address lookups a minute, which keeps a misbehaving script from running up
  your Google bill.
