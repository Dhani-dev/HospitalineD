#!/usr/bin/env bash
# Tráfico normal del flujo: 1 petición cada 2 s durante <minutos>.
# Uso, desde la raíz del repo: security-chaos/lib/normal-traffic.sh 10
set -euo pipefail

MINUTES="${1:?uso: normal-traffic.sh <minutos>}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

if [ -f "$ROOT/security-chaos/gameday.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/security-chaos/gameday.env"
  set +a
fi

: "${COORDINATOR_URL:?define COORDINATOR_URL en security-chaos/gameday.env}"

END=$((SECONDS + MINUTES * 60))
while [ "$SECONDS" -lt "$END" ]; do
  TRACE="gd-normal-$(uuidgen | tr '[:upper:]' '[:lower:]')"
  CODE="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 \
    -H "x-trace-id: ${TRACE}" \
    "${COORDINATOR_URL}/api/v5/flujo" || printf '000')"
  printf '%s %s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$TRACE" "$CODE"
  sleep 2
done
