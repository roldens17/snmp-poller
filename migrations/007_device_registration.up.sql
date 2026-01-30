ALTER TABLE devices
    ADD COLUMN IF NOT EXISTS device_type TEXT,
    ADD COLUMN IF NOT EXISTS snmp_version TEXT,
    ADD COLUMN IF NOT EXISTS snmp_config_encrypted BYTEA,
    ADD COLUMN IF NOT EXISTS polling_interval_seconds INTEGER NOT NULL DEFAULT 60,
    ADD COLUMN IF NOT EXISTS tags TEXT[],
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS last_tested_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'devices_status_check'
    ) THEN
        ALTER TABLE devices
            ADD CONSTRAINT devices_status_check
            CHECK (status IN ('active', 'disabled', 'error', 'pending'));
    END IF;
END
$$;

UPDATE devices
SET device_type = 'other'
WHERE device_type IS NULL;

UPDATE devices
SET snmp_version = '2c'
WHERE snmp_version IS NULL;

UPDATE devices
SET status = CASE WHEN enabled THEN 'active' ELSE 'disabled' END
WHERE status IS NULL;

UPDATE devices
SET last_tested_at = last_seen
WHERE last_tested_at IS NULL AND last_seen IS NOT NULL;

CREATE TABLE IF NOT EXISTS device_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    ip TEXT NOT NULL,
    snmp_fingerprint_hash TEXT NOT NULL,
    test_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS device_tests_token_idx ON device_tests(test_token);
CREATE INDEX IF NOT EXISTS device_tests_tenant_idx ON device_tests(tenant_id);
