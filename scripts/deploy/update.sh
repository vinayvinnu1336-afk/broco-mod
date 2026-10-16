#!/usr/bin/env bash
# ==============================================================================
# BroCo - install the newest release on the VPS
#
#   bash /opt/broco-mod/scripts/deploy/update.sh
#
# Pulls the latest code (for compose/nginx/script changes) and the latest images built by the
# "Release images" GitHub workflow, restarts only what changed (database migrations run
# automatically on API start) and removes old images to free disk space.
# Nothing is built on the server. Safe to run any time; the site is briefly unavailable
# (a few seconds) while containers restart.
# ==============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
BRANCH="${BRANCH:-}"

step() { printf '\n==> %s\n' "$*"; }
die()  { printf '\n[error] %s\n' "$*" >&2; exit 1; }

[[ "$(id -u)" -eq 0 ]] || die "Run as root: sudo bash $0"
[[ -f "$APP_DIR/docker-compose.yml" ]] || die "No docker-compose.yml in $APP_DIR"
[[ -f "$APP_DIR/.env" ]] || die "No .env in $APP_DIR - run scripts/deploy/setup-server.sh first"
cd "$APP_DIR"

step "Updating the code in $APP_DIR"
if [[ -z "$BRANCH" ]]; then
    BRANCH="$(git rev-parse --abbrev-ref HEAD)"
fi
before="$(git rev-parse --short HEAD)"
if git fetch --quiet origin && git pull --quiet --ff-only origin "$BRANCH"; then
    printf '    %s -> %s (%s)\n' "$before" "$(git rev-parse --short HEAD)" "$BRANCH"
else
    printf '    [warning] git pull failed (local edits or no network). Continuing with the current code.\n' >&2
fi
chmod +x docker/scripts/*.sh scripts/deploy/*.sh 2>/dev/null || true

step "Downloading the newest images"
docker compose pull --quiet

step "Restarting changed services"
docker compose up -d --no-build --remove-orphans

step "Waiting for the API"
for _ in $(seq 1 36); do
    if curl -fsSL --max-time 10 http://127.0.0.1/healthz/live >/dev/null 2>&1; then
        printf '    [ok] API is up\n'
        break
    fi
    sleep 5
done
if ! curl -fsSL --max-time 10 http://127.0.0.1/healthz/live >/dev/null 2>&1; then
    printf '    [warning] API not answering yet. Check:  docker compose ps   and   docker compose logs --tail=100 backend\n' >&2
fi

step "Removing old images"
docker image prune -f >/dev/null
printf '    done\n'

step "Current state"
docker compose ps
printf '\nUpdate finished. Status any time:  bash %s/scripts/deploy/status.sh\n' "$APP_DIR"
