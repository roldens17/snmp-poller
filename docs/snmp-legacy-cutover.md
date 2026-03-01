# /snmp Legacy Bridge Cutover Plan

Goal: retire legacy UI routes safely after parity in new shell.

## Current bridge routes
- /snmp/clients
- /snmp/switches
- /snmp/topology
- /snmp/alerts
- /snmp/reports
- /snmp/settings
- /snmp/devices/new
- /snmp/devices/:id

## Target new-shell routes
- /devices (replaces clients/switches list usage)
- /topology
- /incidents
- /reports
- /settings
- /devices/new (to be added if needed)
- /devices/:id

## Cutover gates
- [x] New shell has invite management in settings
- [x] New shell has incidents actions (ack/assign/mute/comment)
- [x] New shell has topology page + drilldown
- [x] New shell has device detail page
- [x] Reports support SLA/incidents + CSV + print
- [ ] Device create route parity (/devices/new UX)
- [ ] 7-day monitoring confirms low /snmp route usage

## Rollout stages
1. Stage A (now): keep /snmp routes available via ?legacy=1 only.
2. Stage B: default redirect /snmp/* -> new routes.
3. Stage C: remove /snmp routes after 1 week without regressions.

## Rollback
- Re-enable /snmp routes by restoring legacy route table in `web/src/app/routes.ts`.
- Keep a tagged release before removal.

