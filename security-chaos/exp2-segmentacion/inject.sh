#!/usr/bin/env bash
# Uso, desde la raíz: security-chaos/exp2-segmentacion/inject.sh <ronda> [corrida]
set -euo pipefail

ROUND="${1:?uso: inject.sh <ronda> [corrida]}"
RUN="${2:-1}"
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

export GD_EXP=exp2 GD_ROUND="$ROUND" GD_RUN="$RUN"
export GD_ACTOR="${GD_ACTOR:-daniela}"
export GD_TRACE="$(gd_new_trace 2 "$ROUND" "$RUN")"
export GD_EVIDENCE="security-chaos/evidence/exp2/ronda-${ROUND}"
export GD_DIR
NS="${NAMESPACE:-hospitaline-prod}"
BIBLIO_HEALTH="${BIBLIO_URL:?BIBLIO_URL}/health"

probe() {
  local action="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    gd_log inject_start "$action" open
  else
    gd_log inject_start "$action" blocked
  fi
}

gd_check_stop
kubectl apply -f "$GD_DIR/intruder-pod.yaml"
kubectl wait --for=condition=Ready pod/gd-intruder -n "$NS" --timeout=180s
gd_log inject_start pod ready
gd_log inject_start canary_flow "$(gd_canary_flow)"

gd_check_stop
probe redis_ping kubectl exec -n "$NS" gd-intruder -- redis-cli -h redis -p 6379 PING

gd_check_stop
probe redis_set kubectl exec -n "$NS" gd-intruder -- \
  redis-cli -h redis -p 6379 SET "gd2:marker:${GD_TRACE}" 1 EX 600

gd_check_stop
probe egress_wget kubectl exec -n "$NS" gd-intruder -- \
  wget -q -T 5 -O- --header "x-trace-id: ${GD_TRACE}" "$BIBLIO_HEALTH"

gd_log inject_end inject done
printf '%s\n' "$GD_TRACE"
