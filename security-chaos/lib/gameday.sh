#!/usr/bin/env bash
# Funciones comunes del game day. Se carga con: source security-chaos/lib/gameday.sh
# Ejecutar los scripts desde la raíz del repo para que security-chaos/STOP resuelva.

gd_now() { date -u +%Y-%m-%dT%H:%M:%SZ; }

# Exp. 4 usa prefijo gd4- en sus propios scripts; esta función conserva la forma común.
gd_new_trace() {
  echo "gd-e$1-r$2-n$3-$(cat /proc/sys/kernel/random/uuid 2>/dev/null || uuidgen)"
}

gd_cloud_marker() {
  local line
  IFS= read -r line || return 0
  gcloud logging write gameday-markers "$line" --payload-type=json --severity=NOTICE
}

gd_log() {
  mkdir -p "$GD_EVIDENCE"
  printf '{"ts":"%s","gameday_id":"gd-2026-11-17","experiment":"%s","round":%s,"run":%s,"phase":"%s","trace_id":"%s","actor":"%s","action":"%s","result":"%s"}\n' \
    "$(gd_now)" "$GD_EXP" "$GD_ROUND" "$GD_RUN" "$1" "$GD_TRACE" "$GD_ACTOR" "$2" "$3" \
    | tee -a "$GD_EVIDENCE/bitacora.jsonl" | gd_cloud_marker
}

gd_canary_flow() {
  curl -s -o /dev/null -w '%{http_code}' -H "x-trace-id: $GD_TRACE" "$COORDINATOR_URL/api/v5/flujo"
}

gd_check_stop() {
  if [ -f security-chaos/STOP ] || [ "${GAMEDAY_STOP:-0}" = 1 ]; then
    gd_log aborted stop_switch triggered
    if [ -n "${GD_DIR:-}" ]; then
      (cd "$GD_DIR" && ./rollback.sh)
    else
      ./rollback.sh
    fi
    exit 99
  fi
}
