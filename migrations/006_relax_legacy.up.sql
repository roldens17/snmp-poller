-- Relax legacy org_id constraints to allow NULL
-- This is necessary because the Go code now only writes tenant_id

ALTER TABLE devices ALTER COLUMN org_id DROP NOT NULL;
ALTER TABLE alerts ALTER COLUMN org_id DROP NOT NULL;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'discovered_devices' AND column_name = 'org_id') THEN
        ALTER TABLE discovered_devices ALTER COLUMN org_id DROP NOT NULL;
    END IF;
END $$;
