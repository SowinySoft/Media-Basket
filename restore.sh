-- Restore script for Media Basket
#!/bin/bash
set -e

if [ -z "$1" ]; then
    echo "Usage: ./restore.sh <backup_file.sql>"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "File not found: $BACKUP_FILE"
    exit 1
fi

echo "Restoring PostgreSQL from $BACKUP_FILE..."
docker compose exec -T postgres psql -U postgres media_basket < "$BACKUP_FILE"

echo "Restore complete."
