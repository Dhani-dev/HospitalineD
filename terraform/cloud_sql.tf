resource "random_password" "db" {
  length  = 24
  special = false
}

resource "google_sql_database_instance" "postgres" {
  name             = "${var.name}-db"
  region           = var.region
  database_version = "POSTGRES_16"

  # Permite `terraform destroy` al terminar la sustentación.
  deletion_protection = false

  settings {
    tier              = var.db_tier
    edition           = "ENTERPRISE"
    availability_type = "ZONAL"
    disk_type         = "PD_SSD"
    disk_size         = 10
    user_labels       = var.labels

    backup_configuration {
      enabled = false
    }

    ip_configuration {
      ipv4_enabled = true
      ssl_mode     = "ENCRYPTED_ONLY"
    }
  }

  depends_on = [google_project_service.required]
}

# ABANDON: el usuario es dueño de las tablas y Postgres no deja borrarlo;
# ambos desaparecen al eliminar la instancia.
resource "google_sql_database" "app" {
  name            = var.db_name
  instance        = google_sql_database_instance.postgres.name
  deletion_policy = "ABANDON"
}

resource "google_sql_user" "app" {
  name            = var.db_user
  instance        = google_sql_database_instance.postgres.name
  password        = random_password.db.result
  deletion_policy = "ABANDON"
}
