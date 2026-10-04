#!/usr/bin/env bash
# ==============================================================================
# Pantone Fixed Asset Management System - Automated Database Backup Script
# Usage: ./scripts/backup-db.sh [backup_destination_dir]
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${1:-/var/backups/pantone_fam}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/pantone_fam_backup_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=30

mkdir -p "${BACKUP_DIR}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting automated PostgreSQL backup..."

# If running inside Docker Compose
if command -v docker >/dev/null 2>&1 && docker ps | grep -q "pantone-db"; then
    echo "Creating backup from Docker container 'pantone-db'..."
    docker exec -t pantone-db pg_dump -U "${DB_USER:-pantone_prod_user}" -d "${DB_NAME:-pantone_fam}" --format=plain --no-owner --clean | gzip -9 > "${BACKUP_FILE}"
else
    # Direct pg_dump via local environment variables
    echo "Creating backup via local pg_dump..."
    pg_dump -h "${DB_HOST:-127.0.0.1}" -p "${DB_PORT:-5432}" -U "${DB_USER:-postgres}" -d "${DB_NAME:-pantone_fam}" --format=plain --no-owner --clean | gzip -9 > "${BACKUP_FILE}"
fi

FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup completed successfully: ${BACKUP_FILE} (${FILE_SIZE})"

# Verify gzip integrity
gzip -t "${BACKUP_FILE}"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Integrity verification: PASSED (Checksum valid)"

# Apply retention policy: Remove backups older than RETENTION_DAYS
echo "Applying retention policy: Cleaning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "pantone_fam_backup_*.sql.gz" -type f -mtime +"${RETENTION_DAYS}" -delete
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup task finished."
