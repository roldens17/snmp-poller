# Current State (New Shell + Legacy Cutover)

## New shell primary routes
- `/` dashboard
- `/devices`
- `/devices/:id`
- `/incidents`
- `/topology`
- `/reports`
- `/settings`
- `/accept-invite`

## Legacy status
Legacy `/snmp/*` routes are in cutover mode and redirect to new shell paths.
See `docs/snmp-legacy-cutover.md`.

## Money-flow status
Implemented:
- SLA report API + incidents API
- CSV exports + print view
- report recipients management
- send-now (SMTP attempt) + delivery history
- SMTP connectivity check endpoint

## Stability baseline
Use `scripts/check.sh` before push/release.
