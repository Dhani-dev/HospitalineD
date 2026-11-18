#!/usr/bin/env bash
# Compartido por positive.sh y negative.sh de cada regla.
# El positivo no inyecta: enlaza la evidencia de la corrida que ya disparó.
# El negativo corre 10 min de tráfico normal y exige cero disparos nuevos.
set -euo pipefail

gd_det_init() {
  RULE="$1"
  MODE="$2"
  EVIDENCE="$3"
  HERE="$(cd "$(dirname "${BASH_SOURCE[1]}")" && pwd)"
  ROOT="$(cd "$HERE/../../../.." && pwd)"
  LOG="$HERE/last-run.${MODE}.log"
  if [ -f "$ROOT/security-chaos/gameday.env" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/security-chaos/gameday.env"
    set +a
  fi
  : "${GCP_PROJECT:?define GCP_PROJECT en security-chaos/gameday.env}"
  : "${COORDINATOR_URL:?define COORDINATOR_URL en security-chaos/gameday.env}"
}

gd_det_incidents() {
  gcloud beta monitoring alerts list \
    --project="$GCP_PROJECT" \
    --format=json \
    | jq --arg rule "$RULE" '[.[] | select(.policy.displayName == $rule) | {name, state, openTime, closeTime}]'
}

gd_det_positive() {
  local matches live
  : >"$LOG"
  {
    echo "rule=$RULE"
    echo "mode=positive"
    echo "injection=none"
    echo "evidence=$EVIDENCE"
    echo "checked_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  } | tee -a "$LOG"
  matches="$(jq -r --arg rule "$RULE" '.. | strings | select(. == $rule)' "$EVIDENCE" | wc -l | tr -d ' ')"
  echo "evidence_mentions=$matches" | tee -a "$LOG"
  if [ "$matches" -lt 1 ]; then
    echo "result=FAIL evidence does not name the rule" | tee -a "$LOG"
    exit 1
  fi
  live="$(gd_det_incidents)"
  echo "incidents=$live" | tee -a "$LOG"
  if [ "$(printf '%s' "$live" | jq 'length')" -lt 1 ]; then
    echo "result=FAIL no monitoring incident for the rule" | tee -a "$LOG"
    exit 1
  fi
  echo "result=PASS linked evidence; alert already fired" | tee -a "$LOG"
}

gd_det_negative() {
  local filter="$1"
  local start end incidents opened logs
  start="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  : >"$LOG"
  {
    echo "rule=$RULE"
    echo "mode=negative"
    echo "window_start=$start"
    echo "traffic=security-chaos/lib/normal-traffic.sh 10"
  } | tee -a "$LOG"
  "$ROOT/security-chaos/lib/normal-traffic.sh" 10 | tee -a "$LOG"
  end="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "window_end=$end" | tee -a "$LOG"
  incidents="$(gd_det_incidents)"
  opened="$(printf '%s' "$incidents" | jq --arg start "$start" --arg end "$end" '[.[] | select(.openTime >= $start and .openTime <= $end)]')"
  echo "opened_in_window=$opened" | tee -a "$LOG"
  logs="$(gcloud logging read "$filter" \
    --project="$GCP_PROJECT" \
    --freshness=20m \
    --limit=100 \
    --format=json \
    | jq --arg start "$start" --arg end "$end" '[.[] | select(.timestamp >= $start and .timestamp <= $end)] | length')"
  echo "condition_logs=$logs" | tee -a "$LOG"
  if [ "$(printf '%s' "$opened" | jq 'length')" -ne 0 ] || [ "$logs" -ne 0 ]; then
    echo "result=FAIL" | tee -a "$LOG"
    exit 1
  fi
  echo "result=PASS alerts=0" | tee -a "$LOG"
}
