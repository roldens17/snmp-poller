BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS devices (
    id BIGSERIAL PRIMARY KEY,
    hostname TEXT NOT NULL UNIQUE,
    mgmt_ip TEXT NOT NULL,
    snmp_community TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    site TEXT,
    description TEXT,
    last_seen TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS interfaces (
    device_id BIGINT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    if_index INTEGER NOT NULL,
    if_name TEXT,
    if_descr TEXT,
    admin_status TEXT,
    oper_status TEXT,
    speed BIGINT,
    in_octets BIGINT,
    out_octets BIGINT,
    in_errors BIGINT,
    out_errors BIGINT,
    status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (device_id, if_index)
);

CREATE TABLE IF NOT EXISTS interface_counters (
    id BIGSERIAL PRIMARY KEY,
    device_id BIGINT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    if_index INTEGER NOT NULL,
    in_octets BIGINT,
    out_octets BIGINT,
    in_errors BIGINT,
    out_errors BIGINT,
    collected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS interface_counters_device_idx ON interface_counters(device_id, if_index, collected_at DESC);

CREATE TABLE IF NOT EXISTS mac_entries (
    id BIGSERIAL PRIMARY KEY,
    device_id BIGINT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    vlan INTEGER,
    mac TEXT NOT NULL,
    learned_port INTEGER,
    first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(device_id, vlan, mac)
);
CREATE INDEX IF NOT EXISTS mac_entries_device_idx ON mac_entries(device_id, vlan);

CREATE TABLE IF NOT EXISTS alerts (
    id BIGSERIAL PRIMARY KEY,
    device_id BIGINT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    if_index INTEGER,
    category TEXT NOT NULL,
    severity TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    UNIQUE (device_id, if_index, category, triggered_at)
);
CREATE INDEX IF NOT EXISTS alerts_active_idx ON alerts(device_id) WHERE resolved_at IS NULL;

CREATE TABLE IF NOT EXISTS discovered_devices (
    id BIGSERIAL PRIMARY KEY,
    ip TEXT NOT NULL UNIQUE,
    last_attempt TIMESTAMPTZ NOT NULL DEFAULT now(),
    reachable BOOLEAN NOT NULL,
    hostname TEXT,
    community TEXT
);

COMMIT;
