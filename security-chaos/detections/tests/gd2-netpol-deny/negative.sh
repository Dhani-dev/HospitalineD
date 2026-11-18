#!/usr/bin/env bash
# 10 min de tráfico normal del flujo. Exige que gd2-netpol-deny no dispare.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/security-chaos/detections/tests/case.sh"
gd_det_init "gd2-netpol-deny" "negative" \
  "$ROOT/security-chaos/evidence/exp2/ronda-1/alerts.json"
gd_det_negative 'logName=~"logs/policy-action" AND jsonPayload.disposition="deny" AND jsonPayload.src.namespace="hospitaline-prod"'
