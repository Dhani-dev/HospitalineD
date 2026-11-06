locals {
  run_selector    = "monitored_resource=\"cloud_run_revision\",service_name=\"${local.service_name}\""
  canary_selector = "${local.run_selector},revision_name=~\".*-canary-.*\""
  requests        = "run_googleapis_com:request_count"
  latency_buckets = "run_googleapis_com:request_latencies_bucket"

  # stable-3-1-0 → 3.1.0, canary-4-0-0 → 4.0.0, canary-4-0-1 → 4.0.1.
  as_version = "label_replace(%s, \"version\", \"$1.$2.$3\", \"revision_name\", \".*-([0-9]+)-([0-9]+)-([0-9]+)$\")"

  requests_by_version = format(
    local.as_version,
    "sum by (revision_name) (rate(${local.requests}{${local.run_selector}}[1m]))"
  )
  errors_5xx_by_version = format(
    local.as_version,
    "sum by (revision_name) (rate(${local.requests}{${local.run_selector},response_code_class=\"5xx\"}[1m]))"
  )
  errors_4xx_by_version = format(
    local.as_version,
    "sum by (revision_name) (rate(${local.requests}{${local.run_selector},response_code_class=\"4xx\"}[1m]))"
  )

  latency_by_version = {
    for q in ["50", "95", "99"] : "p${q}" =>
    "label_replace(histogram_quantile(0.${q}, sum by (le, version) (${format(local.as_version, "sum by (le, revision_name) (rate(${local.latency_buckets}{${local.run_selector}}[1m]))")})), \"quantile\", \"p${q}\", \"\", \"\")"
  }

  charts = [
    {
      title   = "Tráfico (req/s) por versión"
      queries = ["sum by (version) (${local.requests_by_version})"]
    },
    {
      title = "Tasa de errores 5xx por versión (abortar > 2%)"
      # Sin 5xx, request_count no tiene serie para esa clase y el cociente queda vacío.
      # `or … * 0` dibuja 0 en cada versión que sí tuvo tráfico.
      queries = ["sum by (version) (${local.errors_5xx_by_version}) / sum by (version) (${local.requests_by_version}) or sum by (version) (${local.requests_by_version}) * 0"]
    },
    {
      title   = "Tasa de errores 4xx por versión"
      queries = ["sum by (version) (${local.errors_4xx_by_version}) / sum by (version) (${local.requests_by_version}) or sum by (version) (${local.requests_by_version}) * 0"]
    },
    {
      title   = "Instancias activas por versión"
      queries = ["sum by (version) (${format(local.as_version, "sum by (revision_name) (run_googleapis_com:container_instance_count{${local.run_selector}})")})"]
    },
    {
      title   = "Latencia p50 / p95 / p99 (ms) por versión (abortar p95 > 2000)"
      queries = values(local.latency_by_version)
      width   = 48
    },
    {
      title   = "Saturación CPU p95 por versión"
      queries = ["histogram_quantile(0.95, sum by (le, version) (${format(local.as_version, "sum by (le, revision_name) (rate(run_googleapis_com:container_cpu_utilizations_bucket{${local.run_selector}}[1m]))")}))"]
    },
    {
      title   = "Saturación memoria p95 por versión"
      queries = ["histogram_quantile(0.95, sum by (le, version) (${format(local.as_version, "sum by (le, revision_name) (rate(run_googleapis_com:container_memory_utilizations_bucket{${local.run_selector}}[1m]))")}))"]
    },
    {
      title = "Negocio: hospitales registrados en 24 h por versión"
      # increase[1m] solo tiene un punto en el minuto del POST y el resto del rango sale vacío.
      queries = ["sum by (track, version) (label_replace(increase(logging_googleapis_com:user_${google_logging_metric.hospitals_registered.name}{${local.run_selector}}[24h]), \"version\", \"$1.$2.$3\", \"revision_name\", \".*-([0-9]+)-([0-9]+)-([0-9]+)$\"))"]
    },
  ]

  # La latencia (índice 4) ocupa la fila completa; las siguientes se corren un lugar.
  chart_tiles = [
    for i, chart in local.charts : {
      xPos   = try(chart.width, 24) == 48 ? 0 : ((i < 4 ? i : i + 1) % 2) * 24
      yPos   = 8 + floor((i < 4 ? i : i + 1) / 2) * 16
      width  = try(chart.width, 24)
      height = 16
      widget = {
        title = chart.title
        xyChart = {
          chartOptions = { mode = "COLOR" }
          dataSets = [
            for query in chart.queries : {
              timeSeriesQuery = { prometheusQuery = query }
              plotType        = "LINE"
              targetAxis      = "Y1"
            }
          ]
        }
      }
    }
  ]
}

