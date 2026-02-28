#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 3 ]; then
  echo "usage: $0 <email> <password> <tenant-slug> [tenant-name]"
  exit 1
fi

EMAIL="$1"
PASS="$2"
SLUG="$3"
NAME="${4:-$3}"

HASH=$(docker compose -f compose.yaml exec -T postgres psql -U "${POSTGRES_USER:-snmp}" -d "${POSTGRES_DB:-snmp}" -At -c "SELECT crypt('$PASS', gen_salt('bf', 12));" | tail -n1)

SQL="DO \$\$ DECLARE tid uuid; uid uuid; BEGIN
  INSERT INTO tenants(name, slug) VALUES ('$NAME', '$SLUG') ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO tid FROM tenants WHERE slug='$SLUG';
  INSERT INTO users(email, password_hash, name, role)
  VALUES ('$EMAIL', '$HASH', '$EMAIL', 'owner')
  ON CONFLICT (email) DO UPDATE SET password_hash=EXCLUDED.password_hash
  RETURNING id INTO uid;
  IF uid IS NULL THEN SELECT id INTO uid FROM users WHERE email='$EMAIL'; END IF;
  INSERT INTO user_tenants(user_id, tenant_id, role) VALUES (uid, tid, 'owner') ON CONFLICT DO NOTHING;
END \$\$;"

docker compose -f compose.yaml exec -T postgres psql -U "${POSTGRES_USER:-snmp}" -d "${POSTGRES_DB:-snmp}" -c "$SQL"
echo "owner_ready email=$EMAIL tenant_slug=$SLUG"
