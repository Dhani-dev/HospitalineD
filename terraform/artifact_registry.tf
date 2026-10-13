resource "google_artifact_registry_repository" "api" {
  repository_id = "${var.name}-repo"
  location      = var.region
  format        = "DOCKER"
  description   = "Imágenes de la API Hospitaline"
  labels        = var.labels

  depends_on = [google_project_service.required]
}

locals {
  image_repository = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.api.repository_id}/hospitaline-api"
}
