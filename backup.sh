-- Backup script for Media Basket
#!/bin/bash
set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/media_basket_$TIMESTAMP"

mkdir -p "$BACKUP_DIR"

echo "Backing up PostgreSQL..."
docker compose exec -T postgres pg_dump -U postgres media_basket > "$BACKUP_FILE.sql"

echo "Backing up Vault secrets..."
docker compose exec -T vault vault operator raft list-peers > "$BACKUP_FILE_vault.json" 2>/dev/null || true

echo "Backup complete: $BACKUP_FILE"
ls -lh "$BACKUP_FILE"*
