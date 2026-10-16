#!/usr/bin/env bash
# ==============================================================================
# BroCo - quick health report for the VPS
#
#   bash /opt/broco-mod/scripts/deploy/status.sh
#
# Read-only: shows containers, API health, HTTPS state, memory, disk and the latest backup.
# ==============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$APP_DIR"

section() { printf '\n== %s\n' "$*"; }

env_value() {
    local line
    line="$(grep -E "^$1=" .env 2>/dev/null | tail -n1 || true)"
    line="${line#*=}"; line="${line%$'\r'}"
    printf '%s' "$line" | sed -E 's/[[:space:]]+#.*$//; s/^"(.*)"$/\1/'
}

DOMAIN="$(env_value DOMAIN)"
printf 'BroCo status  -  %s  -  %s\n' "$(date '+%d %b %Y %H:%M %Z')" "$(hostname)"
printf 'Code: %s on %s\n' "$(git rev-parse --short HEAD 2>/dev/null || echo '?')" "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
[[ -n "$DOMAIN" ]] && printf 'Domain: %s\n' "$DOMAIN"

section "Containers"
docker compose ps 2>/dev/null || printf 'docker compose is not running here\n'

section "Health"
if curl -fsSL --max-time 10 http://127.0.0.1/healthz/live >/dev/null 2>&1; then
    printf 'API (http):  ok\n'
else
    printf 'API (http):  NOT answering  ->  docker compose logs --tail=100 backend\n'
fi
if [[ -n "$DOMAIN" && "$DOMAIN" != "localhost" ]]; then
    if curl -fsS --max-time 10 "https://$DOMAIN/healthz/live" >/dev/null 2>&1; then
        expiry="$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2 || true)"
        printf 'HTTPS:       ok  https://%s  (certificate valid until %s)\n' "$DOMAIN" "${expiry:-?}"
    else
        printf 'HTTPS:       not active for https://%s (DNS not pointed yet, or certificate missing - re-run setup-server.sh)\n' "$DOMAIN"
    fi
fi

section "Memory"
free -h | awk 'NR==1 || /Mem|Swap/'

section "Disk"
df -h / | awk 'NR==1 || /\//'
printf 'Docker:  %s\n' "$(docker system df --format '{{.Type}}: {{.Size}} ({{.Reclaimable}} reclaimable)' 2>/dev/null | tr '\n' ';' | sed 's/;/;  /g')"

section "Backups ($APP_DIR/backups)"
latest="$(ls -t backups/*.dump 2>/dev/null | head -n1 || true)"
if [[ -n "$latest" ]]; then
    printf 'Latest:  %s  (%s, %s)\n' "$(basename "$latest")" "$(du -h "$latest" | cut -f1)" "$(date -r "$latest" '+%d %b %Y %H:%M')"
    printf 'Count:   %s dump files\n' "$(ls backups/*.dump 2>/dev/null | wc -l)"
else
    printf 'No backups yet (first one runs at 02:15 tonight; run now with: ./docker/scripts/backup-postgres.sh)\n'
fi
if [[ -f backups/backup.log ]]; then
    printf 'Last log line: %s\n' "$(tail -n1 backups/backup.log)"
fi

section "Scheduled jobs"
if [[ -f /etc/cron.d/broco-mod ]]; then
    grep -E '^[0-9*]' /etc/cron.d/broco-mod | awk '{print "  " $1, $2, $3, $4, $5, "->", $8, $9, $10}'
else
    printf 'Cron file /etc/cron.d/broco-mod missing - re-run setup-server.sh\n'
fi
printf '\n'
