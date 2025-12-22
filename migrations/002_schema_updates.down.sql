BEGIN;

-- Revert alerts: remove partial unique index, restore triggered_at-based uniqueness constraint.
DROP INDEX IF EXISTS alerts_unique_active_idx;
ALTER TABLE alerts ADD CONSTRAINT alerts_device_id_if_index_category_triggered_at_key
    UNIQUE (device_id, if_index, category, triggered_at);

-- Drop MAC helper indexes added in 002 up.
DROP INDEX IF EXISTS mac_entries_device_port_idx;
DROP INDEX IF EXISTS mac_entries_mac_idx;

-- Remove unique timestamp constraint on counters added in 002 up.
DROP INDEX IF EXISTS interface_counters_device_if_time_idx;

-- Restore interface counter columns on interfaces table.
-- NOTE: Any data previously stored in these columns cannot be recovered after a DROP COLUMN.
ALTER TABLE interfaces
    ADD COLUMN IF NOT EXISTS in_octets BIGINT,
    ADD COLUMN IF NOT EXISTS out_octets BIGINT,
    ADD COLUMN IF NOT EXISTS in_errors BIGINT,
    ADD COLUMN IF NOT EXISTS out_errors BIGINT;

-- Revert devices: drop mgmt_ip uniqueness, convert inet->text, optionally restore hostname uniqueness.
ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_mgmt_ip_key;
ALTER TABLE devices ALTER COLUMN mgmt_ip TYPE TEXT USING mgmt_ip::text;

-- NOTE: This may fail if duplicate hostnames exist (hostname uniqueness was removed in 002 up).
ALTER TABLE devices ADD CONSTRAINT devices_hostname_key UNIQUE (hostname);

COMMIT;
