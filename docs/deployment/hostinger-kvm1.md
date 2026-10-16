# Putting BroCo online: Hostinger VPS KVM 1, step by step

This guide is for the owner. You do not need to be a programmer. You will:

1. rent a small server from Hostinger (about 1 hour of work in total, most of it waiting),
2. point your domain name at it,
3. let GitHub build the software,
4. paste **one command** into the server, and
5. log in as admin.

Everything BroCo needs (database, API, website, HTTPS, nightly backups, firewall) is installed by that
one command. Running it again later is safe: it skips what is already done.

A few words you will see:

| Word | Meaning |
|---|---|
| **VPS** | A small computer in Hostinger's data centre that runs BroCo 24 x 7. |
| **IP address** | The number of that computer on the internet, e.g. `145.223.20.15`. |
| **DNS / A record** | The setting at your domain provider that says "`broco.in` lives at this IP". |
| **Terminal** | A black text window where you paste commands and press Enter. |
| **Root** | The administrator user of the server. Hostinger gives you root. |
| **HTTPS** | The padlock in the browser. Set up automatically with a free Let's Encrypt certificate. |
| **GitHub** | Where the BroCo code lives (`github.com/vinayvinnu1336-afk/broco-mod`). It also builds the software for you. |
| **Image** | A ready-to-run, pre-built copy of a part of BroCo (API, website, web server). Built by GitHub, downloaded by the server. |

Keep three things handy while you go: your Hostinger login, your domain provider login (GoDaddy,
Hostinger, BigRock, Namecheap, ...) and your GitHub login.

---

## Step 1 - Buy the VPS (about 10 minutes)

1. Open <https://www.hostinger.in/vps-hosting> and choose **KVM 1** (1 vCPU, 4 GB RAM, 50 GB disk).
   Pick the longest term you are comfortable with - monthly renewals cost more.
2. During checkout choose the **data centre** closest to your customers (India / Mumbai when offered,
   otherwise Singapore).
3. When asked for an operating system choose **plain Ubuntu 24.04** - in Hostinger's list it is under
   "Plain OS" / "Ubuntu 24.04 LTS". Do **not** pick a panel option (CyberPanel, Plesk, CloudPanel,
   "Ubuntu with Docker" is fine but not needed).
4. Set the **root password** when asked. Use a long one and keep it in your password manager - you
   will need it to open the terminal.
5. Finish the payment. Hostinger takes 2-10 minutes to prepare the server.
6. Open **hPanel → VPS → your server**. On the overview page you will see **IP address** (four numbers
   with dots). Write it down - you need it in Step 2.

If you already have a server with a panel OS installed, use hPanel → VPS → **Operating system** →
**Change OS** → Plain OS → Ubuntu 24.04 and set a new root password. This wipes the server, which is
fine before BroCo is installed.

## Step 2 - Point your domain at the server (about 5 minutes, then waiting)

