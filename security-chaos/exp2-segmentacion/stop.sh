#!/usr/bin/env bash
# Crea el interruptor y revierte. Uso desde la raíz: security-chaos/exp2-segmentacion/stop.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
mkdir -p security-chaos
touch security-chaos/STOP
NS="${NAMESPACE:-hospitaline-prod}"
if [ -f security-chaos/gameday.env ]; then
  # shellcheck disable=SC1091
  NS="$(awk -F= '/^NAMESPACE=/{print $2}' security-chaos/gameday.env)"
fi
kubectl delete pod gd-intruder -n "$NS" --grace-period=0 --force --ignore-not-found --wait=false
exec "$ROOT/security-chaos/exp2-segmentacion/rollback.sh"
