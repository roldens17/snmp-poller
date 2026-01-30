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
