#!/usr/bin/env bash
# Sobrescribe la primera mitad y borra la segunda. Solo receipts/gd4-r<ronda>-*.
# Uso: security-chaos/exp4-datos/inject.sh <ronda> [corrida]
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
fi
# shellcheck disable=SC1091
source security-chaos/lib/gameday.sh

export GD_EXP=exp4 GD_ROUND="$ROUND" GD_RUN="$RUN" GD_DIR
export GD_ACTOR="${GD_ACTOR:-daniela}"
export GD_TRACE="$(gd_new_trace 4 "$ROUND" "$RUN")"
export GD_EVIDENCE="security-chaos/evidence/exp4/ronda-${ROUND}"
BUCKET="${RECEIPTS_BUCKET:?RECEIPTS_BUCKET}"
GSA="${WORKLOAD_GSA:?WORKLOAD_GSA}"
MAX_OBJECTS="${MAX_OBJECTS:-50}"
GCLOUD=(gcloud --impersonate-service-account="$GSA")

stop_or_exit() {
  gd_check_stop
  if "${GCLOUD[@]}" storage ls "gs://${BUCKET}/_control/STOP" >/dev/null 2>&1; then
    gd_log aborted stop_switch gcs
    exit 99
  fi
}

mapfile_objects() {
  "${GCLOUD[@]}" storage ls "gs://${BUCKET}/receipts/gd4-r${ROUND}-*" 2>/dev/null || true
}

OBJECTS="$(mapfile_objects | awk 'NF{print}' | sort | awk -v max="$MAX_OBJECTS" 'NR<=max')"
COUNT="$(printf '%s\n' "$OBJECTS" | awk 'NF{n++} END{print n+0}')"
HALF=$((COUNT / 2))
INDEX=0
BLOB="$(mktemp)"
dd if=/dev/urandom of="$BLOB" bs=512 count=1 status=none
trap 'rm -f "$BLOB"' EXIT

mkdir -p "$GD_EVIDENCE"
printf '%s\n' "$(gd_now)" >"$GD_EVIDENCE/t0.txt"
gd_log inject_start list "count=${COUNT}"
printf '%s\n' "$OBJECTS" >"$GD_EVIDENCE/targets.txt"
while IFS= read -r object; do
  [ -n "$object" ] || continue
  stop_or_exit
  INDEX=$((INDEX + 1))
  if [ "$INDEX" -le "$HALF" ]; then
    if "${GCLOUD[@]}" storage cp "$BLOB" "$object" >/dev/null 2>&1; then
      gd_log inject_start overwrite "open ${object}"
    else
      gd_log inject_start overwrite "denied ${object}"
    fi
  else
    if "${GCLOUD[@]}" storage rm "$object" >/dev/null 2>&1; then
      gd_log inject_start delete "open ${object}"
    else
      gd_log inject_start delete "denied ${object}"
    fi
  fi
done <"$GD_EVIDENCE/targets.txt"
gd_log inject_end inject done
printf '%s\n' "$GD_TRACE"
