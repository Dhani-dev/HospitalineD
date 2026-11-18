#!/usr/bin/env bash
# 10 min de tráfico normal del flujo. Exige que gd4-mass-object-destruction no dispare.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/security-chaos/detections/tests/case.sh"
gd_det_init "gd4-mass-object-destruction" "negative" \
  "$ROOT/security-chaos/evidence/exp4/ronda-1/alerts.json"
gd_det_negative "logName=\"projects/${GCP_PROJECT}/logs/cloudaudit.googleapis.com%2Fdata_access\" AND protoPayload.methodName=\"storage.objects.delete\" AND protoPayload.resourceName=~\"receipts/\""