Log in at your domain provider and open the DNS settings of the domain (names differ: "DNS
Management", "DNS Zone", "Manage DNS", "Advanced DNS").

Add two records (edit them if they already exist):

| Type | Name / Host | Value / Points to | TTL |
|---|---|---|---|
| A | `@` (some providers want the bare domain, e.g. `broco.in`) | your server IP from Step 1 | lowest offered (300 / 5 min / Automatic) |
| A | `www` | the same IP | same |

If there is an old A record or a "parking" / "forwarding" record for `@` or `www`, delete it.

Hostinger domain? hPanel → **Domains** → your domain → **DNS / Nameservers** → DNS records.

The change usually reaches the internet within 5-30 minutes, sometimes a few hours. You can continue
with Step 3 meanwhile - the install command in Step 4 checks the DNS by itself and tells you if it is
not ready yet.

## Step 3 - Let GitHub build the software (about 15 minutes, once)

A KVM 1 server is too small to build BroCo itself, so GitHub builds it and the server only downloads
the result. You do this once; later updates are built the same way automatically.

1. Sign in at <https://github.com> and open <https://github.com/vinayvinnu1336-afk/broco-mod>.
2. **Support contact shown on the website (optional).** Click **Settings** (top row of the repository)
   → in the left menu **Secrets and variables** → **Actions** → tab **Variables** → **New repository
   variable**. Add any of these (skip the ones you do not want on the site):
   - `SUPPORT_PHONE` - e.g. `+91 98765 43210`
   - `SUPPORT_EMAIL` - e.g. `help@broco.in`
   - `SUPPORT_WHATSAPP` - digits only with country code, e.g. `919876543210`
3. Click **Actions** (top row). In the left list click **Release images**. On the right there is a grey
   box "This workflow has a workflow_dispatch event trigger" with a **Run workflow** button. Click it,
   keep the branch **main**, click the green **Run workflow**.
   (Releases also start on their own whenever new code is merged into the `main` branch - see Step 7.)
4. A new line appears with a yellow dot. Wait until all three jobs (Backend image, Frontend image,
   Nginx image) show a green tick - about 8-12 minutes. If something is red, click it and send the link
   to your developer.
5. **Make the three packages public** so the server can download them without a password. This is a
   one-time setting:
   1. Click your profile picture (top right) → **Your profile** → tab **Packages**.
      (For an organisation: the organisation page → **Packages**.)
   2. You see `broco-mod-backend`, `broco-mod-frontend` and `broco-mod-nginx`. Open the first one.
   3. On the right, click **Package settings**.
   4. Scroll to **Danger Zone** → **Change visibility** → choose **Public** → type the package name to
      confirm → **I understand the consequences, change package visibility**.
   5. Repeat for the other two packages.

   The packages contain only the built program, no passwords or customer data, so public is safe. The
   code repository is public anyway.

   **Prefer to keep them private?** Then create a token instead and give it to the install command
   in Step 4: profile picture → **Settings** → **Developer settings** (bottom of the left menu) →
   **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)** → note
   `broco server`, expiry **No expiration**, tick only **read:packages** → **Generate token**. Copy the
   token (starts with `ghp_`) now - GitHub shows it only once.

## Step 4 - Run the install command (about 5-10 minutes)

1. Open the server's terminal. The easiest way is in the browser: **hPanel → VPS → your server →
   Terminal** (left menu; on some layouts it is a "Browser terminal" button). Log in as `root` with the
   password from Step 1. Typing the password shows nothing on screen - that is normal; press Enter.

   Any SSH app also works (Windows: PowerShell or PuTTY; Mac: Terminal): `ssh root@YOUR-SERVER-IP`.
2. Copy the command below, **replace `broco.in` with your domain and the email with yours**, paste it
   into the terminal (right-click → Paste, or Ctrl+Shift+V) and press Enter:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/vinayvinnu1336-afk/broco-mod/main/scripts/deploy/setup-server.sh | bash -s -- --domain broco.in --email owner@broco.in
   ```

   - The email becomes your **admin login** and the contact for the HTTPS certificate.
   - Kept the packages private in Step 3? Add ` --ghcr-token ghp_yourtoken` at the end.
   - Want a **trial server** with demo accounts (customer / garage / advisor / admin, password
     `Password123!`) and pretend payments? Add ` --demo`. Never use `--demo` for real customers.
3. Watch the headings go by (`==> Installing system updates`, `==> Installing Docker`, `==> Downloading
   the BroCo images` ...). The whole run takes 5-10 minutes on KVM 1; the first start of the database
   is the slowest part. Do not close the window.

## Step 5 - Log in (2 minutes)

At the end the terminal prints a box like this:

```
==============================================================================
  BroCo is set up
==============================================================================
  Website:      https://broco.in
  Admin login:  https://broco.in/login
  Email:        owner@broco.in
  Password:     k7Qx2mPv9sLw4nRt8bZc

  This password is shown only now. It is also saved in /root/broco-admin-password.txt
