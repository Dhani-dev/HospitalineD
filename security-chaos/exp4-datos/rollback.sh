#!/usr/bin/env bash
# Deja el bucket con los comprobantes de la ronda y borra el interruptor remoto.
# Uso: security-chaos/exp4-datos/rollback.sh <ronda>
set -euo pipefail

ROUND="${1:?uso: rollback.sh <ronda>}"
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

export GD_EXP=exp4 GD_ROUND="$ROUND" GD_RUN="${GD_RUN:-1}" GD_DIR
export GD_ACTOR="${GD_ACTOR:-daniela}" GD_TRACE="${GD_TRACE:-rollback}"
export GD_EVIDENCE="security-chaos/evidence/exp4/ronda-${ROUND}"
BUCKET="${RECEIPTS_BUCKET:?RECEIPTS_BUCKET}"

gd_log rollback_start stop clear
gcloud storage rm "gs://${BUCKET}/_control/STOP" >/dev/null 2>&1 || true
LEFT="$(gcloud storage ls "gs://${BUCKET}/receipts/gd4-r${ROUND}-*" 2>/dev/null | awk 'NF{n++} END{print n+0}')"
gd_log rollback_done verify "objects=${LEFT}"
printf 'objects %s\n' "$LEFT"
