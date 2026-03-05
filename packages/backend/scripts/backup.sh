#!/bin/bash

# Database Backup Script for Fund Trader Platform
# Uses pg_dump to export PostgreSQL database and compresses with gzip
# Backup files are named: backup_YYYYMMDD_HHMMSS.sql.gz

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-${SCRIPT_DIR}/../backups}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_DATABASE:-fundtrader}"
DB_USERNAME="${DB_USERNAME:-postgres}"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate timestamp for backup filename
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.sql.gz"

echo "Starting database backup..."
echo "  Host: ${DB_HOST}"
echo "  Port: ${DB_PORT}"
echo "  Database: ${DB_NAME}"
echo "  Backup file: ${BACKUP_FILE}"

# Export password from environment if PGPASSWORD is not set
if [ -z "$PGPASSWORD" ] && [ -n "$DB_PASSWORD" ]; then
    export PGPASSWORD="$DB_PASSWORD"
fi

# Run pg_dump and compress with gzip
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_NAME" | gzip > "$BACKUP_FILE"

# Verify backup was created
if [ -f "$BACKUP_FILE" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "Backup completed successfully!"
    echo "  File: $(basename "$BACKUP_FILE")"
    echo "  Size: ${BACKUP_SIZE}"
    # Output just the filename for programmatic use
    echo "$(basename "$BACKUP_FILE")"
else
    echo "Backup failed!" >&2
    exit 1
fi
