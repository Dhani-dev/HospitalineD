#!/usr/bin/env bash
# gd2-undeclared-workload ya está abierta desde la creación del pod de la R1.
# La evidencia es el incidente registrado en deteccion-d5.json. No se crea otro pod.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/security-chaos/detections/tests/case.sh"
gd_det_init "gd2-undeclared-workload" "positive" \
  "$ROOT/security-chaos/evidence/exp2/deteccion-d5.json"
gd_det_positive
echo "audit=$ROOT/security-chaos/evidence/exp2/ronda-1/audit-pod.json" >>"$LOG"
