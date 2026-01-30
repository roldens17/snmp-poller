# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Key commands

### Full stack via Docker Compose
- Start Postgres + backend + web:
  - `make up`
- Tail logs:
  - `make logs`
- Stop and remove containers:
  - `make down`
- List services:
  - `make ps`

Services (from `compose.yaml`):
- `postgres` on host `5432`.
- `snmp-poller` API on host `8081` (container `:8080`), Prometheus metrics on host `9105` (container `:9105`).
- `web` React app on host `3000`, configured to talk to the API via `VITE_API_BASE_URL` (defaults to `http://localhost:8081`).

### Backend Go service (without Docker)
- Requires Go `1.21+` and a running Postgres reachable via `POSTGRES_DSN`.
- Copy and edit config:
  - `cp config.example.yaml config.yaml`
- Run the service locally (config path is optional; defaults to `./config.yaml`):
  - `POSTGRES_DSN=postgres://... AUTH_JWT_SECRET=... ENCRYPTION_KEY=... CONFIG_FILE=config.yaml go run ./cmd/snmp-poller`
- Build the backend binary:
  - `go build -o snmp-poller ./cmd/snmp-poller`
- Run all Go tests:
  - `go test ./...`
- Run a single Go test (example):
  - `go test ./internal/devicereg -run TestValidateDeviceTest`

### Web frontend (React + Vite in `web/`)
From `web/`:
- Install dependencies:
  - `npm install`
- Run dev server on port `3000`:
  - `npm run dev`
- Build the web app:
  - `npm run build`
- Lint frontend code:
  - `npm run lint`
- Run all frontend tests (Vitest):
  - `npm test`
- Run a single frontend test (example):
  - `npm test -- src/path/to/your.test.jsx`

### Docker images
- Build backend image manually:
  - `docker build -t snmp-poller:local .`
- Build web image manually:
  - `docker build -t snmp-poller-web:local ./web`

## Architecture overview

### High-level layout
- `cmd/snmp-poller` – main entrypoint; wires configuration, database, poller, and HTTP server; handles signal-based shutdown.
- `internal/config` – central configuration loaded from optional YAML (`config.yaml` by default or `CONFIG_FILE` env) with environment overrides; defines SNMP switches, HTTP settings, discovery, alerting, metrics, and auth.
- `internal/store` – data access layer built on `pgxpool`; owns the connection pool, runs embedded SQL migrations from `migrations/*.sql`, and exposes typed methods for devices, interfaces, counters, MAC entries, alerts, discovery records, tenants, users, and alert destinations.
- `internal/snmpclient` – low-level SNMP v1/v2c client functions using `gosnmp` for polling interfaces and MAC tables, plus helpers for IP enumeration and counter math.
- `internal/poller` – long-running worker service that periodically enqueues configured switches, calls `snmpclient` to fetch interface and MAC data, writes to `store`, evaluates alert conditions, and optionally performs subnet discovery.
- `internal/server` – Gin-based HTTP API server exposing health, auth, multi-tenant CRUD endpoints, discovery logs, alert destinations, and optional `/metrics` Prometheus handler; enforces authentication and tenant scoping on most data access.
- `internal/auth` – JWT and password hashing layer; configures cookie attributes and token TTL from `config.Auth`.
- `internal/devicereg` – device registration workflow that validates SNMP connectivity/credentials, issues short-lived "test tokens", encrypts SNMP config using `internal/security`, and persists registered devices.
- `internal/security` – AES-GCM encryption helper that loads a 32-byte `ENCRYPTION_KEY` (raw or base64-encoded) from the environment for device credential encryption.
- `internal/notification` – webhook notifier that sends JSON payloads to configured alert destinations when alerts are created or resolved.
- `migrations` – embedded SQL schema and migration files loaded via `migrations.Files` and applied by `store.RunMigrations`.
- `web` – React + Vite frontend that talks to the backend over HTTP, using `VITE_API_BASE_URL` (defaults to `http://localhost:8081` in `compose.yaml`).

