#!/bin/bash
set -euo pipefail

REPO="$HOME/dev/snmp-poller"
cd "$REPO"

# Load env for cron
set -a
source "$REPO/ops/ai/.env"
set +a

WORKDIR="$REPO/ops/ai/tmp"
LOGDIR="$REPO/ops/ai/logs"
LOGFILE="$LOGDIR/overnight.log"
mkdir -p "$WORKDIR" "$LOGDIR"

log() { echo "[$(date -Is)] $*" >> "$LOGFILE"; }

log "START tenant=${TENANT_ID:-unset}"

# ---- UPDATE THESE AFTER WE INSPECT YOUR TABLE ----
ALERTS_TABLE="alerts"
COL_DEVICE="device_name"
COL_TYPE="alert_type"
COL_TENANT="tenant_id"
COL_TIME="created_at"

# Pull last 24h alert summary
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -t -A -F"," <<EOF2 > "$WORKDIR/alerts.csv"
SELECT
  COALESCE(d.hostname, CONCAT('device_id=', a.device_id)) AS device,
  a.category AS type,
  a.severity AS severity,
  count(*) AS n
FROM alerts a
LEFT JOIN devices d ON d.id = a.device_id
WHERE a.org_id = ${TENANT_ID}
  AND a.triggered_at >= now() - interval '24 hours'
GROUP BY 1,2,3
ORDER BY n DESC
LIMIT 50;
EOF2



AI_OUTPUT="$(sgpt "
You are a senior network reliability engineer.

Analyze the last 24 hours for tenant: ${TENANT_ID}.
Be concise, specific, actionable.

ALERTS (csv):
$(cat "$WORKDIR/alerts.csv")

Return markdown with:
1) Executive Summary (max 3 bullets)
2) Top Issues (ranked) + likely root cause
3) Severity per issue (P1/P2/P3)
4) Recommended next actions (checklist)
5) Devices/interfaces to watch
")"

# Create insights table if missing
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'EOF3'
CREATE TABLE IF NOT EXISTS ai_insights (
  id bigserial PRIMARY KEY,
  tenant_id text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  severity text NOT NULL DEFAULT 'AUTO',
  title text NOT NULL,
  summary_md text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_insights_tenant_created_at
ON ai_insights (tenant_id, created_at DESC);
EOF3

# Insert insight
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<EOF4
INSERT INTO ai_insights (
  tenant_id, period_start, period_end, severity, title, summary_md, created_at
) VALUES (
  '${TENANT_ID}',
  now() - interval '24 hours',
  now(),
  'AUTO',
  'Overnight Network Insights',
  \$\$${AI_OUTPUT}\$\$,
  now()
);
EOF4

log "DONE tenant=${TENANT_ID}"
