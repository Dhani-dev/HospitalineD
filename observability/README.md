# Observabilidad Hospitaline — Integrante B (GCP)

Daniela **no es dueña de Grafana**. El compañero del orquestador conecta el tablero SAAS. Hospitaline **expone** métricas, logs con `trace_id` y OTLP para que él scrape/reciba.

La cola y Object Storage **no** son de esta nube. Caché Redis sí.

## Qué entregas al compañero de Grafana

Scrape Prometheus (métricas RED + caché + proceso):

```text
GET http://<EXTERNAL-IP>/metrics
```

Ejemplo cuando el LoadBalancer está arriba: `http://34.27.58.84/metrics`.

Headers de correlación en cada llamada:

```text
x-trace-id
traceparent
```

OTLP (opcional): cuando él te pase el endpoint del stack, se pega en el secreto `hospitaline-otel`. Hasta entonces el SDK no arranca y `/metrics` sigue funcionando.

## Métricas que expone `/metrics`

| Métrica | Rubrica |
|---|---|
| `hospitaline_http_requests_total{method,route,status,track,version}` | tasa de peticiones y errores `/api/v2+`, separada stable/canary |
| `hospitaline_http_request_duration_seconds{track,version}` | latencia p50/p95/p99 |
| `hospitaline_hospitals_registered_total{track,version,with_capacity}` | métrica de negocio (también en Cloud Logging como `hospital_registered`) |
| `hospitaline_cache_hits_total` / `hospitaline_cache_misses_total` | aciertos y fallos de caché |
| `hospitaline_process_*` / `hospitaline_nodejs_*` | proceso del Pod (CPU/memoria) |

PromQL de ejemplo para su dashboard:

```text
sum by (route) (rate(hospitaline_http_requests_total[5m]))
sum by (route) (rate(hospitaline_http_requests_total{status=~"5.."}[5m]))
histogram_quantile(0.50, sum by (le, route) (rate(hospitaline_http_request_duration_seconds_bucket[5m])))
histogram_quantile(0.95, sum by (le, route) (rate(hospitaline_http_request_duration_seconds_bucket[5m])))
sum(rate(hospitaline_cache_hits_total[5m]))
sum(rate(hospitaline_cache_misses_total[5m]))
```

Cola (`mensajes pendientes`): artefacto de otra nube; no se inventa aquí.

## Monitoreo nativo GCP (tu nube)

GKE ya manda CPU/memoria a **Cloud Monitoring**. Los logs JSON de `/api/v2` van a **Cloud Logging** con `trace_id` y `status_code`.

Alerta **Hospitaline API 5xx** ya está creada. En Cloud Monitoring → Alerting → Notification channels crea un email y asígnalo a esa política. Para la sustentación: provoca un 500 y espera el aviso.

## Alloy → Grafana Cloud (métricas nativas de GCP)

Identidad lista (sin clave JSON):

- Namespace `observability`
- KSA `alloy` → GSA `grafana-cloud-monitoring@project-39d0c894-3885-4211-89d.iam.gserviceaccount.com`
- Workload Identity vinculado

El asistente de Grafana Cloud (GKE Autopilot) sigue generando presets `daemonset` / `host-network` / `root`. **No uses ese comando.** Instala con los values de Autopilot; el token solo en la terminal:

```bash
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update
helm upgrade --install grafana-cloud grafana/k8s-monitoring \
  --namespace observability --create-namespace \
  --set cluster.name=hospitaline-gke \
  --set collectorCommon.alloy.remoteConfig.enabled=true \
  --set-string collectorCommon.alloy.remoteConfig.url=https://fleet-management-prod-028.grafana.net \
  --set-string collectorCommon.alloy.remoteConfig.auth.username=1840567 \
  --set-string collectorCommon.alloy.remoteConfig.auth.password="$GRAFANA_CLOUD_TOKEN" \
  -f k8s/observability/k8s-monitoring-values.yaml
```

## Código

```text
src/observability/
├── metrics.ts          # registro Prometheus (el servicio de métricas)
├── telemetry.ts        # OTLP cuando el compañero entregue el endpoint
├── trace-context.ts    # x-trace-id
└── request-logger.ts   # RED + log /api/v2
```
