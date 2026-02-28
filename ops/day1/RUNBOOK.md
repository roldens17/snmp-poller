# Day 1 Mini Runbook

## 1) Login broken

### Symptoms
- UI shows unable to sign in
- `/auth/login` returns 401/500 unexpectedly

### Checks
```bash
cd /home/roldens/snmp-poller
curl -i -X POST http://localhost:8081/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"changeme"}'
docker compose -f compose.yaml logs --tail=100 snmp-poller
```

### Likely causes
- wrong cookie/CORS origin
- user/tenant linkage missing
- DB auth/user rows missing

### Fix path
1. Verify `AUTH_COOKIE_*` + `CORS_ALLOWED_ORIGINS` in `.env`
2. Ensure user exists and mapped to tenant (`user_tenants`)
3. Restart API container:
```bash
docker compose -f compose.yaml up -d --build snmp-poller
```

---

## 2) Alerts not delivering

### Symptoms
- alerts appear, but webhook endpoints not receiving
- delivery failures in UI

### Checks
```bash
curl -s -c /tmp/snmp.cookies -X POST http://localhost:8081/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"changeme"}' >/dev/null

curl -s -b /tmp/snmp.cookies 'http://localhost:8081/alerts/deliveries?limit=50'
docker compose -f compose.yaml logs --tail=120 snmp-poller
```

### Likely causes
- destination URL invalid/unreachable
- receiver returns non-2xx
- network egress/connectivity issue

### Fix path
1. Disable bad destination in Settings
2. Correct URL and re-enable
3. Re-test by triggering alert condition

---

## 3) Poller unhealthy / no fresh data

### Symptoms
- devices stale / `last_seen` old
- few/no fresh interface counters

### Checks
```bash
docker compose -f compose.yaml logs --tail=150 snmp-poller
curl -s http://localhost:8081/healthz
```

DB freshness:
```bash
docker compose -f compose.yaml exec -T postgres psql -U snmp -d snmp -c \
"SELECT hostname,last_seen,status FROM devices ORDER BY last_seen DESC NULLS LAST LIMIT 20;"
```

### Likely causes
- SNMP target unreachable/credentials mismatch
- poller encryption key mismatch
- poll interval/worker config mis-set

### Fix path
1. Validate SNMP credentials via test endpoint
2. Verify `ENCRYPTION_KEY` consistency
3. Restart stack:
```bash
docker compose -f compose.yaml up -d --build
```
