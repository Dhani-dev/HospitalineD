# Quality gate automático: alerta de Cloud Monitoring -> Pub/Sub -> función
# que deja el canary en 0% y stable en 100%. No toca la base de datos.

locals {
  rollback_function = "${var.name}-canary-rollback"
}

data "google_project" "current" {}

resource "google_pubsub_topic" "canary_alerts" {
  name   = "${var.name}-canary-alerts"
  labels = var.labels

  depends_on = [google_project_service.required]
}

resource "google_monitoring_notification_channel" "rollback" {
  display_name = "Hospitaline canary rollback (Pub/Sub)"
  type         = "pubsub"
  labels       = { topic = google_pubsub_topic.canary_alerts.id }
}

# El agente de notificaciones de Monitoring existe tras crear el primer canal Pub/Sub.
resource "google_pubsub_topic_iam_member" "monitoring_publisher" {
  topic  = google_pubsub_topic.canary_alerts.name
  role   = "roles/pubsub.publisher"
  member = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-monitoring-notification.iam.gserviceaccount.com"

  depends_on = [google_monitoring_notification_channel.rollback]
}

resource "google_service_account" "rollback" {
  account_id   = "${var.name}-rollback"
  display_name = "Hospitaline canary rollback"

  depends_on = [google_project_service.required]
}

# Solo puede cambiar el tráfico de este servicio, no de otros.
resource "google_cloud_run_v2_service_iam_member" "rollback_developer" {
  name     = google_cloud_run_v2_service.api.name
  location = google_cloud_run_v2_service.api.location
  role     = "roles/run.developer"
  member   = "serviceAccount:${google_service_account.rollback.email}"
}

resource "google_service_account_iam_member" "rollback_act_as_api" {
  service_account_id = google_service_account.api.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.rollback.email}"
}

resource "google_project_iam_member" "rollback_trigger" {
  for_each = toset(["roles/eventarc.eventReceiver", "roles/run.invoker"])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.rollback.email}"
}
