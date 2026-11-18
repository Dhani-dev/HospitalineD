#!/usr/bin/env bash
# Enciende Hospitaline v5 en GKE: Cloud SQL, IP fija, imagen, Expand y manifiestos.
# Uso (desde la raíz): ./scripts/gke/up.sh v5.0.0
set -euo pipefail

VERSION="${1:?usage: up.sh vX.Y.Z}"
PROJECT=project-39d0c894-3885-4211-89d
REGION=us-central1
NS=hospitaline-prod
IMAGE="$REGION-docker.pkg.dev/$PROJECT/hospitaline-repo/hospitaline-api:$VERSION"
DB_CONNECTION="$PROJECT:$REGION:hospitaline-db"

gcloud sql instances patch hospitaline-db --project "$PROJECT" \
  --activation-policy=ALWAYS --quiet

terraform -chdir=terraform/gke init -input=false \
  -backend-config="bucket=$PROJECT-hospitaline-tfstate" >/dev/null
terraform -chdir=terraform/gke apply -input=false -auto-approve

if ! gcloud artifacts docker images describe "$IMAGE" >/dev/null 2>&1; then
  gcloud builds submit --project "$PROJECT" --region "$REGION" --tag "$IMAGE" .
fi

gcloud container clusters get-credentials hospitaline-gke --region "$REGION" --project "$PROJECT"

secret() { kubectl get secret hospitaline-db -n "$NS" -o jsonpath="{.data.$1}" | base64 -d; }
export PGHOST=127.0.0.1 PGPORT=6544
PGDATABASE="$(secret DB_NAME)" PGUSER="$(secret DB_USER)" PGPASSWORD="$(secret DB_PASSWORD)"
export PGDATABASE PGUSER PGPASSWORD
cloud-sql-proxy --port "$PGPORT" "$DB_CONNECTION" >/dev/null 2>&1 &
PROXY_PID=$!
trap 'kill $PROXY_PID 2>/dev/null || true' EXIT
for _ in $(seq 1 30); do pg_isready -q && break; sleep 2; done
psql -v ON_ERROR_STOP=1 --single-transaction -f migrations/004_expand_hospital_bed_capacity.sql

kubectl apply -f k8s/secrets/secret-provider-class.yaml -f k8s/secrets/secret-sync.yaml
kubectl apply -f k8s/configmap.yaml -f k8s/redis.yaml -f k8s/deployment.yaml \
  -f k8s/service.yaml -f k8s/pdb.yaml -f k8s/hpa.yaml
kubectl apply -f k8s/network-policies/10-api.yaml -f k8s/network-policies/20-redis.yaml \
  -f k8s/network-policies/00-default-deny.yaml -f k8s/network-policies/network-logging.yaml
kubectl set image deployment/hospitaline-api hospitaline-api="$IMAGE" -n "$NS"
kubectl rollout status deployment/hospitaline-redis -n "$NS" --timeout=300s
kubectl rollout status deployment/hospitaline-api -n "$NS" --timeout=600s

URL="$(terraform -chdir=terraform/gke output -raw api_url)"
echo "API v5: $URL/api/v5/hospitals/last"
