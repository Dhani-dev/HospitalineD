locals {
  api_env = {
    NODE_ENV                    = "production"
    DB_HOST                     = "/cloudsql/${google_sql_database_instance.postgres.connection_name}"
    DB_PORT                     = "5432"
    REDIS_HOST                  = google_redis_instance.cache.host
    REDIS_PORT                  = tostring(google_redis_instance.cache.port)
    CACHE_TTL_SECONDS           = "60"
    PEER_CACHE_TTL_SECONDS      = "30"
    OTEL_SERVICE_NAME           = "hospitaline-api"
    OTEL_EXPORTER_OTLP_ENDPOINT = ""
    ORCHESTRATOR_API_URL        = ""
  }
}

resource "google_cloud_run_v2_service" "api" {
  name                = "${var.name}-api"
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false
  labels              = var.labels

  template {
    service_account = google_service_account.api.email

    scaling {
      min_instance_count = 0
      max_instance_count = 3
    }

    vpc_access {
      connector = google_vpc_access_connector.main.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [google_sql_database_instance.postgres.connection_name]
      }
    }

    containers {
      image = var.api_image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      dynamic "env" {
        for_each = local.api_env
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = google_secret_manager_secret.db
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value.secret_id
              version = "latest"
            }
          }
        }
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }
    }
  }

  depends_on = [
    google_project_iam_member.api_roles,
    google_secret_manager_secret_iam_member.api,
    google_secret_manager_secret_version.db,
  ]
}

# Acceso público para probar los endpoints desde Postman.
resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.api.name
  location = google_cloud_run_v2_service.api.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