resource "google_logging_metric" "hospitals_registered" {
  name        = "hospitaline_hospitals_registered"
  description = "Métrica de negocio: hospitales creados, por track y versión."
  filter      = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${local.service_name}\" AND jsonPayload.event=\"hospital_registered\""

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"

    labels {
      key        = "track"
      value_type = "STRING"
    }

    labels {
      key        = "version"
      value_type = "STRING"
    }
  }

  label_extractors = {
    track   = "EXTRACT(jsonPayload.track)"
    version = "EXTRACT(jsonPayload.version)"
  }

  depends_on = [google_project_service.required]
}

resource "google_monitoring_notification_channel" "email" {
  count        = var.alert_email == "" ? 0 : 1
  display_name = "Hospitaline canary (email)"
  type         = "email"
  labels       = { email_address = var.alert_email }
}

locals {
  alert_channels = concat(
    [google_monitoring_notification_channel.rollback.id],
    google_monitoring_notification_channel.email[*].id
  )
}

resource "google_monitoring_alert_policy" "canary_errors" {
  display_name = "Hospitaline canary: 5xx > 2% (rollback)"
  combiner     = "OR"

  conditions {
    display_name = "Tasa de 5xx del canary"
    condition_prometheus_query_language {
      query               = "sum(rate(${local.requests}{${local.canary_selector},response_code_class=\"5xx\"}[1m])) / sum(rate(${local.requests}{${local.canary_selector}}[1m])) > 0.02"
      duration            = "60s"
      evaluation_interval = "30s"
    }
  }

  alert_strategy {
    auto_close = "1800s"
  }

  notification_channels = local.alert_channels

  documentation {
    mime_type = "text/markdown"
    content   = "SLO de abortar violado (canary/slo.json). La función ${local.rollback_function} devuelve el canary a 0% y stable a 100%."
  }
}

resource "google_monitoring_alert_policy" "canary_latency" {
  display_name = "Hospitaline canary: p95 > 2 s (rollback)"
  combiner     = "OR"

  conditions {
    display_name = "Latencia p95 del canary"
    condition_prometheus_query_language {
      query               = "histogram_quantile(0.95, sum by (le) (rate(${local.latency_buckets}{${local.canary_selector}}[1m]))) > 2000"
      duration            = "60s"
      evaluation_interval = "30s"
    }
  }

  alert_strategy {
    auto_close = "1800s"
  }

  notification_channels = local.alert_channels

  documentation {
    mime_type = "text/markdown"
    content   = "SLO de abortar violado (canary/slo.json). La función ${local.rollback_function} devuelve el canary a 0% y stable a 100%."
  }
}

resource "google_monitoring_dashboard" "canary" {
  dashboard_json = jsonencode({
    displayName = "Hospitaline: stable (v3) vs canary (v4)"
    mosaicLayout = {
      columns = 48
      tiles = concat(
        [
          {
            xPos   = 0
            yPos   = 0
            width  = 48
            height = 8
            widget = {
              title = "Plan canary"
              text = {
                format  = "MARKDOWN"
                content = "Etapas 0% → 10% → 50% → 100%, observación de 2 min y mínimo 50 peticiones canary por etapa. Promover: 5xx ≤ 1% y p95 ≤ 800 ms (≤ 1.5× baseline). Abortar: 5xx > 2% o p95 > 2 s → canary 0%, stable 100%."
              }
            }
          }
        ],
        local.chart_tiles,
        [
          {
            xPos   = 24
            yPos   = 8 + 4 * 16
            width  = 12
            height = 16
            widget = {
              title      = "Alerta 5xx canary"
              alertChart = { name = google_monitoring_alert_policy.canary_errors.name }
            }
          },
          {
            xPos   = 36
            yPos   = 8 + 4 * 16
            width  = 12
            height = 16
            widget = {
              title      = "Alerta latencia canary"
              alertChart = { name = google_monitoring_alert_policy.canary_latency.name }
            }
          }
        ]
      )
    }
  })
}
