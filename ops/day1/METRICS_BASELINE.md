# Day 1 Metrics Baseline (UTC 2026-02-28)

## Baseline
- Git tag: `day1-baseline-20260228`
- Baseline SHA (tag creation time): `9119cc2`

## Stack status snapshot
- postgres: healthy
- snmp-poller: up (`:8081`, `:9105`)
- web: up (`:3000`)

## Health checks
- `GET /healthz` => `{"status":"ok"...}`
- `GET /readyz` => `{"status":"ok"}`

## Smoke results
- login: `200`
- `/auth/me`: `200`
- `/devices`: `200`
- `/billing/plan`: `200`
- `/tenants/invites`: `200`
- `/alerts/deliveries`: `200`
- `/audit/events`: `200`

## DB operational checks
- alerts total: `0`
- alert_deliveries grouped by success: `0 rows`
- top audit actions:
  - `auth.login`: 4
  - `invite.create`: 1

## SLO-lite targets for Week 1
- API health endpoint availability: >= 99.5%
- Auth login success for valid creds: >= 99%
- Alert delivery success after retries: >= 99% (once traffic exists)
- P95 latency for non-SNMP API endpoints: < 300ms

## Notes
- No alert traffic at capture time; delivery table is expected empty.
- Baseline intended for comparison after Day 2 billing primitives.
