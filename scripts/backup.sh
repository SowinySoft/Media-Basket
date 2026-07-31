#!/bin/bash
# Automated daily backup script — Gap 21
# Usage: ./backup.sh [--compress] [--encrypt]
# Cron: 0 2 * * * /path/to/backup.sh >> /var/log/mediabasket-backup.log 2>&1

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_URL="${DATABASE_URL:-postgresql://mediabasket:mediabasket@localhost:5432/mediabasket}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="mediabasket_${TIMESTAMP}"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup: $BACKUP_NAME"

# Extract DB connection info
DB_HOST=$(echo "$DB_URL" | sed -n 's|.*@\([^:]*\):\([0-9]*\)/.*|\1|p')
DB_PORT=$(echo "$DB_URL" | sed -n 's|.*@\([^:]*\):\([0-9]*\)/.*|\2|p')
DB_NAME=$(echo "$DB_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
DB_USER=$(echo "$DB_URL" | sed -n 's|://\([^:]*\):.*|\1|p')

# pg_dump
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --format=custom \
    --file="$BACKUP_DIR/${BACKUP_NAME}.dump"

echo "[$(date)] Database dump complete: ${BACKUP_NAME}.dump"

# Optional compression (double compresses the custom format for extra savings)
if [[ "${1:-}" == "--compress" ]]; then
    gzip "$BACKUP_DIR/${BACKUP_NAME}.dump"
    echo "[$(date)] Compressed: ${BACKUP_NAME}.dump.gz"
fi

# Optional encryption
if [[ "${2:-}" == "--encrypt" ]] || [[ "${1:-}" == "--encrypt" ]]; then
    DUMP_FILE="$BACKUP_DIR/${BACKUP_NAME}.dump"
    [[ -f "$DUMP_FILE.gz" ]] && DUMP_FILE="$DUMP_FILE.gz"
    openssl enc -aes-256-cbc -salt -pbkdf2 \
        -in "$DUMP_FILE" \
        -out "${DUMP_FILE}.enc" \
        -pass env:BACKUP_ENCRYPT_KEY
    rm -f "$DUMP_FILE"
    echo "[$(date)] Encrypted: ${BACKUP_NAME}.dump.enc"
fi

# Cleanup old backups (keep 30 days)
find "$BACKUP_DIR" -name "mediabasket_*" -mtime +30 -delete
echo "[$(date)] Old backups cleaned (kept 30 days)"

echo "[$(date)] Backup complete: $BACKUP_NAME"
