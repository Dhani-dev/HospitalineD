variable "alert_email" {
  description = "Correo del canal de alertas del game day. Vacío: no se crean el canal ni las políticas."
  type        = string
  default     = "dagudelo0522@gmail.com"
}

data "google_project" "current" {
  project_id = var.project_id
}

resource "google_pubsub_topic" "gd_alerts" {
  name = "gd-alerts"
}

resource "google_pubsub_subscription" "gd_alerts_pull" {
  name  = "gd-alerts-pull"
  topic = google_pubsub_topic.gd_alerts.id
}

resource "google_pubsub_topic_iam_member" "monitoring_publisher" {
  topic  = google_pubsub_topic.gd_alerts.name
  role   = "roles/pubsub.publisher"
  member = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-monitoring-notification.iam.gserviceaccount.com"
}

resource "google_logging_metric" "gd4_mass_object_destruction" {
  name = "gd4-mass-object-destruction"
  filter = join(" AND ", [
    "logName=\"projects/${var.project_id}/logs/cloudaudit.googleapis.com%2Fdata_access\"",
    "protoPayload.methodName=\"storage.objects.delete\"",
    "protoPayload.resourceName=~\"receipts/\"",
  ])

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
  }
}

resource "google_monitoring_notification_channel" "gameday_email" {
  count        = var.alert_email == "" ? 0 : 1
  display_name = "game day"
  type         = "email"

  labels = {
    email_address = var.alert_email
  }
}

resource "google_monitoring_notification_channel" "gameday_pubsub" {
  count        = var.alert_email == "" ? 0 : 1
  display_name = "gd-alerts"
  type         = "pubsub"

  labels = {
    topic = google_pubsub_topic.gd_alerts.id
  }

  depends_on = [google_pubsub_topic_iam_member.monitoring_publisher]
}

resource "google_monitoring_alert_policy" "gd2_netpol_deny" {
  count        = var.alert_email == "" ? 0 : 1
  display_name = "gd2-netpol-deny"
  combiner     = "OR"

  conditions {
    display_name = "gd2-netpol-deny"
    condition_matched_log {
      filter = join(" AND ", [
        "logName=~\"logs/policy-action\"",
        "jsonPayload.disposition=\"deny\"",
        "jsonPayload.src.namespace=\"hospitaline-prod\"",
      ])
    }
  }

  notification_channels = [
    google_monitoring_notification_channel.gameday_email[0].id,
    google_monitoring_notification_channel.gameday_pubsub[0].id,
  ]

  alert_strategy {
    notification_rate_limit {
      period = "300s"
    }
  }
}

resource "google_monitoring_alert_policy" "gd2_undeclared_workload" {
  count        = var.alert_email == "" ? 0 : 1
  display_name = "gd2-undeclared-workload"
  combiner     = "OR"

  conditions {
    display_name = "gd2-undeclared-workload"
    condition_matched_log {
      filter = join(" AND ", [
        "resource.type=\"k8s_cluster\"",
        "protoPayload.methodName=\"io.k8s.core.v1.pods.create\"",
        "protoPayload.resourceName=~\"namespaces/hospitaline-prod/pods/\"",
        "NOT protoPayload.authenticationInfo.principalEmail=~\"^system:\"",
      ])
    }
  }

  notification_channels = [
    google_monitoring_notification_channel.gameday_email[0].id,
    google_monitoring_notification_channel.gameday_pubsub[0].id,
  ]

  alert_strategy {
    notification_rate_limit {
      period = "300s"
    }
  }
}

resource "google_monitoring_alert_policy" "gd4_mass_object_destruction" {
  count        = var.alert_email == "" ? 0 : 1
  display_name = "gd4-mass-object-destruction"
  combiner     = "OR"

  conditions {
    display_name = "cinco borrados de comprobantes en 60 s"
    condition_threshold {
      filter          = "resource.type=\"global\" AND metric.type=\"logging.googleapis.com/user/gd4-mass-object-destruction\""
      comparison      = "COMPARISON_GT"
      threshold_value = 4
      duration        = "0s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_SUM"
      }
    }
  }

  notification_channels = [
    google_monitoring_notification_channel.gameday_email[0].id,
    google_monitoring_notification_channel.gameday_pubsub[0].id,
  ]
}
