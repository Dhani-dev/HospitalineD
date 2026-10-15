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

variable "api_image" {
  description = "Imagen de la API. El pipeline la reemplaza por la publicada en Artifact Registry."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
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
