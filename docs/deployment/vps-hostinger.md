# Deploying BroCo Mod on a single VPS (Hostinger KVM)

This runs the whole platform (PostgreSQL + PostGIS, Redis, API, Next.js, Nginx) on one Ubuntu VPS with Docker Compose.

| Plan | Use |
|---|---|
| KVM 1 (1 vCPU, 4 GB) | Demo / pilot. Add swap and build images in CI, not on the server. |
| KVM 2 (2 vCPU, 8 GB) | Recommended for launch. |

Only Nginx (ports 80/443) is reachable from the internet. Everything else sits on a private Docker network.

## 1. Prepare the server (once)

```bash
# Ubuntu 22.04/24.04, as root
apt update && apt -y upgrade
curl -fsSL https://get.docker.com | sh

# 2 GB swap - protects Postgres and the API from out-of-memory kills on small plans
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Firewall for SSH + web. (Docker-published ports bypass ufw, which is why compose publishes only 80/443.)
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable
```

Point your domain's DNS `A` record at the VPS IP before requesting a certificate.

## 2. Configure

```bash
git clone <repo-url> /opt/broco-mod && cd /opt/broco-mod
cp .env.example .env
openssl rand -base64 48   # use for POSTGRES_PASSWORD
openssl rand -base64 64   # use for JWT_SECRET
nano .env                 # fill DOMAIN, PUBLIC_ORIGIN, secrets, BOOTSTRAP_ADMIN_*
```

## 3. Start

```bash
docker compose up -d --build
docker compose ps          # all services healthy
curl -s http://localhost/healthz/live
```

Log in with `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD`, then delete those two lines from `.env` and run `docker compose up -d` again.

On KVM 1, build the images in GitHub Actions (or on your PC), push them to a registry, set `BACKEND_IMAGE` / `FRONTEND_IMAGE` in `.env`, and use `docker compose pull && docker compose up -d` instead of `--build`. Building Next.js on a 4 GB server can run out of memory.

## 4. HTTPS (Let's Encrypt)

```bash
docker compose --profile tls run --rm certbot certonly --webroot -w /var/www/certbot \
  -d example.com --email you@example.com --agree-tos --no-eff-email
docker compose restart nginx   # picks up the certificate and switches to HTTPS automatically
```

Renewal (cron, twice a day):

```
0 3,15 * * * cd /opt/broco-mod && docker compose --profile tls run --rm certbot renew --quiet && docker compose exec nginx nginx -s reload
```

Alternatively put Cloudflare in front (proxy on, SSL mode "Full").

## 5. Backups

```bash
chmod +x docker/scripts/backup-postgres.sh
crontab -e
# 15 2 * * * cd /opt/broco-mod && ./docker/scripts/backup-postgres.sh >> backups/backup.log 2>&1
```

Copy `backups/` off the server regularly (Hostinger backup add-on, rclone to Google Drive/S3).

## 6. Updating

```bash
cd /opt/broco-mod && git pull
docker compose up -d --build     # migrations run automatically, guarded by a database lock
```

## What protects the server

- Nginx: per-IP limits (auth 10/min, API 20/s, pages 10/s), 10 MB upload cap, 30 s timeouts, gzip, immutable caching of build assets, security headers + HSTS.
- API: per-user/IP rate limits, JWT secret required at startup, fake payment gateway refused unless `ALLOW_FAKE_PAYMENTS=true`, Swagger off.
- Docker: memory limits per service, log rotation (5 × 10 MB per container), restart on failure.

## Scaling beyond one VPS

The API is safe to run as several replicas: OTP codes live in Redis, migrations and background jobs take PostgreSQL advisory locks. To scale: move PostgreSQL to a managed database, run 2+ API containers, and list them in `docker/nginx/upstreams.conf` (`upstream backend_service`).