```

1. Copy the password into your password manager. (If you lose it: in the terminal type
   `cat /root/broco-admin-password.txt`.)
2. Open `https://your-domain/login`, sign in with the email and that password. You land in the admin
   area.
3. The generated password is strong (20 random characters) and there is no change-password screen yet,
   so keep it in your password manager. Then remove the one-time admin settings from the server so the
   password is not stored there any more:

   ```bash
   nano /opt/broco-mod/.env
   ```

   Find the two lines starting with `BOOTSTRAP_ADMIN_EMAIL=` and `BOOTSTRAP_ADMIN_PASSWORD=` and delete
   what comes after the `=` (or delete both lines). Save with **Ctrl+O**, Enter, leave with **Ctrl+X**.
   Then: `cd /opt/broco-mod && docker compose up -d backend` and `rm /root/broco-admin-password.txt`.

**If the box says "HTTPS: not yet"**, the DNS from Step 2 had not spread when the script ran. The site
already works at `http://YOUR-SERVER-IP`. Wait half an hour and paste the **same command from Step 4
again** - it skips everything that is done and only adds the certificate.

**If it says "The API was still starting"**, wait two minutes and run
`bash /opt/broco-mod/scripts/deploy/status.sh`. If the API still says NOT answering after ten minutes,
send your developer the output of `cd /opt/broco-mod && docker compose logs --tail=100 backend`.

## Step 6 - Add Google Maps and Razorpay later (optional)

BroCo works without them. Maps add a pin-on-map and address search on the booking page; Razorpay takes
real online payments (until then payments are "pretend" and only allowed in demo mode).

1. Get the keys: [Google Maps setup](../google-maps-setup.md), [Razorpay setup](../razorpay-setup.md).
2. In the terminal: `nano /opt/broco-mod/.env`, find the lines (`GOOGLE_MAPS_BROWSER_KEY=`,
   `GOOGLE_MAPS_SERVER_KEY=`, `PAYMENT_PROVIDER=`, `RAZORPAY_KEY_ID=`, `RAZORPAY_KEY_SECRET=`,
   `RAZORPAY_WEBHOOK_SECRET=`), paste the values after the `=`. For Razorpay also set
   `PAYMENT_PROVIDER=Razorpay` and make sure the three `RAZORPAY_` lines do not start with `#`.
   Save: Ctrl+O, Enter, Ctrl+X.
3. Apply without downtime for the website:

   ```bash
   cd /opt/broco-mod && docker compose up -d backend
   ```

The Razorpay **webhook** URL to enter in the Razorpay dashboard is
`https://your-domain/api/v1/payments/webhook/razorpay` (details in the Razorpay guide).

## Step 7 - Day-to-day: updates, status, backups

**Installing a new version** (after your developer merges changes into `main` - GitHub builds the new
images automatically, about 10 minutes; then on the server):

```bash
bash /opt/broco-mod/scripts/deploy/update.sh
```

It downloads the new images, restarts only what changed (the site is away for a few seconds) and cleans
up old versions. Database changes are applied automatically.

**Checking that everything is fine:**

```bash
bash /opt/broco-mod/scripts/deploy/status.sh
```

Shows the running parts, API and HTTPS health with the certificate expiry date, memory, disk, the
latest backup and the scheduled jobs. Do this after every update and whenever something looks odd.

**Backups.** Every night at 02:15 (India time) the database is saved to `/opt/broco-mod/backups/`
(file names like `broco_mod-20260416-021501.dump`); 14 days are kept. Uploaded job photos live in the
`broco-mod-media` Docker volume. A backup that stays on the same server is not a backup: switch on
Hostinger's **VPS backups / snapshots** (hPanel → VPS → Backups) or copy the folder away regularly, e.g.
from your PC: `scp root@YOUR-IP:/opt/broco-mod/backups/*.dump .`

