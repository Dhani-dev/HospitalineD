#!/usr/bin/env bash
# Publica la imagen de un ref de git etiquetada con su SemVer (package.json) e
# imprime "VERSION REPO@sha256:...". Las etiquetas son inmutables: si la versión
# ya existe se reutiliza, así que código nuevo exige subir la versión.
# Uso (desde terraform/): ../scripts/canary/publish-image.sh <git-ref>
set -euo pipefail

REF="${1:?git ref requerido (tag v3.1.0 o SHA)}"
REPO="$(terraform output -raw image_repository)"
VERSION="$(git -C .. show "$REF:package.json" | jq -r .version)"

if ! gcloud artifacts docker images describe "$REPO:$VERSION" >/dev/null 2>&1; then
  SRC="$(mktemp -d)"
  git -C .. worktree add --detach "$SRC" "$REF" >&2
  docker build --platform linux/amd64 \
    --label "org.opencontainers.image.revision=$(git -C .. rev-parse "$REF")" \
    -t "$REPO:$VERSION" "$SRC" >&2
  docker push "$REPO:$VERSION" >&2
  git -C .. worktree remove --force "$SRC" >&2
else
  echo "La imagen $REPO:$VERSION ya existe; se reutiliza por digest." >&2
fi

DIGEST="$(gcloud artifacts docker images describe "$REPO:$VERSION" --format='value(image_summary.digest)')"
echo "$VERSION $REPO@$DIGEST"
