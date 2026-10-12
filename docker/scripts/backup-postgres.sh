#!/bin/sh
# Nightly PostgreSQL backup for the single-VPS deployment.
#
#   Install (as root on the VPS, from the repo directory):
#     chmod +x docker/scripts/backup-postgres.sh
#     crontab -e   ->   15 2 * * * cd /opt/broco-mod && ./docker/scripts/backup-postgres.sh >> backups/backup.log 2>&1
#
# Keeps KEEP_DAYS days of compressed dumps in ./backups. Copy that folder off the server
# (rclone / Hostinger backups / S3) - a backup that lives only on the same VPS is not a backup.
set -eu

KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$(dirname "$0")/../../backups"
mkdir -p "$BACKUP_DIR"

# Read DB name/user from .env when present
if [ -f .env ]; then
    # shellcheck disable=SC1091
    . ./.env
fi
DB="${POSTGRES_DB:-broco_mod}"
USER="${POSTGRES_USER:-postgres}"

echo "[$(date -Iseconds)] Backing up ${DB}..."
docker exec broco-mod-postgres pg_dump -U "$USER" -d "$DB" --format=custom --compress=9 \
    > "$BACKUP_DIR/${DB}-${STAMP}.dump"

# Verify the dump is readable before pruning older ones
docker exec -i broco-mod-postgres pg_restore --list < "$BACKUP_DIR/${DB}-${STAMP}.dump" > /dev/null

find "$BACKUP_DIR" -name "${DB}-*.dump" -mtime +"$KEEP_DAYS" -delete
echo "[$(date -Iseconds)] Done: $BACKUP_DIR/${DB}-${STAMP}.dump"

# Restore (destructive - replaces data):
#   docker exec -i broco-mod-postgres pg_restore -U postgres -d broco_mod --clean --if-exists < backups/<file>.dump
