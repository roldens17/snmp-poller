# Deployment Guide

## Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/roldens17/snmp-poller.git
cd snmp-poller
```

### 2. Configure Environment Variables
```bash
cp .env.example .env
```

**IMPORTANT:** Edit `.env` and ensure these values match across ALL deployments:
- `AUTH_JWT_SECRET` - Must be identical on all machines
- `ENCRYPTION_KEY` - Must be identical on all machines

### 3. Start the Application
```bash
docker compose up -d --build
```

### 4. Access the Application
- **Frontend:** http://localhost:3000
- **API:** http://localhost:8081
- **Metrics:** http://localhost:9105/metrics

### 5. Default Login (Demo Mode)
- **Email:** `admin@example.com`
- **Password:** `admin`

## Admin Onboarding (Production)
By default `AUTH_ALLOW_REGISTER=false` and new users are NOT auto-enrolled in a tenant, so you need to create an admin and attach them to the default tenant.

Option A – Create via SQL (recommended)
1. Generate a bcrypt hash for the password (inside Postgres):
   ```bash
   docker compose exec postgres psql -U snmp -d snmp -c "SELECT crypt('ChangeMeStrong', gen_salt('bf', 12));"
   ```
2. Insert the user and membership (replace `<HASH>` with the value above):
   ```bash
   docker compose exec postgres psql -U snmp -d snmp <<'SQL'
   DO $$
   DECLARE uid uuid;
   BEGIN
     INSERT INTO users (email, password_hash, name, role)
     VALUES ('admin@example.com', '<HASH>', 'Admin User', 'owner')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name
     RETURNING id INTO uid;
     IF uid IS NULL THEN
       SELECT id INTO uid FROM users WHERE email = 'admin@example.com';
     END IF;
     INSERT INTO user_tenants (user_id, tenant_id, role)
     VALUES (uid, (SELECT id FROM tenants WHERE slug = 'default'), 'owner')
     ON CONFLICT DO NOTHING;
   END $$;
   SQL
   ```
3. Log in with that email/password.

Option B – Temporary self-registration
1. Set `AUTH_ALLOW_REGISTER=true` (env or `config.yaml`), add your site to `http.allowed_origins`, restart.
2. Register via the UI, then manually attach the user to a tenant:
   ```bash
   docker compose exec postgres psql -U snmp -d snmp \
     -c "INSERT INTO user_tenants (user_id, tenant_id, role) VALUES ('<USER_ID>', (SELECT id FROM tenants WHERE slug='default'), 'owner') ON CONFLICT DO NOTHING;"
   ```
3. Turn `AUTH_ALLOW_REGISTER` back to `false` and restart.

## Troubleshooting

### "Unable to verify session" Error
This happens when `AUTH_JWT_SECRET` or `ENCRYPTION_KEY` differ between machines.

**Fix:**
1. Copy `.env` from your working machine to the new machine
2. Rebuild: `docker compose up -d --build`

### Database Migration
If you need to reset the database:
```bash
docker compose down -v
docker compose up -d --build
```

## Production Deployment

1. **Disable Demo Mode:**
   ```bash
   DEMO_MODE=false
   ```

2. **Generate Secure Secrets:**
   ```bash
   # Generate JWT Secret
   openssl rand -base64 32
   
   # Generate Encryption Key
   openssl rand -base64 32
   ```

3. **Update `config.yaml`:**
   - Set `cookie_secure: true` if using HTTPS
   - Update `allowed_origins` to your domain
   - Set `allow_register: false` (unless you want user registration)

4. **Use Environment Variables:**
   ```bash
   export AUTH_JWT_SECRET="your-secure-secret"
   export ENCRYPTION_KEY="your-secure-key"
   docker compose up -d --build
   ```

## Phase 0 Hardening Checklist (SaaS baseline)

Before public deployment:

1. Disable insecure defaults
   - `DEMO_MODE=false`
   - `AUTH_ALLOW_REGISTER=false`
2. Rotate secrets
   - `AUTH_JWT_SECRET` (long random)
   - `ENCRYPTION_KEY` (32-byte base64)
   - `POSTGRES_PASSWORD` (strong)
3. Cookie security
   - `AUTH_COOKIE_SECURE=true` (HTTPS only)
   - `AUTH_COOKIE_HTTP_ONLY=true`
   - `AUTH_COOKIE_SAME_SITE=none` (when app/api on different subdomains)
   - `AUTH_COOKIE_DOMAIN=.yourdomain.com`
4. CORS lockdown
   - `CORS_ALLOWED_ORIGINS=https://app.yourdomain.com`
5. DB exposure
   - Do NOT publish Postgres port publicly.
6. TLS + proxy
   - Put app/api behind HTTPS reverse proxy.

Quick secret generation:
```bash
openssl rand -base64 48   # AUTH_JWT_SECRET
openssl rand -base64 32   # ENCRYPTION_KEY
openssl rand -base64 24   # POSTGRES_PASSWORD
```

## Phase 2.5–3.5 Controls Added

### New security/ops env vars
- `AUTH_LOGIN_RATE_PER_MIN` (default: `20`)
- `AUTH_LOGIN_BURST` (default: `10`)
- `AUTH_COOKIE_HTTP_ONLY`
- `AUTH_COOKIE_SAME_SITE`
- `AUTH_COOKIE_DOMAIN`

### New endpoints (authenticated)
- `GET /billing/plan`
- `PATCH /billing/plan` (plan/billing/devices limit)
- `GET /audit/events?limit=100`
- `GET /tenants/invites`
- `POST /tenants/invites`
- `DELETE /tenants/invites/:id`
- `POST /tenants/invites/accept`

### Device plan limit enforcement
`POST /api/devices` and `POST /devices` now return:
- `402 Payment Required` + `code=PLAN_LIMIT_DEVICES` when tenant reaches `max_devices`.

### Ops scripts
- Backup: `ops/backup/pg_backup.sh`
- Restore latest: `ops/backup/restore_latest.sh`
- Create owner + tenant: `ops/onboarding/create_owner.sh`
- Smoke checks: `ops/sre/smoke.sh`

### Production compose
- `compose.prod.yaml` + `.env.production.example`
- Nginx template: `ops/nginx/snmp-saas.conf.example`
