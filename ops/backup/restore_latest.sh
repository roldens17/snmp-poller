#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
LATEST="$(ls -1t "$BACKUP_DIR"/snmp_*.sql.gz | head -n1)"
[ -n "$LATEST" ] || { echo 'no backup found'; exit 1; }

gunzip -c "$LATEST" | docker compose -f "$ROOT_DIR/compose.yaml" exec -T postgres psql -U "${POSTGRES_USER:-snmp}" -d "${POSTGRES_DB:-snmp}"
echo "restored_from=$LATEST"