### SNMP polling and persistence
- `cmd/snmp-poller/main.go` constructs a single `*config.Config` and `*store.Store`, runs DB migrations, then starts the poller and HTTP server.
- `internal/poller.Service`:
  - On startup, resolves the multi-tenant "default" tenant via `store.GetTenantBySlug("default")` and stores its ID as `defaultTenantID`.
  - Spawns a worker pool sized by `config.WorkerCount` and fills a job channel from the configured `config.Switches` on each poll interval.
  - For each enabled switch:
    - Uses `snmpclient.PollInterfaces` and `snmpclient.PollMACTable` to read interface state/counters and forwarding tables.
    - Upserts a `store.Device` row (scoped to `defaultTenantID`) with metadata like hostname, mgmt IP, site, and last-seen time.
    - Loads prior interface state and counters from `store` to compute deltas and status-change durations.
    - Upserts current interface state, inserts new counter samples, prunes removed interfaces, and upserts MAC entries.

### Alerts and notifications
- Alert evaluation (`internal/poller/alerts.go`) runs after each successful device poll:
  - Detects interfaces that have been down longer than `config.Alerting.InterfaceDownAfter` based on status-change timestamps.
  - Computes error rate and bandwidth utilization using helpers in `snmpclient` (`ClampCounter`, `BitsPerSecond`, `ErrorRate`) and compares against thresholds in `config.Alerting`.
  - Calls `store.UpsertAlert` / `ResolveAlert` to maintain a single active alert per device/interface/category.
- `internal/notification.Service` responds to alert lifecycle events:
  - Looks up enabled alert destinations for the tenant via `store.ListEnabledAlertDestinations`.
  - Builds a webhook payload containing tenant ID, alert data, and a dashboard link derived from `config.HTTP.DashboardBaseURL` (defaulting to `http://localhost:3000/alerts`).
  - Sends JSON POST requests with basic retry logic to each destination.

### Discovery loop
- When `config.Discovery.Enabled` is true and `Discovery.Subnets` is non-empty, the poller starts `discoveryLoop`:
  - Immediately runs a sweep, then repeats on a ticker based on `config.Discovery.Interval`.
  - Expands each configured CIDR into host IPs via `snmpclient.IPsFromCIDR` (capped per subnet).
  - Uses a worker pool sized by `config.Discovery.WorkerCount` to call `snmpclient.ProbeDevice` for each host, using global SNMP defaults.
  - Writes `store.DiscoveryRecord` rows keyed by `defaultTenantID`, capturing reachability and optional sysName.
- Discovery records are read via the authenticated `/discovery` endpoint and do not automatically create devices; creation is handled by the registration APIs.

### HTTP API, auth, and multi-tenancy
- `internal/server.HTTPServer` is constructed with config and store plus:
  - `auth.Service` for JWT and cookie management.
  - `devicereg.Service` for device registration flows (using the shared `store` and `security.Encryptor`).
- Routing (simplified):
  - Public:
    - `/` basic status payload.
    - `/healthz`, `/health`, `/readyz` (readiness checks hit the DB via `store.Ping`).
    - `/auth/login`, `/auth/logout`, `/auth/me`, `/auth/register` (when `Auth.AllowRegister` is true).
  - Authenticated (via `authRequired` middleware):
    - Tenant endpoints: `/tenants`, `/tenants/active` (GET/POST) using `store.GetUserTenants` and `auth.Service` to encode active-tenant choice into the session token.
    - Device and interface endpoints: `/devices`, `/devices/:id`, `/devices/:id/interfaces`, `/devices/:id/macs`, plus mirrored `/api/devices` routes.
    - MAC queries: `/macs` with filters on MAC prefix, device ID, and VLAN.
    - Alerts: `/alerts` filtered by `device_id` and `active`.
    - Alert destinations: CRUD under `/alert-destinations`.
    - Discovery logs: `/discovery`.
    - Metrics: `/metrics` wrapping `promhttp.Handler()` when `config.Metrics.Enabled` is true.
