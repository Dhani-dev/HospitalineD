# Observabilidad en Grafana Cloud

Hospitaline exporta trazas y métricas por OTLP. El orquestador de Pokenetes **todavía no está conectado**: esta API solo deja el hueco (`ORCHESTRATOR_API_URL` vacío) y ya acepta `traceparent` + `x-trace-id` cuando él llame.

El clúster puede estar apagado. Esto se activa al desplegar con el endpoint OTLP pegado.

## 1. Endpoint de Grafana Tempo / métricas

En Grafana Cloud, abre el stack del equipo y entra a **OpenTelemetry** (o Connections → OpenTelemetry). Copia:

- OTLP endpoint (HTTP), algo como `https://otlp-gateway-prod-....grafana.net/otlp`
- El header `Authorization=Basic ...`

Pégalos en `.env.test` (local) o en GKE:

```text
OTEL_SERVICE_NAME=hospitaline-api
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-....grafana.net/otlp
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic ...
```

No subas ese archivo ni el header a git. En GKE usa `k8s/secrets/otel-secret.yaml.example`.

Tiene que ser **el mismo stack** que Pokenetes y biblio-express. Si cada nube apunta a Grafana distinto, la traza se parte.

## 2. Qué exporta el código

- Trazas: cada request HTTP (auto-instrumentación) más spans `peer.biblio-express` (Azure) y `peer.pokenetes` (AWS).
- Headers de correlación: `x-trace-id` (negocio) y `traceparent` (W3C / OpenTelemetry). Se aceptan, se responden y se mandan a las otras nubes.
- Métricas RED por ruta: `http.server.requests`, `http.server.errors`, `http.server.request.duration` (histograma en ms).
- Logs: cada request escribe una línea JSON con `trace_id` y `otel_trace_id` a stdout (GKE → Cloud Logging).

Cuando el orquestador se conecte, él abrirá el span `flujo.hospitaline` y Hospitaline colgará debajo si llega `traceparent`.

## 3. Dashboard

Dashboards → New → Import → sube `grafana/hospitaline-dashboard.json`.

Elige el datasource Prometheus del stack del equipo.

Para ver el recorrido: Explore → Tempo → servicio `hospitaline-api` → busca el `trace_id` o el span `peer.pokenetes` / `peer.biblio-express`.

## 4. Alerta (opcional)

Alerting → Alert rules → New alert rule.

- Query: `histogram_quantile(0.95, sum by (le, http_route) (rate(http_server_request_duration_milliseconds_bucket{service_name="hospitaline-api"}[5m])))`
- Condition: IS ABOVE 2000
- For: 5m
- Nombre: `Hospitaline latencia p95`
