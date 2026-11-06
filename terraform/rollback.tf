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

data "archive_file" "rollback" {
  type        = "zip"
  source_dir  = "${path.module}/functions/canary-rollback"
  output_path = "${path.module}/.build/canary-rollback.zip"
}

resource "google_storage_bucket" "functions" {
  name                        = "${var.project_id}-${var.name}-functions"
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = true
  labels                      = var.labels
}

resource "google_storage_bucket_object" "rollback" {
  name   = "canary-rollback-${data.archive_file.rollback.output_md5}.zip"
  bucket = google_storage_bucket.functions.name
  source = data.archive_file.rollback.output_path
}

resource "google_cloudfunctions2_function" "rollback" {
  name     = local.rollback_function
  location = var.region
  labels   = var.labels

  build_config {
    runtime     = "nodejs22"
    entry_point = "rollback"
    source {
      storage_source {
        bucket = google_storage_bucket.functions.name
        object = google_storage_bucket_object.rollback.name
      }
    }
  }

  service_config {
    min_instance_count    = 0
    max_instance_count    = 1
    available_memory      = "256M"
    timeout_seconds       = 60
    service_account_email = google_service_account.rollback.email
    environment_variables = {
      PROJECT_ID = var.project_id
      REGION     = var.region
      SERVICE    = google_cloud_run_v2_service.api.name
    }
  }

  event_trigger {
    trigger_region        = var.region
    event_type            = "google.cloud.pubsub.topic.v1.messagePublished"
    pubsub_topic          = google_pubsub_topic.canary_alerts.id
    retry_policy          = "RETRY_POLICY_DO_NOT_RETRY"
    service_account_email = google_service_account.rollback.email
  }

  depends_on = [
    google_project_iam_member.rollback_trigger,
    google_cloud_run_v2_service_iam_member.rollback_developer,
    google_service_account_iam_member.rollback_act_as_api,
  ]
}
