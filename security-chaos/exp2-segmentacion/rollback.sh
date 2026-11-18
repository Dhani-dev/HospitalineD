#!/usr/bin/env bash
# Borra el pod intruso y las claves gd2:. Uso desde la raíz.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
GD_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [ -f security-chaos/gameday.env ]; then
  set -a
  # shellcheck disable=SC1091
  source security-chaos/gameday.env
  set +a
elif [ -f security-chaos/gameday.env.example ]; then
  set -a
  # shellcheck disable=SC1091
  source security-chaos/gameday.env.example
  set +a
fi
# shellcheck disable=SC1091
source security-chaos/lib/gameday.sh

export GD_EXP="${GD_EXP:-exp2}" GD_ROUND="${GD_ROUND:-0}" GD_RUN="${GD_RUN:-1}"
export GD_ACTOR="${GD_ACTOR:-daniela}" GD_TRACE="${GD_TRACE:-rollback}"
export GD_EVIDENCE="${GD_EVIDENCE:-security-chaos/evidence/exp2/ronda-${GD_ROUND}}"
export GD_DIR
NS="${NAMESPACE:-hospitaline-prod}"

gd_log rollback_start pod delete
kubectl delete pod gd-intruder -n "$NS" --grace-period=0 --force --wait=false --ignore-not-found

KEYS="$(kubectl exec -n "$NS" deploy/hospitaline-redis -- redis-cli --scan --pattern 'gd2:*' | tr '\n' ' ')"
if [ -n "${KEYS// /}" ]; then
  # shellcheck disable=SC2086
  kubectl exec -n "$NS" deploy/hospitaline-redis -- redis-cli DEL $KEYS
fi

LEFT="$(kubectl get pods -n "$NS" -l gameday=exp2 --no-headers 2>/dev/null | wc -l | tr -d ' ')"
FLOW="$(gd_canary_flow)"
if [ "$LEFT" = "0" ] && [ "$FLOW" = "200" ]; then
  gd_log rollback_done verify "pods=${LEFT} flow=${FLOW}"
else
  gd_log rollback_done verify "pods=${LEFT} flow=${FLOW}"
  exit 1
fi
