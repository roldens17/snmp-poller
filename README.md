# SNMP Poller Service

Production-ready Go service that polls network switches via SNMP v2c, stores state in PostgreSQL, exposes a REST API + optional Prometheus metrics, and can probe predefined subnets for new devices.

## Features
- Configurable worker pool polling enabled devices every 60 seconds (default) with per-device SNMP timeout/retries.
- Postgres schema for devices, current interface state, time-series counters, MAC address tables, alerts, and discovery attempts (see `migrations/`).
- Interface + MAC data persisted each poll, including historical counter samples.
- Alert engine detects interface down events, error-rate spikes, and bandwidth threshold breaches with configurable thresholds.
- Optional discovery loop sweeps configured subnets and records reachable SNMP hosts.
- REST API (Gin) exposes devices, interfaces, MAC table, alerts, and discovery logs plus `/healthz` + `/metrics` (if enabled).
- Structured logging (zerolog) and Prometheus metrics (poll duration/error counters).

## Run locally

1. Setup configuration:
   ```sh
   cp config.example.yaml config.yaml 
   # edit config.yaml with your device IPs/communities if needed
   ```
2. Start the services:
   ```sh
   make up
   ```
3. Follow the logs:
   ```sh
   make logs
   ```

### Troubleshooting
If the `snmp-poller` container exits with `"define at least one enabled switch..."`, ensure `config.yaml` exists in the repo root, has `enabled: true` for at least one switch, and is correctly mounted to `/config.yaml` as defined in `compose.yaml`.

REST API defaults to `http://localhost:8080`, Prometheus metrics on `:9105/metrics` when enabled.

To run locally without containers, set `POSTGRES_DSN` and other env vars (see `.env.example`), adjust `config.yaml`, then:
```sh
# install go >= 1.21
export POSTGRES_DSN=postgres://...
go run ./cmd/snmp-poller -config config.yaml
```

## Configuration
- YAML file (`config.yaml`) optional but recommended; missing file falls back to env-only configuration.
- Key sections:
  - `poll_interval`, `worker_count`
  - `postgres.dsn`, `postgres.max_conns`
  - `snmp_defaults`: community, version (`"2c"`), port, timeout, retries
  - `switches`: list with `name`, `address`, `community`, `enabled`, `site`, `description`
  - `discovery`: `{enabled, subnets, worker_count, timeout, interval}`
  - `alerts`: thresholds (`interface_down_after`, `error_rate_threshold`, `bandwidth_threshold`)
  - `metrics`: toggle + `addr`
- Env overrides (examples): `POSTGRES_DSN`, `HTTP_ADDR`, `POLL_INTERVAL`, `WORKER_COUNT`, `METRICS_ENABLED`, `DISCOVERY_ENABLED`, `ALERT_ERROR_RATE`, `ALERT_BANDWIDTH`.

## API Highlights
- `GET /healthz`
- `GET /devices`, `GET /devices/:id`
- `GET /devices/:id/interfaces`
- `GET /devices/:id/macs`, `GET /macs?mac=<prefix>&device_id=&vlan=`
- `GET /alerts?active=true`
- `GET /discovery`
- `GET /metrics` (when metrics enabled)

## Database Schema
See `migrations/001_init.up.sql` for details:
- `devices`: hostname, mgmt_ip, snmp_community, enabled, site, description, last_seen
- `interfaces`: current admin/oper status, counters, timestamps
- `interface_counters`: historical per-poll samples
- `mac_entries`: VLAN/MAC/port with first/last seen
- `alerts`: active/resolved alert rows
- `discovered_devices`: optional discovery log

## Development Notes
- Requires Go 1.21+ for local builds. This environment currently lacks the Go toolchain, so `go build`/`gofmt` could not be executed here.
- Migrations are embedded and run automatically on startup.
- The worker pool, discovery loop, and metrics can be tuned via config/env variables.
