CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_tenant_ip_unique ON devices(tenant_id, mgmt_ip);
