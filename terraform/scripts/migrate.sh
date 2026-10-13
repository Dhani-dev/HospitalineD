#!/usr/bin/env bash
# Corre migrations/*.sql en Cloud SQL a través de Cloud SQL Auth Proxy.
# Uso (desde terraform/): ./scripts/migrate.sh
set -euo pipefail

CONNECTION="$(terraform output -raw db_connection_name)"
export PGHOST=127.0.0.1 PGPORT=6543
export PGDATABASE="$(terraform output -raw db_name)"
export PGUSER="$(terraform output -raw db_user)"
export PGPASSWORD="$(terraform output -raw db_password)"

if ! command -v cloud-sql-proxy >/dev/null; then
  curl -fsSL -o /tmp/cloud-sql-proxy \
    https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.1/cloud-sql-proxy.linux.amd64
  chmod +x /tmp/cloud-sql-proxy
  PATH="/tmp:$PATH"
fi

cloud-sql-proxy --port "$PGPORT" "$CONNECTION" &
PROXY_PID=$!
trap 'kill $PROXY_PID' EXIT

for _ in $(seq 1 30); do
  pg_isready -q && break
  sleep 2
done

if [ "$(psql -tAc "select to_regclass('public.hospital') is not null")" = "t" ]; then
  echo "Las tablas ya existen; no hay migraciones pendientes."
  exit 0
fi

# Una sola transacción: si una migración falla, no queda nada a medias.
psql -v ON_ERROR_STOP=1 --single-transaction \
  -f ../migrations/001_create_hospital.sql \
  -f ../migrations/002_create_doctor.sql \
  -f ../migrations/003_create_paciente.sql
echo "Migraciones aplicadas."
