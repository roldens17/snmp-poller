# Auth Debug Playbook

Goal: quickly diagnose cookie/session login failures.

## 1) Verify login response sets cookie

```bash
curl -i -X POST https://app.example.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"yourpass"}'
```

Expected:
- `HTTP/1.1 200`
- `Set-Cookie: snmpai_session=...; Path=/; HttpOnly; SameSite=Lax`
- In prod also `Secure`

## 2) Verify browser stores cookie

Chrome/Edge:
- DevTools → Application → Storage → Cookies → `https://app.example.com`
- Cookie present: `snmpai_session`

If missing:
- Check `Secure` cookie on HTTP origin (will be dropped)
- Check invalid Domain attribute
- Check cookie blocked by browser policy

## 3) Verify cookie is sent on next request

In DevTools Network:
- Open `/api/auth/me`
- Request headers should include `Cookie: snmpai_session=...`

Expected response:
- `200` with user payload

## 4) Common failure modes

1. **Secure cookie on HTTP**
   - Symptom: login succeeds but cookie never stored.
   - Fix: in dev set `AUTH_COOKIE_SECURE=false`.

2. **Cross-origin mismatch**
   - Symptom: cookie not sent or CORS preflight issues.
   - Fix: prefer single-origin (`https://app.domain` + `/api`).

3. **Wrong cookie domain**
   - Symptom: cookie stored under different host.
   - Fix: leave `AUTH_COOKIE_DOMAIN` unset unless needed.

4. **JWT secret changed between deploys**
   - Symptom: existing sessions invalid after restart/deploy.
   - Fix: pin `AUTH_JWT_SECRET` and do not rotate casually.

5. **Proxy not forwarding proto**
   - Symptom: secure logic inconsistent behind TLS terminator.
   - Fix: ensure proxy sends `X-Forwarded-Proto https` and app trusts proxy.

## 5) Local dev checks

```bash
# API direct
curl -s http://localhost:8081/healthz

# UI dev server (via Vite proxy /api -> backend)
# open http://localhost:3000 and login in browser
```

## 6) Docker + proxy checks

```bash
# Start stack
cd /home/roldens/snmp-poller
docker compose -f compose.prod.yaml up -d --build

# Health through app origin route (adjust host)
curl -k -I https://app.example.com/api/healthz
```
