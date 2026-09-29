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
| `hospitaline_http_requests_total{method,route,status}` | tasa de peticiones y errores `/api/v2` |
| `hospitaline_http_request_duration_seconds` | latencia p50/p95 |
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

Alerta (aplicar una vez, canal de email en la consola):

```bash
gcloud monitoring policies create --policy-from-file=observability/gcp-alert-policy.json
```

En Cloud Monitoring → Alerting → Notification channels crea un email y asócialo a la política. Para la sustentación: provoca un 500 y espera el aviso.

## Código

```text
src/observability/
├── metrics.ts          # registro Prometheus (el servicio de métricas)
├── telemetry.ts        # OTLP cuando el compañero entregue el endpoint
├── trace-context.ts    # x-trace-id
└── request-logger.ts   # RED + log /api/v2
```
