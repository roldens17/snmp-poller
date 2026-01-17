BEGIN;

-- Devices hostname no longer unique; ensure mgmt_ip is INET + unique.
ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_hostname_key;
ALTER TABLE devices ALTER COLUMN mgmt_ip TYPE inet USING mgmt_ip::inet;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'devices_mgmt_ip_key'
    ) THEN
        ALTER TABLE devices ADD CONSTRAINT devices_mgmt_ip_key UNIQUE (mgmt_ip);
    END IF;
END
$$;

-- Interfaces table keeps only status/identity fields.
ALTER TABLE interfaces
    DROP COLUMN IF EXISTS in_octets,
    DROP COLUMN IF EXISTS out_octets,
    DROP COLUMN IF EXISTS in_errors,
    DROP COLUMN IF EXISTS out_errors;

-- Prevent duplicate counter samples for a poll timestamp.
CREATE UNIQUE INDEX IF NOT EXISTS interface_counters_device_if_time_idx
    ON interface_counters(device_id, if_index, collected_at);

-- Speed up MAC lookups.
CREATE INDEX IF NOT EXISTS mac_entries_mac_idx ON mac_entries(mac);
CREATE INDEX IF NOT EXISTS mac_entries_device_port_idx ON mac_entries(device_id, learned_port);

-- Allow multiple historical alerts but enforce a single active one per key.
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_device_id_if_index_category_triggered_at_key;
CREATE UNIQUE INDEX IF NOT EXISTS alerts_unique_active_idx
    ON alerts(device_id, if_index, category) WHERE resolved_at IS NULL;

COMMIT;
