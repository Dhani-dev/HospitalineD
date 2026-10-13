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

## Pipeline (`.github/workflows/terraform-gcp.yml`)

Usa el secreto de GitHub `GCP_SA_KEY` (JSON de la cuenta de despliegue).

Se ejecuta solo con cada push a `main` que toque `terraform/`, `src/`,
`migrations/`, `Dockerfile` o `package*.json`, o a mano en **Actions →
Terraform GCP → Run workflow → apply**. Hace:

1. Crea el bucket del estado si no existe y corre `terraform init`.
2. Crea Artifact Registry y Cloud SQL.
3. Construye y publica la imagen con el SHA del commit.
4. Corre `migrations/*.sql` (solo si las tablas no existen).
5. Crea Memorystore, el conector VPC, los secretos y Cloud Run.
6. Llama a `/health` y deja la URL en el resumen del job.

La primera ejecución tarda unos 15–20 min (Cloud SQL y Memorystore son lentos).

## Verificar en GCP

```bash
terraform output api_url
gcloud run services describe hospitaline-tf-api --region us-central1
gcloud sql instances list
gcloud redis instances list --region us-central1
gcloud artifacts docker images list \
  us-central1-docker.pkg.dev/project-39d0c894-3885-4211-89d/hospitaline-tf-repo
gcloud secrets list --filter="name~hospitaline-tf"
```

En la consola: **Cloud Run → hospitaline-tf-api** (URL, revisiones, pestaña
Logs), **SQL → hospitaline-tf-db → Cloud SQL Studio** (tablas),
**Memorystore → Redis**, **Artifact Registry** y **Secret Manager**.

## Probar con Postman

Importa `postman/hospitaline-gcp.postman_collection.json` y cambia la variable
`baseUrl` por la URL de Cloud Run. Ejecuta en orden: health, crear hospital,
crear doctor y crear paciente; los ids quedan guardados para las demás
peticiones. `/health` muestra `"backend": "redis"` y `"connected": true` cuando
Memorystore responde.

## Eliminar la infraestructura

Al terminar la sustentación, en GitHub: **Actions → Terraform GCP → Run
workflow → destroy**. O en local:

```bash
cd terraform
terraform destroy
```

Se borra todo lo de este directorio, incluidos los datos. El bucket del estado
se conserva; para borrarlo también:
`gcloud storage rm -r gs://project-39d0c894-3885-4211-89d-hospitaline-tfstate`.
