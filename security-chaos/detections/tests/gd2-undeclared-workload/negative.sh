#!/usr/bin/env bash
# 10 min de tráfico normal del flujo. Exige que gd2-undeclared-workload no dispare.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/security-chaos/detections/tests/case.sh"
gd_det_init "gd2-undeclared-workload" "negative" \
  "$ROOT/security-chaos/evidence/exp2/deteccion-d5.json"
gd_det_negative 'resource.type="k8s_cluster" AND protoPayload.methodName="io.k8s.core.v1.pods.create" AND protoPayload.resourceName=~"namespaces/hospitaline-prod/pods/" AND NOT protoPayload.authenticationInfo.principalEmail=~"^system:"'
