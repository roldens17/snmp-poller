-- Ensure devices status defaults to pending and last_seen is nullable with no epoch default.

ALTER TABLE devices
    ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE devices
    ALTER COLUMN last_seen DROP DEFAULT,
    ALTER COLUMN last_seen DROP NOT NULL;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'devices_status_check') THEN
        ALTER TABLE devices DROP CONSTRAINT devices_status_check;
    END IF;
    ALTER TABLE devices
        ADD CONSTRAINT devices_status_check
        CHECK (status IN ('active', 'disabled', 'error', 'pending'));
END $$;
