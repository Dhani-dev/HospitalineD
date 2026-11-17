#!/usr/bin/env bash
# measure.sh --baseline|--watch|--final --round=N --manifest=archivo [--subset=archivo]
set -euo pipefail

MODE=""
ROUND=""
MANIFEST=""
SUBSET=""
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
if [ -f security-chaos/gameday.env ]; then
  set -a
  # shellcheck disable=SC1091
  source security-chaos/gameday.env
  set +a
fi

for arg in "$@"; do
  case "$arg" in
    --baseline|--watch|--final) MODE="${arg#--}" ;;
    --round=*) ROUND="${arg#--round=}" ;;
    --manifest=*) MANIFEST="${arg#--manifest=}" ;;
    --subset=*) SUBSET="${arg#--subset=}" ;;
    *) echo "argumento no reconocido: $arg" >&2; exit 2 ;;
  esac
done
[ -n "$MODE" ] && [ -n "$ROUND" ] || { echo "uso: --baseline|--watch|--final --round=N" >&2; exit 2; }

BUCKET="${RECEIPTS_BUCKET:?RECEIPTS_BUCKET}"
EVIDENCE="security-chaos/evidence/exp4/ronda-${ROUND}"
mkdir -p "$EVIDENCE"
LIST="$EVIDENCE/objects.json"

snapshot() {
  local tmp
  tmp="$(mktemp)"
  if gcloud storage objects list "gs://${BUCKET}/receipts/gd4-r${ROUND}-*" --format=json >"$tmp" && [ -s "$tmp" ]; then
    mv "$tmp" "$LIST"
  else
    rm -f "$tmp"
    printf '[]\n' >"$LIST"
  fi
}

case "$MODE" in
  baseline)
    [ -n "$MANIFEST" ] || { echo "baseline necesita --manifest" >&2; exit 2; }
    cp "$MANIFEST" "$EVIDENCE/manifest.json"
    snapshot
    cp "$LIST" "$EVIDENCE/baseline.json"
    printf 'baseline %s\n' "$EVIDENCE/baseline.json"
    ;;
  watch)
    T0="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    printf '%s\n' "$T0" >"$EVIDENCE/t0.txt"
    END=$((SECONDS + ${OBSERVATION_WINDOW_SECONDS:-2100}))
    while [ "$SECONDS" -lt "$END" ]; do
      snapshot
      jq -n --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --slurpfile now "$LIST" --slurpfile base "$EVIDENCE/baseline.json" '
        ($base[0] // []) as $b | ($now[0] // []) as $n |
        [$b[] | .name as $name | {name:$name,
          state:(if ($n|map(select(.name==$name))|length)==0 then "perdido"
                  elif ($n|map(select(.name==$name))[0].md5Hash)==.md5Hash then "intacto"
                  else "corrupto" end)}]
      ' >"$EVIDENCE/watch-latest.json"
      sleep "${POLL_SECONDS:-15}"
    done
    ;;
  final)
    T0="$(cat "$EVIDENCE/t0.txt")"
    snapshot
    jq -n --arg t0 "$T0" --arg experiment exp4 --argjson round "$ROUND" --slurpfile now "$LIST" --slurpfile base "$EVIDENCE/baseline.json" '
      ($base[0] // []) as $b | ($now[0] // []) as $n |
      def state($o):
        if ($n|map(select(.name==$o.name))|length)==0 then "perdido"
        elif ($n|map(select(.name==$o.name))[0].md5Hash)==$o.md5Hash then "intacto"
        else "corrupto" end;
      {
        experiment:$experiment, round:$round, run:1, t0:$t0,
        objects_total: ($b|length),
        objects_lost: ([$b[] | select(state(.)=="perdido")] | length),
        objects_restored: ([$b[] | select(state(.)=="intacto")] | length),
        rto_s: null, rto_partial_s: null, rpo_s: null,
        notes: "rto y rpo se completan con la hora en que el subconjunto y el total vuelven a coincidir"
      }
    ' >"$EVIDENCE/results.json"
    printf 'escrito %s\n' "$EVIDENCE/results.json"
    ;;
esac
