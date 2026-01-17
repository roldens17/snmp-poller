-- Add organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert a default organization for existing data
INSERT INTO organizations (name) VALUES ('Default Organization') ON CONFLICT DO NOTHING;

-- Add org_id to entities
ALTER TABLE devices ADD COLUMN IF NOT EXISTS org_id BIGINT REFERENCES organizations(id);
ALTER TABLE discovered_devices ADD COLUMN IF NOT EXISTS org_id BIGINT REFERENCES organizations(id);
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS org_id BIGINT REFERENCES organizations(id);

-- Update existing data to use the default organization
UPDATE devices SET org_id = (SELECT id FROM organizations WHERE name = 'Default Organization') WHERE org_id IS NULL;
UPDATE discovered_devices SET org_id = (SELECT id FROM organizations WHERE name = 'Default Organization') WHERE org_id IS NULL;
UPDATE alerts SET org_id = (SELECT id FROM organizations WHERE name = 'Default Organization') WHERE org_id IS NULL;

-- Now make org_id NOT NULL
ALTER TABLE devices ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE discovered_devices ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE alerts ALTER COLUMN org_id SET NOT NULL;

-- Update unique constraints to include org_id
-- Devices: hostname should be unique per org
ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_hostname_key;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'devices_org_hostname_key'
    ) THEN
        ALTER TABLE devices ADD CONSTRAINT devices_org_hostname_key UNIQUE (org_id, hostname);
    END IF;
END
$$;

-- Alerts: unique per device/org (inherited via device_id)
-- But the alert table unique constraint includes triggered_at so it's already quite granular.
-- Let's add org_id to ensure explicit isolation.
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_device_id_if_index_category_triggered_at_key;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'alerts_org_device_idx_cat_triggered_key'
    ) THEN
        ALTER TABLE alerts ADD CONSTRAINT alerts_org_device_idx_cat_triggered_key UNIQUE (org_id, device_id, if_index, category, triggered_at);
    END IF;
END
$$;

-- Discovered devices: ip unique per org
ALTER TABLE discovered_devices DROP CONSTRAINT IF EXISTS discovered_devices_ip_key;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'discovered_devices_org_ip_key'
    ) THEN
        ALTER TABLE discovered_devices ADD CONSTRAINT discovered_devices_org_ip_key UNIQUE (org_id, ip);
    END IF;
END
$$;

-- Add indexes for org_id for performance
CREATE INDEX IF NOT EXISTS devices_org_idx ON devices(org_id);
CREATE INDEX IF NOT EXISTS discovered_devices_org_idx ON discovered_devices(org_id);
CREATE INDEX IF NOT EXISTS alerts_org_idx ON alerts(org_id);
