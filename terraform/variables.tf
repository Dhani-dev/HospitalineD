variable "project_id" {
  description = "ID del proyecto GCP donde se despliega Hospitaline."
  type        = string
}

variable "region" {
  description = "Región de todos los recursos."
  type        = string
  default     = "us-central1"
}

variable "name" {
  description = "Prefijo de los recursos. Distinto a los creados a mano en la entrega #2."
  type        = string
  default     = "hospitaline-tf"
}

variable "stable_image" {
  description = "Imagen stable (api/v3) por digest: REPO@sha256:..."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "stable_version" {
  description = "SemVer de la imagen stable; nombra su revisión de Cloud Run."
  type        = string
  default     = "3.1.0"
}

variable "canary_image" {
  description = "Imagen canary (api/v4) por digest. Vacío = sin canary, 100% stable."
  type        = string
  default     = ""
}

variable "canary_version" {
  description = "SemVer de la imagen canary; nombra su revisión de Cloud Run."
  type        = string
  default     = "4.0.0"
}

variable "canary_percent" {
  description = "Tráfico público al canary. Etapas: 0, 10, 50, 100 (canary/slo.json)."
  type        = number
  default     = 0

  validation {
    condition     = contains([0, 10, 50, 100], var.canary_percent)
    error_message = "canary_percent debe ser una etapa del plan: 0, 10, 50 o 100."
  }
}

variable "alert_email" {
  description = "Correo opcional para las alertas del canary."
  type        = string
  default     = ""
}

variable "db_name" {
  description = "Nombre de la base de datos PostgreSQL."
  type        = string
  default     = "hospitaline"
}

variable "db_user" {
  description = "Usuario de la base de datos."
  type        = string
  default     = "hospitaline_app"
}

variable "db_tier" {
  description = "Tamaño de la instancia Cloud SQL."
  type        = string
  default     = "db-f1-micro"
}

variable "redis_memory_gb" {
  description = "Memoria de Memorystore for Redis en GB."
  type        = number
  default     = 1
}

variable "labels" {
  description = "Etiquetas comunes."
  type        = map(string)
  default = {
    app        = "hospitaline"
    managed-by = "terraform"
  }
}
