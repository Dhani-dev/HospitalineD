locals {
  db_secrets = {
    DB_NAME     = var.db_name
    DB_USER     = var.db_user
    DB_PASSWORD = random_password.db.result
  }
}

resource "google_secret_manager_secret" "db" {
  for_each = local.db_secrets

  secret_id = "${var.name}-${lower(replace(each.key, "_", "-"))}"
  labels    = var.labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_version" "db" {
  for_each = local.db_secrets

  secret      = google_secret_manager_secret.db[each.key].id
  secret_data = each.value
}

resource "google_secret_manager_secret_iam_member" "api" {
  for_each = local.db_secrets

  secret_id = google_secret_manager_secret.db[each.key].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.api.email}"
}
