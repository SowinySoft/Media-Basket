#!/bin/bash
# Phase I — Backup Roundtrip Test
# Tests: backup.sh → restore → verify data integrity
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="/tmp/mediabasket_backup_test"
DB_NAME="media_basket_test"
DB_USER="postgres"
DB_HOST="localhost"

echo "=== MediaBasket Backup Roundtrip Test ==="

# Setup test database
echo "[1/6] Creating test database..."
psql -h "$DB_HOST" -U "$DB_USER" -c "DROP DATABASE IF EXISTS $DB_NAME;" postgres
psql -h "$DB_HOST" -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;" postgres

# Run migrations
echo "[2/6] Running migrations..."
cd "$SCRIPT_DIR/../backend"
DATABASE_URL_SYNC="postgresql://$DB_USER@localhost/$DB_NAME" alembic upgrade head

# Insert test data
echo "[3/6] Inserting test data..."
psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "
INSERT INTO organizations (id, name, slug, created_at) VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Test Org', 'test-org', NOW());

INSERT INTO users (id, email, name, hashed_password, auth_provider, created_at) VALUES
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'test@example.com', 'Test User', 'fakehash', 'email', NOW());

INSERT INTO members (id, org_id, user_id, role, created_at) VALUES
  ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'owner', NOW());
"

# Run backup
echo "[4/6] Running backup..."
mkdir -p "$BACKUP_DIR"
DATABASE_URL_SYNC="postgresql://$DB_USER@localhost/$DB_NAME" bash "$SCRIPT_DIR/backup.sh" "$BACKUP_DIR"

# Find backup file
BACKUP_FILE=$(ls -t "$BACKUP_DIR"/media_basket_*.sql.gz 2>/dev/null | head -1)
if [ -z "$BACKUP_FILE" ]; then
  echo "FAIL: No backup file found"
  exit 1
fi
echo "  Backup: $BACKUP_FILE"

# Restore to new database
RESTORE_DB="${DB_NAME}_restore"
echo "[5/6] Restoring to $RESTORE_DB..."
psql -h "$DB_HOST" -U "$DB_USER" -c "DROP DATABASE IF EXISTS $RESTORE_DB;" postgres
psql -h "$DB_HOST" -U "$DB_USER" -c "CREATE DATABASE $RESTORE_DB;" postgres
gunzip -c "$BACKUP_FILE" | psql -h "$DB_HOST" -U "$DB_USER" -d "$RESTORE_DB" -q

# Verify data integrity
echo "[6/6] Verifying data integrity..."
ORG_COUNT=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$RESTORE_DB" -t -c "SELECT COUNT(*) FROM organizations;")
USER_COUNT=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$RESTORE_DB" -t -c "SELECT COUNT(*) FROM users;")
MEMBER_COUNT=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$RESTORE_DB" -t -c "SELECT COUNT(*) FROM members;")

echo "  Organizations: $ORG_COUNT (expected: 1)"
echo "  Users: $USER_COUNT (expected: 1)"
echo "  Members: $MEMBER_COUNT (expected: 1)"

# Cleanup
echo "Cleaning up..."
psql -h "$DB_HOST" -U "$DB_USER" -c "DROP DATABASE IF EXISTS $DB_NAME;" postgres
psql -h "$DB_HOST" -U "$DB_USER" -c "DROP DATABASE IF EXISTS $RESTORE_DB;" postgres
rm -rf "$BACKUP_DIR"

if [ "$ORG_COUNT" -ge 1 ] && [ "$USER_COUNT" -ge 1 ] && [ "$MEMBER_COUNT" -ge 1 ]; then
  echo "=== PASS: Backup roundtrip verified ==="
  exit 0
else
  echo "=== FAIL: Data mismatch after restore ==="
  exit 1
fi
