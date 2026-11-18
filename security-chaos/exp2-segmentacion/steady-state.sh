#!/usr/bin/env bash
# Estado estable de Exp. 2. Escribe security-chaos/evidence/exp2/estado-estable.json
# Uso, desde la raíz del repo: security-chaos/exp2-segmentacion/steady-state.sh
set -euo pipefail

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

OUT="security-chaos/evidence/exp2/estado-estable.json"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p security-chaos/evidence/exp2

capture() {
  local name="$1"
  shift
  if "$@" >"$TMP/$name.out" 2>"$TMP/$name.err"; then
    printf 'ok' >"$TMP/$name.status"
  else
    printf 'error' >"$TMP/$name.status"
    printf '[]' >"$TMP/$name.out"
  fi
}

capture networkpolicies kubectl get networkpolicy -A -o json
capture network_logging_crd kubectl get crd networkloggings.networking.gke.io -o name
capture alert_policies gcloud monitoring policies list --project="$GCP_PROJECT" --format=json
capture pods kubectl get pods -n "$NAMESPACE" -o json

FLOW_CODE="$(curl -sS -o "$TMP/flow.body" -w '%{http_code}' --max-time 20 \
  -H "x-trace-id: gd-steady-$(uuidgen | tr '[:upper:]' '[:lower:]')" \
  "$COORDINATOR_URL/api/v5/flujo" || printf '000')"
HEALTH_CODE="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 \
  "$HOSPITALINE_URL/health" || printf '000')"

jq -n \
  --arg captured_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg ns "$NAMESPACE" \
  --arg flow_code "$FLOW_CODE" \
  --arg health_code "$HEALTH_CODE" \
  --arg coordinator "$COORDINATOR_URL" \
  --arg hospitaline "$HOSPITALINE_URL" \
  --slurpfile netpol "$TMP/networkpolicies.out" \
  --rawfile netpol_err "$TMP/networkpolicies.err" \
  --rawfile netpol_status "$TMP/networkpolicies.status" \
  --rawfile crd "$TMP/network_logging_crd.out" \
  --rawfile crd_err "$TMP/network_logging_crd.err" \
  --rawfile crd_status "$TMP/network_logging_crd.status" \
  --slurpfile alerts "$TMP/alert_policies.out" \
  --rawfile alerts_err "$TMP/alert_policies.err" \
  --rawfile alerts_status "$TMP/alert_policies.status" \
  --slurpfile pods "$TMP/pods.out" \
  --rawfile pods_err "$TMP/pods.err" \
  --rawfile pods_status "$TMP/pods.status" \
  '{
    captured_at: $captured_at,
    namespace: $ns,
    network_policies: (if $netpol_status == "ok" then [$netpol[0].items[]? | {namespace: .metadata.namespace, name: .metadata.name}] else {status: "error", detail: $netpol_err} end),
    network_logging_crd_present: ($crd_status == "ok" and ($crd | length) > 0),
    network_logging_crd_detail: (if $crd_status == "ok" then ($crd | gsub("\n"; "")) else $crd_err end),
    alert_policies: (if $alerts_status == "ok" then [$alerts[0][]? | {name: .name, displayName: .displayName, enabled: .enabled}] else {status: "error", detail: $alerts_err} end),
    pods: (if $pods_status == "ok" then [$pods[0].items[]? | {name: .metadata.name, phase: .status.phase, labels: .metadata.labels}] else {status: "error", detail: $pods_err} end),
    flow: {url: ($coordinator + "/api/v5/flujo"), http_code: $flow_code},
    hospitaline_health: {url: ($hospitaline + "/health"), http_code: $health_code}
  }' >"$OUT"

printf 'escrito %s\n' "$OUT"
