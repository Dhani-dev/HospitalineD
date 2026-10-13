# Hospitaline en GCP con Terraform

Infraestructura de la API Hospitaline en Google Cloud, sin Kubernetes.

| Servicio | Archivo | Uso |
|---|---|---|
| Cloud Run | `cloud_run.tf` | Corre la API (contenedor del `Dockerfile`), URL pública |
| Cloud SQL (PostgreSQL 16) | `cloud_sql.tf` | Base de datos `hospitaline` |
| Memorystore for Redis | `memorystore.tf` | Caché distribuida (TTL + invalidación) |
| Artifact Registry | `artifact_registry.tf` | Imágenes Docker de la API |
| Secret Manager | `secret_manager.tf` | `DB_NAME`, `DB_USER`, `DB_PASSWORD` |

Soporte: `apis.tf` (APIs de GCP), `network.tf` (VPC + conector Serverless VPC
Access para llegar a Redis), `iam.tf` (cuenta de servicio de Cloud Run),
`variables.tf`, `outputs.tf`, `providers.tf`, `versions.tf` y `backend.tf`
(estado remoto en un bucket GCS).

```text
Postman ──HTTPS──▶ Cloud Run ──socket /cloudsql──▶ Cloud SQL
                      │
                      └──conector VPC──▶ Memorystore (IP privada)
```

Los recursos usan el prefijo `hospitaline-tf` para no chocar con los creados
a mano en la entrega #2 (`hospitaline-db`, `hospitaline-repo`).

## Requisitos

- Terraform 1.6+ y `gcloud`.
- Proyecto GCP con facturación habilitada.
- Una cuenta de servicio de despliegue con rol **Owner** (o Editor + Project
  IAM Admin + Secret Manager Admin + Cloud SQL Client): Terraform crea
  permisos IAM y deja Cloud Run público.

## Despliegue local

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars   # ajustar project_id si cambia
gcloud auth application-default login

BUCKET="project-39d0c894-3885-4211-89d-hospitaline-tfstate"
gcloud storage buckets create "gs://$BUCKET" --location us-central1 \
  --uniform-bucket-level-access   # solo la primera vez

terraform init -backend-config="bucket=$BUCKET"
terraform plan
```

El despliegue completo se hace en tres pasos porque Cloud Run necesita una
imagen que exista y tablas creadas:

```bash
# 1. Registro y base de datos
terraform apply -target=google_artifact_registry_repository.api \
  -target=google_sql_database.app -target=google_sql_user.app

# 2. Imagen de la API
REPO="$(terraform output -raw image_repository)"
gcloud auth configure-docker us-central1-docker.pkg.dev
docker build --platform linux/amd64 -t "$REPO:v1" ..
docker push "$REPO:v1"
./scripts/migrate.sh   # brew install cloud-sql-proxy libpq

# 3. Todo lo demás
terraform apply -var="api_image=$REPO:v1"
terraform output api_url
```

El bucket del estado es compartido con el pipeline, así que local y GitHub
Actions ven la misma infraestructura.
