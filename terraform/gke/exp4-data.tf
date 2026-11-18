variable "receipts_hardening" {
  description = "Mejoras de la ronda 1 del experimento 4. Reversible: false quita la retención y la auditoría de escritura."
  type        = bool
  default     = true
}

variable "transfer_agent" {
  description = "Agente de Storage Transfer de Phol. Solo lectura del bucket de comprobantes."
  type        = string
  default     = "serviceAccount:project-997240799960@storage-transfer-service.iam.gserviceaccount.com"
}

resource "google_storage_bucket" "flow_receipts" {
  name                        = "${var.project_id}-gd4-flow-receipts"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  # Sin versionado: en GCS no convive con la retención. is_locked queda en false.
  dynamic "retention_policy" {
    for_each = var.receipts_hardening ? [1] : []
    content {
      retention_period = 86400
    }
  }
}

resource "google_storage_bucket_iam_member" "flow_receipts_transfer_viewer" {
  count  = var.receipts_hardening ? 1 : 0
  bucket = google_storage_bucket.flow_receipts.name
  role   = "roles/storage.objectViewer"
  member = var.transfer_agent
}

resource "google_storage_bucket_iam_member" "flow_receipts_transfer_bucket_reader" {
  count  = var.receipts_hardening ? 1 : 0
  bucket = google_storage_bucket.flow_receipts.name
  role   = "roles/storage.legacyBucketReader"
  member = var.transfer_agent
}

resource "google_project_iam_audit_config" "storage_data_write" {
  count   = var.receipts_hardening ? 1 : 0
  project = var.project_id
  service = "storage.googleapis.com"

  audit_log_config {
    log_type = "DATA_WRITE"
  }
}

resource "google_storage_bucket_iam_member" "flow_receipts_workload" {
  bucket = google_storage_bucket.flow_receipts.name
  role   = "roles/storage.objectUser"
  member = "serviceAccount:${var.workload_service_account}"
}