**Restoring a backup** (replaces today's data with that file - ask your developer unless you are sure):

```bash
cd /opt/broco-mod
ls backups/                                   # pick the file
docker compose stop backend
docker exec -i broco-mod-postgres pg_restore -U postgres -d broco_mod --clean --if-exists < backups/broco_mod-20260416-021501.dump
docker compose start backend
```

**HTTPS renewal** is automatic (checked twice a day). `status.sh` shows the expiry date; it should
always be more than 30 days away.

**Other useful commands** (all as root, in `/opt/broco-mod`):

| Want to | Type |
|---|---|
| See what is running | `docker compose ps` |
| Read recent API messages | `docker compose logs --tail=100 backend` |
| Restart everything | `docker compose restart` |
| Stop / start the site | `docker compose stop` / `docker compose up -d` |
| Run a backup right now | `./docker/scripts/backup-postgres.sh` |
| Reboot the server (comes back by itself) | `reboot` |

## Step 8 - When to move to KVM 2

KVM 1 is right for a pilot: a few hundred bookings a month, a handful of garages and advisors. Move
to **KVM 2** (2 vCPU, 8 GB) when `status.sh` regularly shows:

- **Memory**: `Mem` "available" below ~300 MB or `Swap` "used" above ~1 GB most of the day,
- **Disk**: more than 80% used (also clean old images: `docker image prune -af`),
- pages taking several seconds, or the API restarting (`docker compose ps` shows "Restarting"),
- you are about to run marketing that brings many users at once.

Upgrading in Hostinger (hPanel → VPS → **Upgrade**) keeps the disk, so BroCo and its data stay as they
are; it needs one reboot. After it, the database can use more memory: ask your developer to raise the
`mem_limit` values and the Postgres `shared_buffers` in `docker-compose.yml`.

---

## For the developer

- **Branches.** `develop` is where work lands; **`main` is the release branch**. Merging `develop` into
  `main` triggers `.github/workflows/release-images.yml`, which builds and pushes
  `ghcr.io/vinayvinnu1336-afk/broco-mod-{backend,frontend,nginx}` tagged `latest` and the short SHA.
  `ci.yml` (tests) runs on pushes and PRs to `main` and `develop`. The install one-liner fetches
  `scripts/deploy/setup-server.sh` from `main`, so `main` must exist and contain this folder.
  Until it does, both the workflow (Run workflow → choose the branch) and the script
  (`--branch develop`, and `.../broco-mod/develop/scripts/deploy/setup-server.sh` in the URL) work from
  another branch.
- **Frontend build-time values.** `NEXT_PUBLIC_*` are baked in at build: API URL `/api/v1`, demo mode
  `false`, support contact from repository variables. Changing them means re-running the workflow and
  `update.sh`. The Google Maps browser key is **not** baked in; the site reads it from the API
  (`GET /api/v1/config/public`), so it only needs `.env` + `docker compose up -d backend`.
- **Demo quick-login buttons** are a frontend build flag (`NEXT_PUBLIC_DEMO_MODE`), always `false`
  in released images; `--demo` only seeds the demo accounts and allows the fake gateway on the backend.
  Owners log in with the demo emails by typing them.
- **What the script changes on the server**: apt packages (docker via get.docker.com, git, ufw,
  fail2ban, unattended-upgrades, dnsutils), `/swapfile` 2 GB + fstab + `vm.swappiness=10`, ufw rules
  22/80/443, timezone, `/opt/broco-mod` checkout, `/opt/broco-mod/.env` (only when absent; existing
  files only get missing `*_IMAGE` lines appended), `/root/broco-admin-password.txt`,
  `/etc/cron.d/broco-mod` (backup 02:15 keeping 14 days; certbot renew 03:00/15:00 + nginx reload),
  `/root/.docker/config.json` when a token is given.
- **Pinning a version** instead of `latest`: set `BACKEND_IMAGE`/`FRONTEND_IMAGE`/`NGINX_IMAGE` in
  `.env` to the short-SHA tag printed in the workflow summary and run `update.sh`. Roll back the same way.
- **Compose and local builds** still work: with the `*_IMAGE` lines commented out,
  `docker compose up -d --build` builds on the machine as before.
