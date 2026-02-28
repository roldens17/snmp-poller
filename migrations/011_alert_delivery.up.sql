CREATE TABLE IF NOT EXISTS alert_deliveries (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  destination_id UUID NOT NULL REFERENCES alert_destinations(id) ON DELETE CASCADE,
  alert_id BIGINT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 1,
  status_code INTEGER,
  success BOOLEAN NOT NULL DEFAULT false,
  duration_ms INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_deliveries_tenant_time ON alert_deliveries(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_alert ON alert_deliveries(alert_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_dest ON alert_deliveries(destination_id, created_at DESC);
