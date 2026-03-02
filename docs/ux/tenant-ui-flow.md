# Tenant UI Flow & Information Architecture

## Goals
- Tenant context always obvious
- Switching tenants is frictionless and safe
- Membership/invites/billing easy to find
- Invite flow avoids token confusion

## Navigation / IA

### Global layout
- Left sidebar: primary product nav
- Top bar: tenant switcher + user menu
- Main content: tenant-scoped pages

### Tenant switcher (always visible)
- Location: top bar or sidebar header (not hidden in Settings)
- Shows current tenant name + status badge
- Dropdown lists user tenants (search if many)
- Switching tenant navigates to tenant dashboard

### URL rule
Tenant pages use explicit tenant route prefix:
- `/t/{tenantId}/dashboard`
- `/t/{tenantId}/devices`
- `/t/{tenantId}/settings/members`

## Tenant page map

Primary:
- Dashboard
- Devices
- Incidents
- Topology
- Webhooks
- Reports
- SNMP Console

Settings group:
- Members
- Billing
- Collectors
- Tenant
- Audit Log

## Members & invites UX

### Members page
Path: `/t/{tenantId}/settings/members`

Sections:
1. Members table
   - name/email
   - role badge
   - status
   - actions: change role, remove
2. Invites table
   - email, role, created/expires, status
   - actions: revoke, resend

Rules:
- Owner option shown only to owner actor
- Last-owner demote/remove blocked with clear inline reason

## Invite flow

Create invite (owner/admin):
- fields: email, role, optional message
- returns public link `/invite/{token}`

Acceptance page: `/invite/{token}`
- if unauthenticated: login/signup, then continue
- if authenticated: confirm “Join tenant X as ROLE”
- backend validates token; token is never auth token
- success redirect: `/t/{tenantId}/dashboard`

## Billing & limits UX
Path: `/t/{tenantId}/settings/billing` (owner only)

Show:
- plan
- limits/usage
- invoices
- payment method

Delete safety:
- if active subscription, delete disabled
- message: “Cancel subscription to delete tenant”

## Tenant lifecycle UX
Path: `/t/{tenantId}/settings/tenant` (owner only)

Controls:
- Rename tenant
- Archive tenant
- Delete tenant

Archive:
- confirm copy: archive => polling/write actions disabled
- show archived badge app-wide

Delete:
- recommend “archive first”
- confirm by typing tenant name
- billing active blocks delete unless superadmin override

Ownership transfer:
- owner-only action on members row
- confirm impact
- audit logged

## Incident UX alignment
Incidents should show:
- human summary title + message
- started, duration
- consecutive failures + last success
- collapsed technical details (raw/debug/request_id)
- timeline with: `POLL_FAILURE`, `ALERT_TRIGGERED`, `POLL_SUCCESS`, `ALERT_CLEARED`

## Status & badging
- Tenant status badge in top bar (`active`/`archived`)
- Optional role badge near username
- Role visible in members list

## Audit log UX
Path: `/t/{tenantId}/settings/audit`

Show:
- actor
- action
- target
- time
- metadata preview (expand)

## Non-goals (v1)
- Multi-org hierarchy beyond tenant
- Custom role builder
- Fine-grained per-device permissions
