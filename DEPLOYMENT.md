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
