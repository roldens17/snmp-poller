# Tenant RBAC Migration Checklist

## Current -> Target route migration

### Backend routing
- [ ] Introduce tenant-scoped API namespace: `/api/tenants/{tenantId}/...`
- [ ] Keep legacy routes temporarily with compatibility adapter
- [ ] Add deprecation markers for legacy non-tenant-scoped routes

### Frontend routing
- [ ] Introduce tenant-prefixed app routes: `/t/:tenantId/*`
- [ ] Redirect old routes to active-tenant-prefixed routes
- [ ] Ensure switcher changes URL tenant segment

## Authorization middleware rollout
- [ ] Build middleware chain: auth -> tenant load -> membership -> permission -> guardrails
- [ ] Add permission map implementation and role mapping
- [ ] Add superadmin platform-scope middleware for `/api/platform/*`

## Guardrails implementation
- [ ] Last-owner protection in role change/remove APIs
- [ ] Archive read-only enforcement for writes
- [ ] Billing-aware delete constraints (+ superadmin force)

## Endpoint hardening
- [ ] Tenant lifecycle endpoints (`create/get/update/archive/delete`)
- [ ] Membership endpoints (`list/update role/remove`)
- [ ] Invites endpoints (`create/list/revoke/accept`)
- [ ] Monitoring writes blocked for viewer and archived tenant

## Audit completeness
- [ ] Audit invite create/revoke/accept
- [ ] Audit role changes and member removals
- [ ] Audit tenant lifecycle actions
- [ ] Audit billing and token operations

## UI rollout phases

### Phase 1: Context + routing
- [ ] Top-bar tenant switcher (always visible)
- [ ] Route prefix `/t/:tenantId/*`
- [ ] Tenant badge (`active/archived`)

### Phase 2: Members/Invites
- [ ] Members table with role actions
- [ ] Invites table with revoke/resend/status
- [ ] Last-owner guardrail UX

### Phase 3: Lifecycle + billing
- [ ] Tenant settings page (rename/archive/delete)
- [ ] Billing page constraints + delete blocking message
- [ ] Ownership transfer flow

### Phase 4: Audit + polish
- [ ] Audit log page with metadata expansion
- [ ] Role badge and status consistency
- [ ] Copy/empty states cleanup

## Test checklist

### Authorization
- [ ] Viewer cannot mutate resources
- [ ] Admin cannot grant owner
- [ ] Owner can perform tenant lifecycle (except billing guardrail blocks)
- [ ] Superadmin cross-tenant list/switch works

### Guardrails
- [ ] Cannot demote/remove last owner
- [ ] Archived tenant blocks write actions
- [ ] Active billing blocks tenant delete (non-superadmin)

### UX
- [ ] Tenant switch updates URL + data context
- [ ] Invite flow works unauthenticated and authenticated
- [ ] Incident timeline + technical details render correctly
