resource "google_redis_instance" "cache" {
  name           = "${var.name}-redis"
  region         = var.region
  tier           = "BASIC"
  memory_size_gb = var.redis_memory_gb
  redis_version  = "REDIS_7_0"

  authorized_network = google_compute_network.main.id
  connect_mode       = "DIRECT_PEERING"
  labels             = var.labels

  depends_on = [google_project_service.required]
}
