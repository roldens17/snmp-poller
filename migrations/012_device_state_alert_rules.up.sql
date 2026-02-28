BEGIN;

CREATE TABLE IF NOT EXISTS device_state (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  device_id BIGINT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  current_state TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK (current_state IN ('UP','DOWN','UNKNOWN')),
  consecutive_failures INT NOT NULL DEFAULT 0,
  consecutive_successes INT NOT NULL DEFAULT 0,
  last_poll_at TIMESTAMPTZ NULL,
  last_success_at TIMESTAMPTZ NULL,
  last_state_change_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, device_id)
);

ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS alert_type TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS details JSONB,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

UPDATE alerts
SET alert_type = COALESCE(alert_type, CASE WHEN category = 'device_down' THEN 'DEVICE_DOWN' ELSE upper(category) END),
    title = COALESCE(title, COALESCE(message, category)),
    details = COALESCE(details, metadata, '{}'::jsonb),
    status = COALESCE(status, CASE WHEN resolved_at IS NULL THEN 'active' ELSE 'resolved' END),
    last_seen_at = COALESCE(last_seen_at, COALESCE(resolved_at, triggered_at, now()));

ALTER TABLE alerts
  ALTER COLUMN alert_type SET DEFAULT 'LEGACY',
  ALTER COLUMN title SET DEFAULT '',
  ALTER COLUMN details SET DEFAULT '{}'::jsonb,
  ALTER COLUMN status SET DEFAULT 'active',
  ALTER COLUMN last_seen_at SET DEFAULT now();

ALTER TABLE alerts
  ALTER COLUMN alert_type SET NOT NULL,
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN details SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN last_seen_at SET NOT NULL;

ALTER TABLE alerts
  DROP CONSTRAINT IF EXISTS alerts_status_check;
ALTER TABLE alerts
  ADD CONSTRAINT alerts_status_check CHECK (status IN ('active','resolved'));

CREATE INDEX IF NOT EXISTS alerts_tenant_status_triggered ON alerts (tenant_id, status, triggered_at DESC);
CREATE INDEX IF NOT EXISTS alerts_tenant_device_status ON alerts (tenant_id, device_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS alerts_unique_device_down_active ON alerts (tenant_id, device_id, alert_type) WHERE status='active' AND alert_type='DEVICE_DOWN';

COMMIT;
