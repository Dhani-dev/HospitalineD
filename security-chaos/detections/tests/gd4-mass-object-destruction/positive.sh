#!/usr/bin/env bash
# gd4-mass-object-destruction ya disparó en la R1. No se borran comprobantes otra vez.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/security-chaos/detections/tests/case.sh"
gd_det_init "gd4-mass-object-destruction" "positive" \
  "$ROOT/security-chaos/evidence/exp4/ronda-1/alerts.json"
gd_det_positive
