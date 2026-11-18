#!/usr/bin/env bash
# gd2-netpol-deny ya disparó en la R1. No se vuelve a inyectar el pod.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/security-chaos/detections/tests/case.sh"
gd_det_init "gd2-netpol-deny" "positive" \
  "$ROOT/security-chaos/evidence/exp2/ronda-1/alerts.json"
gd_det_positive
