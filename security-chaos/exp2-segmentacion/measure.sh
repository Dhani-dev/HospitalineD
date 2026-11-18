#!/usr/bin/env bash
# t_contain = primer sondeo en que Redis y la salida están bloqueados y el pod ya no existe.
# Uso desde la raíz: security-chaos/exp2-segmentacion/measure.sh <ronda> [corrida]
set -euo pipefail

ROUND="${1:?uso: measure.sh <ronda> [corrida]}"
RUN="${2:-1}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
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

NS="${NAMESPACE:-hospitaline-prod}"
EVIDENCE="security-chaos/evidence/exp2/ronda-${ROUND}"
BIBLIO_HEALTH="${BIBLIO_URL:?BIBLIO_URL}/health"
WINDOW="${OBSERVATION_WINDOW_SECONDS:-900}"
EVERY="${POLL_SECONDS:-15}"
mkdir -p "$EVIDENCE"

redis_state=unknown
egress_state=unknown
t_contain=""
deadline=$((SECONDS + WINDOW))

while [ "$SECONDS" -lt "$deadline" ]; do
  if kubectl get pod gd-intruder -n "$NS" >/dev/null 2>&1; then
    pod_state=present
    if kubectl exec -n "$NS" gd-intruder -- redis-cli -h redis -p 6379 PING >/dev/null 2>&1; then
      redis_state=open
    else
      redis_state=blocked
    fi
    if kubectl exec -n "$NS" gd-intruder -- wget -q -T 5 -O- "$BIBLIO_HEALTH" >/dev/null 2>&1; then
      egress_state=open
    else
      egress_state=blocked
    fi
  else
    pod_state=absent
  fi
  if [ "$pod_state" = absent ] && [ "$redis_state" = blocked ] && [ "$egress_state" = blocked ]; then
    t_contain="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    break
  fi
  sleep "$EVERY"
done

T0="$(jq -sr '[.[] | select(.phase=="inject_start" and .action=="pod")][0].ts // ""' "$EVIDENCE/bitacora.jsonl" 2>/dev/null || true)"
TRACE="$(jq -sr '[.[] | select(.phase=="inject_start" and .action=="pod")][0].trace_id // ""' "$EVIDENCE/bitacora.jsonl" 2>/dev/null || true)"
jq -n \
  --arg experiment exp2 \
  --argjson round "$ROUND" \
  --argjson run "$RUN" \
  --arg trace_id "$TRACE" \
  --arg t0 "$T0" \
  --arg t_contain "$t_contain" \
  --arg redis_state "$redis_state" \
  --arg egress_state "$egress_state" \
  '{experiment:$experiment, round:$round, run:$run, trace_id:$trace_id, t0:$t0, t_detect:null, t_contain:(if $t_contain=="" then null else $t_contain end), t_rollback_done:null, mttd_s:null, mttc_s:null, techniques_emulated:["T1610","T1046","T1071.001"], techniques_detected:[], alerts_fired:[], false_positives:null, hypothesis_result:null, notes:("redis="+$redis_state+" egress="+$egress_state)}' \
  >"$EVIDENCE/results.json"
printf 'escrito %s\n' "$EVIDENCE/results.json"
