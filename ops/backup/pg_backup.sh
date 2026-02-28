#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

cd "$ROOT_DIR"
mkdir -p "$BACKUP_DIR"

TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/snmp_${TS}.sql.gz"

# Uses compose env (POSTGRES_USER/POSTGRES_DB)
docker compose -f compose.yaml exec -T postgres pg_dump -U "${POSTGRES_USER:-snmp}" "${POSTGRES_DB:-snmp}" | gzip -9 > "$OUT"

find "$BACKUP_DIR" -type f -name 'snmp_*.sql.gz' -mtime +"$RETENTION_DAYS" -delete

echo "backup_written=$OUT"
