#!/usr/bin/env bash
# ==============================================================================
# BroCo - one-command setup for a fresh Ubuntu 24.04 VPS (Hostinger KVM 1 or bigger)
#
#   curl -fsSL https://raw.githubusercontent.com/vinayvinnu1336-afk/broco-mod/main/scripts/deploy/setup-server.sh \
#     | bash -s -- --domain example.com --email owner@example.com [--ghcr-token TOKEN] [--demo]
#
# What it does (every step is safe to repeat - re-run the same command any time):
#   1. Updates Ubuntu, installs Docker, git, ufw (firewall), fail2ban, automatic security updates.
#   2. Adds 2 GB of swap, opens ports 22/80/443 only, sets the clock to Asia/Kolkata.
#   3. Clones the repo into /opt/broco-mod and writes a .env with strong random secrets
#      (an existing .env is never overwritten).
#   4. Pulls the prebuilt images from GitHub Container Registry (built by the "Release images"
#      workflow - nothing is compiled on the server) and starts everything.
#   5. Gets a free HTTPS certificate from Let's Encrypt once the domain points at this server.
#   6. Installs the nightly database backup and the certificate renewal cron jobs.
#
# Full guide for owners: docs/deployment/hostinger-kvm1.md
# ==============================================================================
set -euo pipefail

# ------------------------------------------------------------------------------
# Defaults (all can be changed with flags, see usage)
# ------------------------------------------------------------------------------
REPO_URL="https://github.com/vinayvinnu1336-afk/broco-mod.git"
BRANCH="main"
APP_DIR="/opt/broco-mod"
IMAGE_PREFIX="ghcr.io/vinayvinnu1336-afk/broco-mod"
IMAGE_TAG="latest"
DOMAIN=""
EMAIL=""
GHCR_TOKEN=""
GHCR_USER=""
DEMO="false"
SKIP_UPGRADE="false"
HEALTH_TIMEOUT_SECONDS=180
ADMIN_PASSWORD_FILE="/root/broco-admin-password.txt"
CRON_FILE="/etc/cron.d/broco-mod"

# Set while the script runs
NEW_ENV_CREATED="false"
ADMIN_PASSWORD=""
PUBLIC_IP=""
HTTPS_ACTIVE="false"
HEALTH_OK="false"

