#!/usr/bin/env bash
# Restaura primero el subconjunto y luego el resto.
# Uso: restore.sh --source=softdelete|copy --round=N [--subset=archivo] [--dest-prefix=prefijo]
set -euo pipefail

SOURCE=""
ROUND=""
SUBSET=""
DEST_PREFIX=""
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
    --source=*) SOURCE="${arg#--source=}" ;;
    --round=*) ROUND="${arg#--round=}" ;;
    --subset=*) SUBSET="${arg#--subset=}" ;;
    --dest-prefix=*) DEST_PREFIX="${arg#--dest-prefix=}" ;;
    *) echo "argumento no reconocido: $arg" >&2; exit 2 ;;
  esac
done
[ -n "$SOURCE" ] && [ -n "$ROUND" ] || { echo "uso: --source=softdelete|copy --round=N" >&2; exit 2; }

BUCKET="${RECEIPTS_BUCKET:?RECEIPTS_BUCKET}"
COPY_BUCKET="${COPY_BUCKET:-biblio-express-final-2026-gd4-copia-aislada}"
if [ -n "$SUBSET" ]; then
  LIST="$(awk 'NF{print}' "$SUBSET")"
else
  LIST="$(gcloud storage ls "gs://${BUCKET}/receipts/gd4-r${ROUND}-*" 2>/dev/null || true)"
fi

printf '%s\n' "$LIST" | while IFS= read -r object; do
  [ -n "$object" ] || continue
  name="${object##*/}"
  dest="gs://${BUCKET}/${DEST_PREFIX}${name}"
  case "$SOURCE" in
    softdelete)
      gcloud storage restore "$object" >/dev/null
      ;;
    copy)
      gcloud storage cp "gs://${COPY_BUCKET}/receipts/${name}" "$dest" >/dev/null
      ;;
    *) echo "source debe ser softdelete o copy" >&2; exit 2 ;;
  esac
  printf '%s %s\n' "$SOURCE" "$name"
done
