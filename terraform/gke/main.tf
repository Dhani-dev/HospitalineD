# Piezas nuevas del Seguimiento #4 sobre el GKE de la entrega #2 (creado a mano):
# la IP fija de la API y el token del interruptor de caos.
terraform {
  required_version = ">= 1.6.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  backend "gcs" {
    prefix = "hospitaline/gke"
  }
}

variable "project_id" {
  type    = string
  default = "project-39d0c894-3885-4211-89d"
}

variable "region" {
  type    = string
  default = "us-central1"
}

variable "workload_service_account" {
  description = "Cuenta de GCP que usan los pods vía Workload Identity."
  type        = string
  default     = "hospitaline-gke@project-39d0c894-3885-4211-89d.iam.gserviceaccount.com"
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# k8s/service.yaml la referencia por nombre; la URL no cambia al recrear el Service.
resource "google_compute_address" "api" {
  name   = "hospitaline-gke-api-ip"
  region = var.region
}

resource "random_password" "chaos_token" {
  length  = 40
  special = false
}

resource "google_secret_manager_secret" "chaos_token" {
  secret_id = "hospitaline-chaos-token"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "chaos_token" {
  secret      = google_secret_manager_secret.chaos_token.id
  secret_data = random_password.chaos_token.result
}

resource "google_secret_manager_secret_iam_member" "chaos_token_reader" {
  secret_id = google_secret_manager_secret.chaos_token.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.workload_service_account}"
}

output "api_url" {
  value = "http://${google_compute_address.api.address}"
}

output "chaos_token" {
  value     = random_password.chaos_token.result
  sensitive = true
}
