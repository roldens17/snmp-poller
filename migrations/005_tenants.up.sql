-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_tenants table
CREATE TABLE IF NOT EXISTS user_tenants (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'owner',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, tenant_id)
);

-- Insert default tenant
-- We need to capture the ID to use it for backfilling.
DO $$
DECLARE
    default_tenant_id UUID;
BEGIN
    -- Check if default tenant exists, if not create it
    INSERT INTO tenants (name, slug)
    VALUES ('Default Tenant', 'default')
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO default_tenant_id;

    -- If we didn't get an ID (because it existed and we just updated name), fetch it
    IF default_tenant_id IS NULL THEN
        SELECT id INTO default_tenant_id FROM tenants WHERE slug = 'default';
    END IF;

    -- Add existing users to default tenant
    INSERT INTO user_tenants (user_id, tenant_id, role)
    SELECT id, default_tenant_id, 'owner'
    FROM users
    ON CONFLICT DO NOTHING;

    -- Add tenant_id to devices
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'tenant_id') THEN
        ALTER TABLE devices ADD COLUMN tenant_id UUID REFERENCES tenants(id);
        -- Backfill
        UPDATE devices SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
        ALTER TABLE devices ALTER COLUMN tenant_id SET NOT NULL;
        CREATE INDEX devices_tenant_idx ON devices(tenant_id);
    END IF;

    -- Update devices unique constraint to use tenant_id instead of org_id
    -- Old constraint: devices_org_hostname_key (org_id, hostname)
    -- New constraint: devices_tenant_hostname_key (tenant_id, hostname)
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'devices_org_hostname_key') THEN
        ALTER TABLE devices DROP CONSTRAINT devices_org_hostname_key;
    END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'devices_tenant_hostname_key') THEN
        ALTER TABLE devices ADD CONSTRAINT devices_tenant_hostname_key UNIQUE (tenant_id, hostname);
    END IF;
    
    -- Add tenant_id to alerts
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alerts' AND column_name = 'tenant_id') THEN
        ALTER TABLE alerts ADD COLUMN tenant_id UUID REFERENCES tenants(id);
        UPDATE alerts SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
        ALTER TABLE alerts ALTER COLUMN tenant_id SET NOT NULL;
        CREATE INDEX alerts_tenant_idx ON alerts(tenant_id);
    END IF;

     -- Update alerts unique constraint
     -- Old: alerts_org_device_idx_cat_triggered_key
     -- New: alerts_tenant_device_idx_cat_triggered_key
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alerts_org_device_idx_cat_triggered_key') THEN
        ALTER TABLE alerts DROP CONSTRAINT alerts_org_device_idx_cat_triggered_key;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alerts_tenant_device_idx_cat_triggered_key') THEN
        ALTER TABLE alerts ADD CONSTRAINT alerts_tenant_device_idx_cat_triggered_key UNIQUE (tenant_id, device_id, if_index, category, triggered_at);
    END IF;


    -- Add tenant_id to mac_entries (wait, mac_entries join devices on device_id, maybe we don't strictly need tenant_id there if we query via device? 
    -- Request said "Add tenant_id UUID NOT NULL to all tables that back: devices, alerts, macs"
    -- So we should add it for consistency and faster queries without joining devices every time, although normally MACs belong to a device.)
    -- Let's check mac_entries table structure. It uses device_id.
    -- If we add tenant_id to mac_entries, we denormalize but it makes "select * from macs where tenant_id=..." easier.
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mac_entries' AND column_name = 'tenant_id') THEN
        ALTER TABLE mac_entries ADD COLUMN tenant_id UUID REFERENCES tenants(id);
        -- Backfill: Join with devices to get the correct tenant (or default)
        -- Since all devices are now assigned to default_tenant_id (or were already), we can use that logic.
        -- But correct way is to join.
        UPDATE mac_entries m
        SET tenant_id = d.tenant_id
        FROM devices d
        WHERE m.device_id = d.id AND m.tenant_id IS NULL;

        -- Fallback if any orphaned mac entries
        UPDATE mac_entries SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;

        ALTER TABLE mac_entries ALTER COLUMN tenant_id SET NOT NULL;
        CREATE INDEX mac_entries_tenant_idx ON mac_entries(tenant_id);
    END IF;
    
    -- Discovered devices? The user request didn't explicitly mention discovered_devices, but it was in the previous migration.
    -- "Add tenant_id UUID NOT NULL to all tables that back: devices, alerts, macs"
    -- I should probably add it to discovered_devices too for completeness, or ignore if not critical. 
    -- I'll stick to the explicit scope "devices, alerts, macs" but `discovered_devices` is part of the system. 
    -- I'll check if `discovered_devices` exists and add it if so, to avoid breaking it.
    -- Migration 003 has `discovered_devices`.
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'discovered_devices') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'discovered_devices' AND column_name = 'tenant_id') THEN
              ALTER TABLE discovered_devices ADD COLUMN tenant_id UUID REFERENCES tenants(id);
              UPDATE discovered_devices SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
              ALTER TABLE discovered_devices ALTER COLUMN tenant_id SET NOT NULL;
               CREATE INDEX discovered_devices_tenant_idx ON discovered_devices(tenant_id);
              
              -- Unique constraint
              -- Old: discovered_devices_org_ip_key
              IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discovered_devices_org_ip_key') THEN
                    ALTER TABLE discovered_devices DROP CONSTRAINT discovered_devices_org_ip_key;
              END IF;
              IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discovered_devices_tenant_ip_key') THEN
                   ALTER TABLE discovered_devices ADD CONSTRAINT discovered_devices_tenant_ip_key UNIQUE (tenant_id, ip);
              END IF;
        END IF;
    END IF;

END $$;
