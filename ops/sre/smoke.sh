#!/usr/bin/env bash
set -euo pipefail
BASE="${1:-http://localhost:8081}"
EMAIL="${2:-admin@example.com}"
PASS="${3:-changeme}"

echo "[1] health"
curl -fsS "$BASE/healthz"; echo

echo "[2] login"
CODE=$(curl -sS -c /tmp/snmp.cookies -o /tmp/snmp.login -w "%{http_code}" -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
echo "login_status=$CODE"
cat /tmp/snmp.login; echo

echo "[3] me"
curl -fsS -b /tmp/snmp.cookies "$BASE/auth/me"; echo

echo "[4] devices"
curl -fsS -b /tmp/snmp.cookies "$BASE/devices"; echo
