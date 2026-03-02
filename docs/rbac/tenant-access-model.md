# Tenant Access Model (RBAC + Guardrails)

## Goals
- Clear, predictable authorization for multi-tenant SaaS
- Separate global platform authority from tenant-scoped authority
- Enforce guardrails (last owner, billing deletion rules, auditing)
- Keep RBAC simple now, extensible to permission mapping later

## Roles

### Global role (platform scope)
- `superadmin`: internal operations, cross-tenant visibility/switch, force overrides (explicit flags only)
- `user`: normal user; permissions only via tenant membership

### Tenant role (tenant scope)
- `owner`: full tenant control (billing + lifecycle + ownership transfer)
- `admin`: operational control (devices/incidents/webhooks/members), no billing/lifecycle
- `viewer`: read-only

## Data model requirements

### `users`
- `id`
- `email` (unique)
- `password_hash`
- `global_role` enum: `superadmin | user`
- timestamps

### `tenants`
- `id`
- `name`
- `slug`
- `status` enum: `active | archived | deleted`
- timestamps

### `tenant_memberships`
- `id`
- `tenant_id`
- `user_id`
- `role` enum: `owner | admin | viewer`
- `created_at`

Constraints:
- `UNIQUE(tenant_id, user_id)`
- At least one owner per tenant (service guardrail)

### `invites`
- `id`
- `tenant_id`
- `email`
- `role` enum: `owner | admin | viewer`
- `token_hash`
- `expires_at`
- `accepted_at` (nullable)
- `created_by_user_id`
- `created_at`

### `audit_logs`
- `id`
- `tenant_id` (nullable for platform-only actions)
- `actor_user_id`
- `action`
- `target_type`
- `target_id`
- `metadata_json`
- `created_at`

## Authorization evaluation
Each tenant request resolves in order:
1. Authenticate user
2. Resolve `tenant_id` from route
3. Resolve membership `(user, tenant)` unless superadmin platform route
4. Enforce role/permission
5. Enforce guardrails (if mutation)
6. Audit successful admin actions

### Tenant resolution rule
- Tenant-scoped backend endpoints MUST include explicit `tenant_id` in URL
- Do not rely on frontend “active tenant” for authorization

## Role matrix

### Tenant operations
| Action | Owner | Admin | Viewer |
|---|---:|---:|---:|
| View tenant | ✅ | ✅ | ✅ |
| Update tenant name/settings | ✅ | ✅ (non-billing) | ❌ |
| Archive tenant | ✅ | ❌ | ❌ |
| Delete tenant | ✅ (guardrails) | ❌ | ❌ |
| Transfer ownership | ✅ | ❌ | ❌ |

### Membership & invites
| Action | Owner | Admin | Viewer |
|---|---:|---:|---:|
| View members | ✅ | ✅ | ✅ |
| Invite member | ✅ | ✅ | ❌ |
| Revoke invite | ✅ | ✅ | ❌ |
| Change member role | ✅ | ✅ (cannot grant owner) | ❌ |
| Remove member | ✅ ⚠️ | ✅ ⚠️ | ❌ |

Restrictions:
- Admin cannot assign `owner`
- Last owner cannot be removed/demoted

### Monitoring resources
| Action | Owner | Admin | Viewer |
|---|---:|---:|---:|
| Devices CRUD | ✅ | ✅ | ❌ |
| Incidents Ack/Resolve/Mute/Assign | ✅ | ✅ | ❌ |
| Webhooks CRUD | ✅ | ✅ | ❌ |
| Reports view/export | ✅ | ✅ | ✅ |
| Collector tokens manage | ✅ | ✅ | ❌ |

### Billing
| Action | Owner | Admin | Viewer |
|---|---:|---:|---:|
| View plan/usage | ✅ | optional read-only | ❌ |
| Update billing | ✅ | ❌ | ❌ |

## Guardrails

### 1) Last-owner protection
Reject when action would leave tenant with zero owners:
- removing owner membership
- demoting owner to admin/viewer

### 2) Deletion + billing checks
If billing/subscription active:
- owner delete blocked
- only superadmin with explicit `force=true` may override

### 3) Archived tenants are operationally read-only
When `tenant.status == archived`:
- Block writes for: devices/webhooks/token writes/most incident mutations
- Allow reads + exports
- Billing view remains owner-only

### 4) Audit all admin actions
Must audit:
- invite create/revoke/accept
- role change
- member remove
- tenant archive/delete/restore
- token create/rotate/revoke
- billing changes
- ownership transfer

## Endpoint security baseline
- `POST /api/tenants` -> auth user; creator becomes owner
- `GET /api/tenants` -> list member tenants (superadmin: all)
- `GET /api/tenants/{tenant_id}` -> member required
- `PATCH /api/tenants/{tenant_id}` -> admin+
- `POST /api/tenants/{tenant_id}:archive` -> owner+
- `DELETE /api/tenants/{tenant_id}` -> owner+ with billing guardrails

Membership:
- `GET /api/tenants/{tenant_id}/members` -> member required
- `POST /api/tenants/{tenant_id}/invites` -> admin+
- `DELETE /api/tenants/{tenant_id}/invites/{invite_id}` -> admin+
- `PATCH /api/tenants/{tenant_id}/members/{user_id}` -> owner/admin (admin cannot assign owner)
- `DELETE /api/tenants/{tenant_id}/members/{user_id}` -> admin+ with last-owner guardrail

Monitoring:
- read endpoints: viewer+
- write endpoints: admin+

## Implementation pattern
Middleware order for tenant-scoped routes:
1. Auth
2. Tenant load
3. Membership load
4. Permission enforcement
5. Guardrail enforcement (mutations)
6. Audit on success

Use internal permission keys (recommended):
- `tenant.read`, `tenant.update`, `tenant.archive`, `tenant.delete`
- `members.read`, `members.invite`, `members.role.change`, `members.remove`
- `devices.write`, `incidents.write`, `webhooks.write`
- `reports.export`, `collectors.tokens.write`, `billing.manage`

## Non-goals (v1)
- Custom role builder
- Per-device ACLs
- Multi-org hierarchy beyond tenant
