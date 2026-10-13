resource "google_service_account" "api" {
  account_id   = "${var.name}-api"
  display_name = "Hospitaline API (Cloud Run)"

  depends_on = [google_project_service.required]
}

resource "google_project_iam_member" "api_roles" {
  for_each = toset([
    "roles/cloudsql.client",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.api.email}"
}
