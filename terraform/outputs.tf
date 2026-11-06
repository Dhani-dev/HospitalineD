output "api_url" {
  description = "URL pública de la API para Postman."
  value       = google_cloud_run_v2_service.api.uri
}

output "service_name" {
  value = google_cloud_run_v2_service.api.name
}

output "stable_url" {
  description = "URL directa a la revisión stable (tag stable)."
  value       = try(one([for t in google_cloud_run_v2_service.api.traffic_statuses : t.uri if t.tag == "stable"]), "")
}

output "canary_url" {
  description = "URL directa a la revisión canary (etapa 0 y pruebas de humo)."
  value       = try(one([for t in google_cloud_run_v2_service.api.traffic_statuses : t.uri if t.tag == "canary"]), "")
}

output "traffic_split" {
  description = "Porcentaje público por track."
  value       = local.traffic_split
}

output "stable_image" {
  value = var.stable_image
}

output "stable_version" {
  value = var.stable_version
}

output "canary_image" {
  value = var.canary_image
}

output "canary_version" {
  value = var.canary_version
}

output "dashboard_url" {
  description = "Tablero stable vs canary en Cloud Monitoring."
  value       = "https://console.cloud.google.com/monitoring/dashboards/builder/${element(split("/", google_monitoring_dashboard.canary.id), 3)}?project=${var.project_id}"
}

output "image_repository" {
  description = "Repositorio de Artifact Registry donde el pipeline publica la imagen."
  value       = local.image_repository
}

output "db_connection_name" {
  description = "Conexión de Cloud SQL (proyecto:región:instancia)."
  value       = google_sql_database_instance.postgres.connection_name
}

output "db_name" {
  value = google_sql_database.app.name
}

output "db_user" {
  value = google_sql_user.app.name
}

output "db_password" {
  value     = random_password.db.result
  sensitive = true
}

output "redis_host" {
  description = "IP privada de Memorystore."
  value       = google_redis_instance.cache.host
}
