locals {
  run_selector    = "monitored_resource=\"cloud_run_revision\",service_name=\"${local.service_name}\""
  canary_selector = "${local.run_selector},revision_name=~\".*-canary-.*\""
  requests        = "run_googleapis_com:request_count"
  latency_buckets = "run_googleapis_com:request_latencies_bucket"
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
