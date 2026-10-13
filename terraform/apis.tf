locals {
  services = toset([
    "artifactregistry.googleapis.com",
    "compute.googleapis.com",
    "iam.googleapis.com",
    "redis.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "sqladmin.googleapis.com",
    "vpcaccess.googleapis.com",
  ])
}

resource "google_project_service" "required" {
  for_each = local.services

  service            = each.value
  disable_on_destroy = false
}
