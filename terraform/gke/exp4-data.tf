variable "receipts_hardening" {
  description = "Mejoras de la ronda 1 del experimento 4. En la ronda 0 el bucket queda con la configuración por defecto."
  type        = bool
  default     = false
}

resource "google_storage_bucket" "flow_receipts" {
  name                        = "${var.project_id}-gd4-flow-receipts"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  # receipts_hardening permanece en false durante la ronda 0: sin retención ni versionado.
}

resource "google_storage_bucket_iam_member" "flow_receipts_workload" {
  bucket = google_storage_bucket.flow_receipts.name
  role   = "roles/storage.objectUser"
  member = "serviceAccount:${var.workload_service_account}"
}