# ------------------------------------------------------------------------------
# Output helpers
# ------------------------------------------------------------------------------
if [[ -t 1 ]]; then
    C_BOLD=$'\033[1m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_RED=$'\033[31m'; C_RESET=$'\033[0m'
else
    C_BOLD=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_RESET=""
fi

step() { printf '\n%s==> %s%s\n' "$C_BOLD" "$*" "$C_RESET"; }
info() { printf '    %s\n' "$*"; }
ok()   { printf '    %s[ok]%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
warn() { printf '    %s[warning]%s %s\n' "$C_YELLOW" "$C_RESET" "$*" >&2; }
die()  { printf '\n%s[error]%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; exit 1; }

usage() {
    cat <<'EOF'
Usage: setup-server.sh --domain DOMAIN --email EMAIL [options]

Required:
  --domain DOMAIN       Your website address without https://, e.g. broco.in
  --email EMAIL         Owner email: becomes the first admin login and the Let's Encrypt contact

Options:
  --ghcr-token TOKEN    GitHub token with read:packages, only needed while the three
                        ghcr.io packages are private
  --ghcr-user USER      GitHub username for that token (default: repository owner)
  --demo                Seed demo accounts (password Password123!) and allow fake payments.
                        For a trial server only, never for real customers.
  --branch NAME         Git branch to deploy (default: main)
  --repo URL            Repository to clone (default: https://github.com/vinayvinnu1336-afk/broco-mod.git)
  --image-prefix PREFIX Registry prefix of the images (default: ghcr.io/vinayvinnu1336-afk/broco-mod)
  --image-tag TAG       Image tag to run (default: latest)
  --skip-upgrade        Do not run apt-get upgrade (faster re-runs)
  -h, --help            Show this help
EOF
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --domain)       DOMAIN="${2:-}"; shift 2 ;;
            --email)        EMAIL="${2:-}"; shift 2 ;;
            --ghcr-token)   GHCR_TOKEN="${2:-}"; shift 2 ;;
            --ghcr-user)    GHCR_USER="${2:-}"; shift 2 ;;
            --demo)         DEMO="true"; shift ;;
            --branch)       BRANCH="${2:-}"; shift 2 ;;
            --repo)         REPO_URL="${2:-}"; shift 2 ;;
            --image-prefix) IMAGE_PREFIX="${2:-}"; shift 2 ;;
            --image-tag)    IMAGE_TAG="${2:-}"; shift 2 ;;
            --skip-upgrade) SKIP_UPGRADE="true"; shift ;;
            -h|--help)      usage; exit 0 ;;
            *)              usage >&2; die "Unknown option: $1" ;;
        esac
    done

    # Owners often paste "https://Example.com/" - accept it.
    DOMAIN="$(printf '%s' "$DOMAIN" | tr '[:upper:]' '[:lower:]')"
    DOMAIN="${DOMAIN#http://}"; DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN%%/*}"

    [[ -n "$DOMAIN" ]] || { usage >&2; die "--domain is required (example: --domain broco.in)"; }
    [[ -n "$EMAIL" ]]  || { usage >&2; die "--email is required (example: --email owner@gmail.com)"; }
    [[ "$DOMAIN" =~ ^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$ ]] \
        || die "'$DOMAIN' does not look like a domain name. Use the bare name, e.g. broco.in or app.broco.in"
    [[ "$EMAIL" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] \
        || die "'$EMAIL' does not look like an email address"
    [[ -z "$GHCR_USER" ]] && GHCR_USER="$(basename "$(dirname "$REPO_URL")")"
    return 0
}

# ------------------------------------------------------------------------------
# Preflight
# ------------------------------------------------------------------------------
preflight() {
    step "Checking this server"
    [[ "$(id -u)" -eq 0 ]] || die "Run this as root (on Hostinger you are root already; otherwise: sudo -i first)."
    [[ -r /etc/os-release ]] || die "Cannot read /etc/os-release - is this Ubuntu?"
    # shellcheck disable=SC1091
    . /etc/os-release
    if [[ "${ID:-}" != "ubuntu" ]]; then
        die "This script is written for Ubuntu 24.04 (found: ${PRETTY_NAME:-unknown}). Reinstall the VPS with plain Ubuntu 24.04."
    fi
    if [[ "${VERSION_ID:-}" != "24.04" ]]; then
        warn "Tested on Ubuntu 24.04, found ${VERSION_ID:-?}. Continuing, but prefer 24.04."
    fi
    local mem_mb
    mem_mb="$(awk '/MemTotal/ {printf "%d", $2/1024}' /proc/meminfo)"
    info "OS: ${PRETTY_NAME:-Ubuntu}   RAM: ${mem_mb} MB   CPUs: $(nproc)"
    if (( mem_mb < 3500 )); then
        warn "Less than 4 GB of RAM. BroCo needs KVM 1 (4 GB) or bigger."
    fi
    ok "Domain: $DOMAIN   Admin/Let's Encrypt email: $EMAIL   Demo mode: $DEMO"
}

# ------------------------------------------------------------------------------
# 1. Packages, Docker, swap, firewall, timezone
# ------------------------------------------------------------------------------
install_packages() {
    step "Installing system updates and tools (apt) - this can take a few minutes"
    export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a
    local apt_opts=(-y -q -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold)
    apt-get update -q </dev/null
    if [[ "$SKIP_UPGRADE" == "true" ]]; then
        info "Skipping apt-get upgrade (--skip-upgrade)"
    else
        apt-get "${apt_opts[@]}" upgrade </dev/null
    fi
    apt-get "${apt_opts[@]}" install ca-certificates curl git ufw fail2ban unattended-upgrades \
        dnsutils openssl cron </dev/null
    ok "Packages installed"

    # Automatic security updates (Ubuntu's default config, written explicitly so it is on).
    cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
    systemctl enable --now unattended-upgrades >/dev/null 2>&1 || true
    systemctl enable --now fail2ban >/dev/null 2>&1 || true
    systemctl enable --now cron >/dev/null 2>&1 || true
    ok "Automatic security updates and fail2ban (blocks password-guessing on SSH) are on"
}

install_docker() {
    step "Installing Docker"
    if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
        ok "Docker already installed: $(docker --version)"
    else
        curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
        sh /tmp/get-docker.sh </dev/null
        rm -f /tmp/get-docker.sh
        ok "Installed $(docker --version)"
    fi
    systemctl enable --now docker >/dev/null 2>&1 || true
    docker compose version >/dev/null 2>&1 || die "'docker compose' is not available. Re-run the script; if it keeps failing, reinstall Docker: curl -fsSL https://get.docker.com | sh"
}

setup_swap() {
    step "Adding swap space (protects a 4 GB server from running out of memory)"
    local active_swap
    active_swap="$(swapon --show --noheadings 2>/dev/null || true)"
    if [[ -n "$active_swap" ]]; then
        ok "Swap already active: $(printf '%s\n' "$active_swap" | awk 'NR==1 {print $1, $3}')"
    else
        if [[ ! -f /swapfile ]]; then
            fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
            chmod 600 /swapfile
            mkswap /swapfile >/dev/null
        fi
        swapon /swapfile
        ok "2 GB swap file enabled"
    fi
    grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
    # Use swap only when really needed.
    printf 'vm.swappiness=10\n' > /etc/sysctl.d/99-broco.conf
    sysctl -q -p /etc/sysctl.d/99-broco.conf >/dev/null 2>&1 || true
}

setup_firewall() {
    step "Configuring the firewall (only SSH, HTTP and HTTPS stay open)"
    # SSH first, so enabling the firewall can never lock the owner out.
    ufw allow OpenSSH >/dev/null 2>&1 || ufw allow 22/tcp >/dev/null
    ufw allow 80/tcp >/dev/null
    ufw allow 443/tcp >/dev/null
    ufw --force enable >/dev/null
    ok "ufw: $(ufw status | head -n1)"
}

setup_timezone() {
    step "Setting the clock to Asia/Kolkata"
    timedatectl set-timezone Asia/Kolkata 2>/dev/null || ln -sf /usr/share/zoneinfo/Asia/Kolkata /etc/localtime
    ok "Server time: $(date '+%d %b %Y %H:%M %Z')"
}

# ------------------------------------------------------------------------------
# 2. Repository
# ------------------------------------------------------------------------------
clone_or_update_repo() {
    step "Getting the BroCo code into $APP_DIR (branch: $BRANCH)"
    git config --global --add safe.directory "$APP_DIR" >/dev/null 2>&1 || true
    if [[ -d "$APP_DIR/.git" ]]; then
        # The chmod +x below must not make git see the scripts as modified (that blocks later pulls).
        git -C "$APP_DIR" config core.fileMode false
        if git -C "$APP_DIR" fetch --quiet origin </dev/null \
           && git -C "$APP_DIR" checkout --quiet "$BRANCH" 2>/dev/null \
           && git -C "$APP_DIR" pull --quiet --ff-only origin "$BRANCH" </dev/null; then
            ok "Updated to $(git -C "$APP_DIR" rev-parse --short HEAD) on $BRANCH"
        else
            warn "Could not update the code (local changes or network?). Continuing with what is on disk."
        fi
    else
        [[ -e "$APP_DIR" ]] && die "$APP_DIR exists but is not a git checkout. Move it away and re-run."
        git clone --quiet --branch "$BRANCH" "$REPO_URL" "$APP_DIR" </dev/null \
            || die "Could not clone $REPO_URL (branch $BRANCH). Is the repository public and does the branch exist?"
        git -C "$APP_DIR" config core.fileMode false
        ok "Cloned $(git -C "$APP_DIR" rev-parse --short HEAD)"
    fi
    chmod +x "$APP_DIR"/docker/scripts/*.sh "$APP_DIR"/scripts/deploy/*.sh 2>/dev/null || true
    mkdir -p "$APP_DIR/backups"
}

# ------------------------------------------------------------------------------
# 3. .env
# ------------------------------------------------------------------------------

# set_env_value FILE KEY VALUE
# Replaces "KEY=..." in FILE. If only a commented "# KEY=..." line exists, that line is replaced
# (uncommented); if the key is missing entirely it is appended. Trailing "# comments" on the old
# line are dropped. Pure bash so values with / + = or other sed-special characters are safe.
set_env_value() {
    local file="$1" key="$2" value="$3"
    local tmp mode="append" line done_one="false"
    if grep -q -E "^${key}=" "$file"; then
        mode="replace"
    elif grep -q -E "^[[:space:]]*#[[:space:]]*${key}=" "$file"; then
        mode="uncomment"
    fi
    tmp="$(mktemp)"
    while IFS= read -r line || [[ -n "$line" ]]; do
        line="${line%$'\r'}"
        if [[ "$mode" == "replace" && "$line" =~ ^${key}= ]]; then
            printf '%s=%s\n' "$key" "$value"
        elif [[ "$mode" == "uncomment" && "$done_one" == "false" && "$line" =~ ^[[:space:]]*#[[:space:]]*${key}= ]]; then
            printf '%s=%s\n' "$key" "$value"
            done_one="true"
        else
            printf '%s\n' "$line"
        fi
    done < "$file" > "$tmp"
    if [[ "$mode" == "append" ]]; then
        printf '%s=%s\n' "$key" "$value" >> "$tmp"
    fi
    cat "$tmp" > "$file"
    rm -f "$tmp"
}

# get_env_value FILE KEY  -> prints the value (empty if unset)
get_env_value() {
    local line
    line="$(grep -E "^$2=" "$1" | tail -n1 || true)"
    line="${line#*=}"
    line="${line%$'\r'}"
    # strip an inline "  # comment" and surrounding double quotes
    line="$(printf '%s' "$line" | sed -E 's/[[:space:]]+#.*$//; s/^"(.*)"$/\1/')"
    printf '%s' "$line"
}

# Hex secrets: no / + = characters, so they are safe inside the database connection string.
random_hex() { openssl rand -hex "$1"; }

# Readable password for the first admin login: 20 letters/digits.
random_password() {
    local p
    p="$(openssl rand -base64 45 | tr -dc 'A-Za-z0-9' | cut -c1-20)"
    [[ ${#p} -ge 12 ]] || p="$(openssl rand -hex 10)"
    printf '%s' "$p"
}

# write_env_file TARGET TEMPLATE
# Builds a fresh .env from .env.example. Kept free of host-specific commands so the lead engineer
# can test it on any machine: bash -c 'source setup-server.sh --lib; write_env_file out.env .env.example'
write_env_file() {
    local target="$1" template="$2"
    cp "$template" "$target"
    chmod 600 "$target"
    ADMIN_PASSWORD="$(random_password)"
    set_env_value "$target" DOMAIN "$DOMAIN"
    set_env_value "$target" PUBLIC_ORIGIN "https://$DOMAIN"
    set_env_value "$target" POSTGRES_PASSWORD "$(random_hex 24)"
    set_env_value "$target" JWT_SECRET "$(random_hex 48)"
    set_env_value "$target" MEDIA_SIGNING_KEY "$(random_hex 24)"
    set_env_value "$target" BOOTSTRAP_ADMIN_EMAIL "$EMAIL"
    set_env_value "$target" BOOTSTRAP_ADMIN_PASSWORD "$ADMIN_PASSWORD"
    set_env_value "$target" ENABLE_DEMO_SEEDING "$DEMO"
    set_env_value "$target" ALLOW_FAKE_PAYMENTS "$DEMO"
    set_env_value "$target" PAYMENT_PROVIDER "DevelopmentFake"
    set_env_value "$target" BACKEND_IMAGE "${IMAGE_PREFIX}-backend:${IMAGE_TAG}"
    set_env_value "$target" FRONTEND_IMAGE "${IMAGE_PREFIX}-frontend:${IMAGE_TAG}"
    set_env_value "$target" NGINX_IMAGE "${IMAGE_PREFIX}-nginx:${IMAGE_TAG}"
}

configure_env() {
    step "Preparing the settings file ($APP_DIR/.env)"
    local env_file="$APP_DIR/.env"
    if [[ -f "$env_file" ]]; then
        ok "Found an existing .env - keeping your secrets, keys and domain as they are."
        local current_domain
        current_domain="$(get_env_value "$env_file" DOMAIN)"
        if [[ -n "$current_domain" && "$current_domain" != "$DOMAIN" ]]; then
            warn ".env has DOMAIN=$current_domain but you passed --domain $DOMAIN."
            warn "Using $current_domain. To change it: nano $env_file (DOMAIN and PUBLIC_ORIGIN), then re-run."
            DOMAIN="$current_domain"
        fi
        if [[ "$DEMO" == "true" && "$(get_env_value "$env_file" ENABLE_DEMO_SEEDING)" != "true" ]]; then
            warn "--demo ignored: .env already exists. To enable demo data edit ENABLE_DEMO_SEEDING and ALLOW_FAKE_PAYMENTS in $env_file."
        fi
        # Image lines are the one thing we add if absent: without them compose tries to build on the server.
        local key
        for key in BACKEND_IMAGE FRONTEND_IMAGE NGINX_IMAGE; do
            if ! grep -q -E "^${key}=" "$env_file"; then
                local suffix
                suffix="$(printf '%s' "$key" | cut -d_ -f1 | tr '[:upper:]' '[:lower:]')"
                set_env_value "$env_file" "$key" "${IMAGE_PREFIX}-${suffix}:${IMAGE_TAG}"
                info "Added ${key}=${IMAGE_PREFIX}-${suffix}:${IMAGE_TAG} (was missing)"
            fi
        done
        chmod 600 "$env_file"
        return 0
    fi

    write_env_file "$env_file" "$APP_DIR/.env.example"
    NEW_ENV_CREATED="true"
    {
        printf 'BroCo admin login (created %s)\n' "$(date '+%d %b %Y %H:%M %Z')"
        printf 'Website:  https://%s/login\n' "$DOMAIN"
        printf 'Email:    %s\n' "$EMAIL"
        printf 'Password: %s\n' "$ADMIN_PASSWORD"
        printf '\nKeep this password in your password manager. After your first login delete the two BOOTSTRAP_ADMIN lines from %s and this file.\n' "$env_file"
    } > "$ADMIN_PASSWORD_FILE"
    chmod 600 "$ADMIN_PASSWORD_FILE"
    ok "Created .env with random secrets (database password, JWT secret, media key)"
    ok "Admin login saved to $ADMIN_PASSWORD_FILE (also printed at the end)"
    [[ "$DEMO" == "true" ]] && warn "Demo mode ON: demo accounts (password Password123!) and fake payments are enabled. Not for real customers."
    return 0
}

# ------------------------------------------------------------------------------
# 4. Images and containers
# ------------------------------------------------------------------------------
registry_login() {
    [[ -n "$GHCR_TOKEN" ]] || return 0
    step "Logging in to ghcr.io as $GHCR_USER"
    if printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin >/dev/null 2>&1; then
        ok "Logged in (token stored in /root/.docker/config.json for future pulls)"
    else
        die "ghcr.io refused the token. Create a classic token with the read:packages scope (GitHub -> Settings -> Developer settings -> Personal access tokens) and pass it with --ghcr-token."
    fi
}

pull_images() {
    step "Downloading the BroCo images from ${IMAGE_PREFIX}-*:${IMAGE_TAG} (a few hundred MB, 1-3 minutes)"
    local log
    log="$(mktemp)"
    if (cd "$APP_DIR" && docker compose pull --quiet </dev/null) >"$log" 2>&1; then
        rm -f "$log"
        ok "Images downloaded"
        return 0
    fi
    cat "$log" >&2
    rm -f "$log"
    cat >&2 <<EOF

The images could not be downloaded. The usual reasons, in order:

  1. The images have not been built yet.
     On GitHub open the repository -> Actions -> "Release images" -> "Run workflow" (branch: $BRANCH),
     wait until it is green (about 10 minutes), then re-run this script.

  2. The packages are private and no token was given.
     Either make them public once: GitHub -> your profile picture -> Your profile -> Packages ->
     open each of broco-mod-backend, broco-mod-frontend, broco-mod-nginx -> Package settings ->
     Danger Zone -> Change visibility -> Public.
     Or re-run this script with --ghcr-token <token that has read:packages>.

  3. No internet from the server (rare). Try:  curl -I https://ghcr.io
EOF
    die "Image download failed - see above."
}

start_stack() {
    step "Starting BroCo (database, cache, API, website, web server)"
    (cd "$APP_DIR" && docker compose up -d --no-build --remove-orphans </dev/null)
    ok "Containers started"
}

wait_for_health() {
    step "Waiting for the API to answer (first start runs database setup, up to $HEALTH_TIMEOUT_SECONDS s)"
    local waited=0
    while (( waited < HEALTH_TIMEOUT_SECONDS )); do
        # -L: once HTTPS is active, port 80 redirects to https://DOMAIN
        if curl -fsSL --max-time 10 http://127.0.0.1/healthz/live >/dev/null 2>&1; then
            HEALTH_OK="true"
            ok "API is up after ${waited}s"
            return 0
        fi
        sleep 5
        waited=$((waited + 5))
        if (( waited % 30 == 0 )); then info "still starting... (${waited}s)"; fi
    done
    warn "The API did not answer within $HEALTH_TIMEOUT_SECONDS s. Current state:"
    (cd "$APP_DIR" && docker compose ps) || true
    warn "See the logs with:  cd $APP_DIR && docker compose logs --tail=100 backend"
    warn "A slow first start on KVM 1 can simply need more time: check again in two minutes with  bash $APP_DIR/scripts/deploy/status.sh"
    return 0
}

# ------------------------------------------------------------------------------
# 5. HTTPS
# ------------------------------------------------------------------------------
resolve_ipv4() {
    local name="$1" ip=""
    if command -v dig >/dev/null 2>&1; then
        ip="$(dig +short +time=3 +tries=1 A "$name" @1.1.1.1 2>/dev/null | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -n1 || true)"
    fi
    if [[ -z "$ip" ]]; then
        ip="$(getent ahostsv4 "$name" 2>/dev/null | awk '{print $1; exit}' || true)"
    fi
    printf '%s' "$ip"
}

detect_public_ip() {
    PUBLIC_IP="$(curl -4 -fsS --max-time 10 https://api.ipify.org 2>/dev/null || curl -4 -fsS --max-time 10 https://ifconfig.me/ip 2>/dev/null || true)"
    [[ "$PUBLIC_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || PUBLIC_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
}

letsencrypt_dir() {
    docker volume inspect broco-mod-letsencrypt --format '{{.Mountpoint}}' 2>/dev/null || true
}

cert_covers() {
    # cert_covers NAME -> true if the current certificate lists NAME
    local dir
    dir="$(letsencrypt_dir)"
    [[ -n "$dir" && -f "$dir/live/$DOMAIN/fullchain.pem" ]] || return 1
    openssl x509 -in "$dir/live/$DOMAIN/fullchain.pem" -noout -ext subjectAltName 2>/dev/null | grep -q "DNS:$1\b"
}

setup_https() {
    step "HTTPS certificate (Let's Encrypt)"
    detect_public_ip
    local domain_ip www_ip want_www="false"
    domain_ip="$(resolve_ipv4 "$DOMAIN")"
    www_ip="$(resolve_ipv4 "www.$DOMAIN")"
    info "This server's public IP: ${PUBLIC_IP:-unknown}"
    info "$DOMAIN points to: ${domain_ip:-nothing yet}    www.$DOMAIN points to: ${www_ip:-nothing yet}"

    if [[ -z "$PUBLIC_IP" || -z "$domain_ip" || "$domain_ip" != "$PUBLIC_IP" ]]; then
        cat <<EOF

    HTTPS is not set up yet because $DOMAIN does not point to this server.
    1. In your domain provider's DNS settings add an A record:
         Name: @      Type: A   Value: ${PUBLIC_IP:-<this server IP>}
         Name: www    Type: A   Value: ${PUBLIC_IP:-<this server IP>}
    2. Wait 5-30 minutes (sometimes a few hours), then run this same command again.
       It will skip what is already done and only add the certificate.
    Until then the site works over plain http://${PUBLIC_IP:-<server IP>}
EOF
        return 0
    fi
    [[ -n "$www_ip" && "$www_ip" == "$PUBLIC_IP" ]] && want_www="true"

    if cert_covers "$DOMAIN" && { [[ "$want_www" == "false" ]] || cert_covers "www.$DOMAIN"; }; then
        HTTPS_ACTIVE="true"
        ok "Certificate already present for $DOMAIN (renewed automatically by cron)"
        return 0
    fi

    local -a domains=(-d "$DOMAIN")
    local names="$DOMAIN"
    if [[ "$want_www" == "true" ]]; then
        domains+=(-d "www.$DOMAIN")
        names="$DOMAIN and www.$DOMAIN"
    fi
    info "Requesting a certificate for $names"
    if (cd "$APP_DIR" && docker compose --profile tls run --rm -T certbot certonly --webroot -w /var/www/certbot \
            "${domains[@]}" --email "$EMAIL" --agree-tos --no-eff-email --non-interactive \
            --keep-until-expiring --expand </dev/null); then
        (cd "$APP_DIR" && docker compose restart nginx </dev/null) >/dev/null
        sleep 3
        if curl -fsS --max-time 10 "https://$DOMAIN/healthz/live" >/dev/null 2>&1; then
            HTTPS_ACTIVE="true"
            ok "HTTPS is live: https://$DOMAIN"
        else
            HTTPS_ACTIVE="true"
            warn "Certificate installed but https://$DOMAIN did not answer yet; try again in a minute."
        fi
    else
        warn "Let's Encrypt could not issue the certificate. Usually the DNS change is still spreading."
        warn "Wait 30 minutes and re-run the same command. The site keeps working over http:// meanwhile."
    fi
}

# ------------------------------------------------------------------------------
# 6. Cron: nightly backup + certificate renewal
# ------------------------------------------------------------------------------
install_cron() {
    step "Installing the nightly database backup and certificate renewal"
    cat > "$CRON_FILE" <<EOF
# BroCo - managed by scripts/deploy/setup-server.sh (re-running the script rewrites this file)
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Database backup every night at 02:15, keeps 14 days in $APP_DIR/backups
15 2 * * * root cd $APP_DIR && KEEP_DAYS=14 ./docker/scripts/backup-postgres.sh >> $APP_DIR/backups/backup.log 2>&1

# Let's Encrypt renewal check twice a day (renews only when the certificate is within 30 days of expiry)
0 3,15 * * * root cd $APP_DIR && docker compose --profile tls run --rm -T certbot renew --quiet >> /var/log/broco-certbot.log 2>&1 && docker compose exec -T nginx nginx -s reload >> /var/log/broco-certbot.log 2>&1
EOF
    chmod 644 "$CRON_FILE"
    ok "Backups: daily 02:15 -> $APP_DIR/backups (14 days kept). Renewal: 03:00 and 15:00."
}

# ------------------------------------------------------------------------------
# 7. Summary
# ------------------------------------------------------------------------------
summary() {
    local url="http://${PUBLIC_IP:-$DOMAIN}"
    [[ "$HTTPS_ACTIVE" == "true" ]] && url="https://$DOMAIN"
    printf '\n%s==============================================================================%s\n' "$C_BOLD" "$C_RESET"
    printf '%s  BroCo is set up%s\n' "$C_BOLD" "$C_RESET"
    printf '==============================================================================\n'
    printf '  Website:      %s\n' "$url"
    printf '  Admin login:  %s/login\n' "$url"
    if [[ "$NEW_ENV_CREATED" == "true" ]]; then
        printf '  Email:        %s\n' "$EMAIL"
        printf '  Password:     %s\n' "$ADMIN_PASSWORD"
        printf '\n  This password is shown only now. It is also saved in %s\n' "$ADMIN_PASSWORD_FILE"
        printf '  (readable by root only). Keep it in your password manager. After your first login\n'
        printf '  remove the two BOOTSTRAP_ADMIN lines from %s/.env and delete that file.\n' "$APP_DIR"
    else
        printf '  Email:        the BOOTSTRAP_ADMIN_EMAIL from %s/.env\n' "$APP_DIR"
        if [[ -f "$ADMIN_PASSWORD_FILE" ]]; then
            printf '  Password:     see %s\n' "$ADMIN_PASSWORD_FILE"
        fi
    fi
    if [[ "$HEALTH_OK" != "true" ]]; then
        printf '\n  %sThe API was still starting when the script finished.%s Check in a few minutes:\n' "$C_YELLOW" "$C_RESET"
        printf '      bash %s/scripts/deploy/status.sh\n' "$APP_DIR"
    fi
    if [[ "$HTTPS_ACTIVE" != "true" ]]; then
        printf '\n  HTTPS: not yet - point the DNS A record of %s to %s and re-run this command.\n' "$DOMAIN" "${PUBLIC_IP:-this server}"
    fi
    printf '\n  Useful commands (as root on this server):\n'
    printf '      bash %s/scripts/deploy/status.sh   # health, memory, disk, last backup\n' "$APP_DIR"
    printf '      bash %s/scripts/deploy/update.sh   # install the newest release\n' "$APP_DIR"
    printf '      bash %s/scripts/deploy/set-keys.sh # Maps, Razorpay, email, SMS, WhatsApp keys (asks, then restarts the API)\n' "$APP_DIR"
    printf '      nano %s/.env                        # Google Maps / Razorpay keys, then: cd %s && docker compose up -d backend\n' "$APP_DIR" "$APP_DIR"
    printf '\n  Guide: docs/deployment/hostinger-kvm1.md in the repository.\n'
    printf '==============================================================================\n\n'
}

main() {
    parse_args "$@"
    preflight
    install_packages
    install_docker
    setup_swap
    setup_firewall
    setup_timezone
    clone_or_update_repo
    configure_env
    install_cron
    registry_login
    pull_images
    start_stack
    wait_for_health
    setup_https
    summary
    [[ "$HEALTH_OK" == "true" ]]
}

# `--lib`: only define the functions (used to test the .env templating on another machine).
if [[ "${1:-}" == "--lib" ]]; then
    return 0 2>/dev/null || true
else
    # Wrapped in main so a half-downloaded script (curl | bash) cannot run partially.
    main "$@"
fi
