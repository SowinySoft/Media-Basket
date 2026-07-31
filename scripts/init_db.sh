#!/bin/bash
# Entry script for the migrate service — waits for PG then runs Alembic
set -e

echo "[$(date)] Waiting for PostgreSQL..."
until pg_isready -h postgres -p 5432 -U postgres >/dev/null 2>&1; do
  sleep 1
done
echo "[$(date)] PostgreSQL is ready. Running migrations..."

cd /app
alembic upgrade head

echo "[$(date)] Migrations complete."
