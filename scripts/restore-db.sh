#!/usr/bin/env bash
# ==============================================================================
# Pantone Fixed Asset Management System - Database Restore Script
# Usage: ./scripts/restore-db.sh <path_to_backup_file.sql.gz>
# ==============================================================================

set -euo pipefail

if [ "$#" -ne 1 ]; then
    echo "Error: Backup file path required."
    echo "Usage: $0 /path/to/pantone_fam_backup_YYYYMMDD_HHMMSS.sql.gz"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "Error: File ${BACKUP_FILE} not found."
    exit 1
fi

echo "===================================================================="
echo " WARNING: THIS WILL OVERWRITE DATA IN DATABASE '${DB_NAME:-pantone_fam}'"
echo " Target backup file: ${BACKUP_FILE}"
echo "===================================================================="

read -p "Are you sure you want to proceed with restore? (yes/no): " CONFIRM
if [ "${CONFIRM}" != "yes" ]; then
    echo "Restore aborted by operator."
    exit 0
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Verifying archive integrity..."
gzip -t "${BACKUP_FILE}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting restore..."

if command -v docker >/dev/null 2>&1 && docker ps | grep -q "pantone-db"; then
    echo "Restoring into Docker container 'pantone-db'..."
    gunzip -c "${BACKUP_FILE}" | docker exec -i pantone-db psql -U "${DB_USER:-pantone_prod_user}" -d "${DB_NAME:-pantone_fam}"
else
    echo "Restoring via local psql..."
    gunzip -c "${BACKUP_FILE}" | psql -h "${DB_HOST:-127.0.0.1}" -p "${DB_PORT:-5432}" -U "${DB_USER:-postgres}" -d "${DB_NAME:-pantone_fam}"
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Database restored successfully."
