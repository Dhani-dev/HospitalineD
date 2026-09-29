# Observabilidad Hospitaline (GCP)

Orden de la tarea: **primero métricas de la nube, después OpenTelemetry**.

En Grafana Cloud, de las dos tarjetas GCP, elige **GCP Metrics** (no GCP Logs). Hospitaline corre en GKE y Cloud SQL; esa integración trae CPU, memoria, disco y SQL al mismo stack del equipo. Los logs de la API ya salen por stdout con `trace_id` (Cloud Logging). OTel se activa en el paso 2.

El orquestador de Pokenetes **no está conectado**. `ORCHESTRATOR_API_URL` queda vacío.

Código (mismo esquema que biblio-express):

```text
src/observability/
├── telemetry.ts        # SDK OTLP (trazas, métricas, logs)
├── trace-context.ts    # x-trace-id + traceparent
└── request-logger.ts   # log OTel de /api/v2 + RED
```

## Paso 1 — GCP Metrics (la tarjeta de la imagen)

1. Grafana Cloud → Connections → **GCP Metrics**.
2. Crea una cuenta de servicio de solo lectura:

```bash
PROJECT=project-39d0c894-3885-4211-89d

gcloud iam service-accounts create grafana-gcp-metrics \
  --project="$PROJECT" \
  --display-name="Grafana Cloud GCP Metrics"

gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:grafana-gcp-metrics@${PROJECT}.iam.gserviceaccount.com" \
  --role="roles/monitoring.viewer"

gcloud iam service-accounts keys create grafana-gcp-metrics.json \
  --iam-account="grafana-gcp-metrics@${PROJECT}.iam.gserviceaccount.com"
```

3. En Grafana pega el JSON de la key (no lo subas a git).
4. Importa `observability/gcp-metrics-dashboard.json` y elige el datasource **Google Cloud Monitoring**.
5. Filtra cluster `hospitaline-gke` y namespace `hospitaline-prod`.

Plantilla IAM: `observability/gcp-metrics-sa.yaml.example`.

## Paso 2 — OpenTelemetry (después de las métricas GCP)

Connections → **OpenTelemetry** (no las tarjetas GCP). Copia:

```text
OTEL_SERVICE_NAME=hospitaline-api
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-....grafana.net/otlp
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic ...
```

Mismo stack que Pokenetes y biblio-express. En GKE usa `k8s/secrets/otel-secret.yaml.example`. Hay que reconstruir la imagen: el SDK está en el código.

Importa `observability/otel-dashboard.json` (Prometheus del stack). Trazas: Explore → Tempo → `hospitaline-api` → spans `peer.biblio-express` y `peer.pokenetes`.

## Headers

Cada request acepta, responde y propaga `x-trace-id` y `traceparent`. Así se correlacionan logs de GCP, métricas y trazas de las tres nubes.
