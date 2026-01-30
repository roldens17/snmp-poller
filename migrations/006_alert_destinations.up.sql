CREATE TABLE IF NOT EXISTS alert_destinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_destinations_tenant_id ON alert_destinations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_destinations_tenant_enabled ON alert_destinations(tenant_id, is_enabled);
