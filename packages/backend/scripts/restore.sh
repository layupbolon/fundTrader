#!/bin/bash

# Database Restore Script for Fund Trader Platform
# Restores PostgreSQL database from a compressed backup file
# Usage: ./restore.sh <backup_filename>

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-${SCRIPT_DIR}/../backups}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_DATABASE:-fundtrader}"
DB_USERNAME="${DB_USERNAME:-postgres}"

# Check if backup filename is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <backup_filename>" >&2
    echo "Example: $0 backup_20260305_020000.sql.gz" >&2
    exit 1
fi

BACKUP_FILENAME="$1"
BACKUP_FILE="${BACKUP_DIR}/${BACKUP_FILENAME}"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found: ${BACKUP_FILE}" >&2
    exit 1
fi

echo "Starting database restore..."
echo "  Host: ${DB_HOST}"
echo "  Port: ${DB_PORT}"
echo "  Database: ${DB_NAME}"
echo "  Backup file: ${BACKUP_FILENAME}"

# Export password from environment if PGPASSWORD is not set
if [ -z "$PGPASSWORD" ] && [ -n "$DB_PASSWORD" ]; then
    export PGPASSWORD="$DB_PASSWORD"
fi

# Check if database exists and drop/recreate it
echo "Checking database connection..."

# Kill existing connections to the database
echo "Terminating existing connections to ${DB_NAME}..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d postgres -c "
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();
" || true

# Drop and recreate the database
echo "Recreating database ${DB_NAME}..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d postgres -c "CREATE DATABASE ${DB_NAME};"

# Restore from backup
echo "Restoring database from backup..."
gunzip -c "$BACKUP_FILE" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_NAME" > /dev/null

# Verify restore
echo "Verifying restore..."
TABLE_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
echo "Database restored successfully!"
echo "  Tables found: ${TABLE_COUNT}"
