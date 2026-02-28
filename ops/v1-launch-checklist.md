# V1 Launch Checklist — SNMP SaaS

Owner: Snedlor-dev  
Status legend: `[ ]` todo, `[~]` in progress, `[x]` done

## 0) Release Gate

- [ ] V1 release branch created (`release/v1`)
- [ ] All migrations tested on clean DB
- [ ] Rollback plan written and tested once
- [ ] Changelog prepared

---

## 1) Security & Access

- [ ] `DEMO_MODE=false` in production
- [ ] `AUTH_ALLOW_REGISTER=false` (invite-only)
- [ ] `AUTH_JWT_SECRET` rotated (strong random)
- [ ] `ENCRYPTION_KEY` rotated (32-byte base64)
- [ ] DB password rotated and vaulted
- [ ] HTTPS enforced end-to-end
- [ ] Cookie settings validated in prod:
  - [ ] `Secure=true`
  - [ ] `HttpOnly=true`
  - [ ] `SameSite` correct for app/api topology
  - [ ] cookie domain correct
- [ ] CORS allowlist restricted to app domain(s)
- [ ] Login rate-limit settings reviewed (`AUTH_LOGIN_RATE_PER_MIN`, `AUTH_LOGIN_BURST`)

### Verify commands
```bash
curl -I https://api.YOURDOMAIN/healthz
curl -s https://api.YOURDOMAIN/readyz
```

---

## 2) Core Product Behavior

- [ ] Polling works with real devices (sample per tenant)
- [ ] Deterministic down-alert logic verified:
  - [ ] 3 fails => DEVICE_DOWN active
  - [ ] additional fails do not spam alerts
  - [ ] 2 successes while DOWN => resolved
- [ ] Tenant isolation spot-check completed
- [ ] Alert delivery retries/backoff verified

### Verify commands
```bash
# active/resolved alert API
curl -s -b cookies.txt "https://api.YOURDOMAIN/api/alerts?status=active&limit=50"
curl -s -b cookies.txt "https://api.YOURDOMAIN/api/alerts?status=resolved&limit=50"

# tenant overview
curl -s -b cookies.txt "https://api.YOURDOMAIN/api/tenants/overview"
```

---

## 3) Onboarding & Tenant UX

- [ ] Invite create/list/delete tested in UI
- [ ] Invite self-registration (`/accept-invite?token=...`) tested end-to-end
- [ ] New user lands in correct tenant after invite accept
- [ ] First-login onboarding card appears and works
- [ ] Admin settings tabs and deep links validated (`/settings?tab=...`)

### Manual flow (must pass)
1. Admin creates invite for new email
2. Invitee opens link and sets password
3. Invitee auto-joins tenant
4. Invitee can login and see scoped data

---

## 4) Billing/Commercial (if launching paid immediately)

- [ ] Plan limits configured (`max_devices`)
- [ ] Device limit enforcement tested (`402 PLAN_LIMIT_DEVICES`)
- [ ] Pricing and plan terms finalized
- [ ] Trial policy and cancellation policy documented
- [ ] (If Stripe enabled) webhook signature + idempotency tested

---

## 5) Reliability & SRE

- [ ] Health/readiness monitored
- [ ] Alert delivery dashboard reviewed
- [ ] Backup job scheduled
- [ ] Restore test executed once (staging or prod-safe)
- [ ] Runbook exists for:
  - [ ] login failures
  - [ ] alert delivery failures
  - [ ] poller degradation

### Verify commands
```bash
cd /home/roldens/snmp-poller
./ops/sre/smoke.sh https://api.YOURDOMAIN admin@example.com YOUR_PASSWORD
./ops/backup/pg_backup.sh
```

---

## 6) Deployment & Ops Hygiene

- [ ] `compose.prod.yaml` reviewed and pinned
- [ ] TLS certs valid and auto-renew tested
- [ ] No public Postgres port exposure
- [ ] Resource limits/VM sizing reviewed
- [ ] Log retention configured

### Verify commands
```bash
docker compose -f compose.prod.yaml ps
ss -tulpn | grep 5432 || true
```

---

## 7) Final Go/No-Go

- [ ] Launch dry-run completed with checklist pass rate >= 95%
- [ ] Top 3 rollback triggers defined
- [ ] Support contact + SLA response policy published
- [ ] Launch announcement draft ready

## Sign-off

- Engineering: [ ]
- Product: [ ]
- Ops/SRE: [ ]
- Final GO: [ ]
