#!/usr/bin/env bash
# Mueve el canary por las etapas de canary/slo.json.
# Uso (desde terraform/, con TF_VAR_stable_* y TF_VAR_canary_* exportadas):
#   ../scripts/canary/rollout.sh rollout   # 0 -> 10 -> 50 -> 100 con horneado y gate
#   ../scripts/canary/rollout.sh 0|1|2|3   # una sola etapa
#   ../scripts/canary/rollout.sh rollback  # canary 0%, stable 100%
# Opcional: FAULT_MODE=none|errors|latency, BAKE_SECONDS, BAKE_RPS.
set -euo pipefail

SLO=../canary/slo.json
FAULT_MODE="${FAULT_MODE:-none}"
BAKE_RPS="${BAKE_RPS:-8}"

percent_of() { jq -r ".stages[] | select(.stage == $1) | .canaryPercent" "$SLO"; }
bake_of() { jq -r ".stages[] | select(.stage == $1) | .bakeSeconds" "$SLO"; }

apply_percent() {
  echo "::group::canary -> $1%"
  terraform apply -input=false -auto-approve -var="canary_percent=$1"
  echo "::endgroup::"
  echo "- canary al **$1%** ($(date -u +%H:%M:%SZ))" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
}

smoke_canary() {
  local url
  url="$(terraform output -raw canary_url)"
  for _ in $(seq 1 20); do curl -fsS -o /dev/null "$url/health"; done
  curl -fsS -D - -o /dev/null "$url/api/v4/hospitals/last" | grep -i "x-app-version: .*track=canary"
  echo "Etapa 0: humo OK en $url"
}

bake() {
  local stage="$1" code
  set +e
  node ../scripts/canary/bake.mjs \
    --url "$(terraform output -raw api_url)" \
    --seconds "${BAKE_SECONDS:-$(bake_of "$stage")}" \
    --rps "$BAKE_RPS" \
    --fault "$FAULT_MODE" \
    --out "bake-stage-$stage.json"
  code=$?
  set -e

  case "$code" in
    0) echo "Etapa $stage: dentro del SLO, se promueve." ;;
    2)
      echo "::warning::Etapa $stage en pausa: el canary se queda en $(percent_of "$stage")%."
      exit 2
      ;;
    *)
      echo "::error::Etapa $stage abortada: rollback inmediato a canary 0%."
      apply_percent 0
      exit 1
      ;;
  esac
}

case "${1:?etapa requerida}" in
  rollout)
    apply_percent 0
    smoke_canary
    for stage in 1 2; do
      apply_percent "$(percent_of "$stage")"
      bake "$stage"
    done
    apply_percent "$(percent_of 3)"
    ;;
  0)
    apply_percent 0
    smoke_canary
    ;;
  1 | 2)
    apply_percent "$(percent_of "$1")"
    bake "$1"
    ;;
  3) apply_percent "$(percent_of 3)" ;;
  rollback) apply_percent 0 ;;
  *)
    echo "Etapa desconocida: $1" >&2
    exit 64
    ;;
esac