- Tenant scoping:
  - `authRequired` loads the user from `store.GetUserByID`, resolves their tenants via `store.GetUserTenants`, and picks an active tenant either from the JWT claims or by falling back to the first tenant.
  - The active tenant object is stored on the Gin context and read through `getTenantID`; all data-accessing handlers pass this tenant ID into `store` methods to ensure isolation.

### Device registration and credential encryption
- The device registration endpoints (`/devices/test-snmp` and `/devices`) delegate to `devicereg.Service`:
  - `TestSNMP`:
    - Normalizes and validates the requested SNMP config (supports v2c and v3).
    - Calls `snmpclient.TestConnection` to verify reachability and credential correctness.
    - Persists a short-lived `DeviceTest` row per tenant/host/SNMP fingerprint and returns a summary plus a `test_token`.
  - `CreateDevice`:
    - Validates the request payload and ensures an `ENCRYPTION_KEY`-backed `security.Encryptor` is available.
    - Confirms uniqueness of the device per tenant/IP via `store.GetDeviceIDByIP`.
    - Verifies the test token/fingerprint via `store.ConsumeDeviceTest`.
    - Encrypts the normalized SNMP config into `devices.snmp_config_encrypted`.
    - Inserts a new `devices` row with status `pending`, then immediately transitions it to `active`.
- The periodic poller continues to use YAML-defined switches; registration APIs are the foundation for richer, per-tenant dynamic polling.

### Configuration and environment integration
- Configuration precedence:
  - Optional YAML file (default `config.yaml` in the repo root, or another path via `CONFIG_FILE`).
  - Hard-coded defaults in `config.applyDefaults`.
  - Environment overrides in `config.applyEnvOverrides`, including (non-exhaustive):
    - `POSTGRES_DSN`, `POSTGRES_MAX_CONNS`.
    - `POLL_INTERVAL`, `WORKER_COUNT`, `DISCOVERY_ENABLED`, `DISCOVERY_INTERVAL`.
    - `METRICS_ENABLED`, `METRICS_ADDR`.
    - `AUTH_JWT_SECRET`, `AUTH_COOKIE_NAME`, `AUTH_COOKIE_SECURE`, `AUTH_TOKEN_TTL_HOURS`, `AUTH_ALLOW_REGISTER`.
    - `ALERT_ERROR_RATE`, `ALERT_BANDWIDTH`, `DEMO_MODE`, `CORS_ALLOWED_ORIGINS`.
- `ENCRYPTION_KEY` must be a 32-byte key (raw or base64-encoded) to enable device SNMP credential encryption and registration; when it is missing, device registration will fail.
- Docker Compose (`compose.yaml`) wires these pieces together:
  - `snmp-poller` builds from the root `Dockerfile`, mounts `config.yaml` into the container, and sets `CONFIG_FILE=/config.yaml`, `AUTH_ALLOW_REGISTER=false`, a dev `AUTH_JWT_SECRET`, and `DEMO_MODE=true`.
  - `web` builds from `web/` and defaults `VITE_API_BASE_URL` to `http://localhost:8081`.
  - `postgres` exposes `5432` and is health-checked before `snmp-poller` starts.

### Frontend considerations
- The React/Vite app in `web/` is an independent Node project with its own ESLint and Vitest setup.
- It assumes:
  - API base URL via `VITE_API_BASE_URL`.
  - Browser-based auth using the HTTP-only session cookie set by `/auth/login` (same origin as the API base URL).
- When modifying API contracts or multi-tenant behavior, ensure both:
  - Backend handlers and `store` methods remain tenant-aware.
  - Frontend calls are updated to respect changed endpoints, query parameters, or response shapes, especially around devices, alerts, and discovery.
