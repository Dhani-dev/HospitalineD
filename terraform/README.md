# Hospitaline en GCP con Terraform

Infraestructura de la API Hospitaline en Google Cloud, sin Kubernetes.

| Servicio | Archivo | Uso |
|---|---|---|
| Cloud Run | `cloud_run.tf` | Corre la API (contenedor del `Dockerfile`), URL pública |
| Cloud SQL (PostgreSQL 16) | `cloud_sql.tf` | Base de datos `hospitaline` |
| Memorystore for Redis | `memorystore.tf` | Caché distribuida (TTL + invalidación) |
| Artifact Registry | `artifact_registry.tf` | Imágenes Docker de la API |
| Secret Manager | `secret_manager.tf` | `DB_NAME`, `DB_USER`, `DB_PASSWORD` |
| Cloud Monitoring | `monitoring.tf` | Tablero stable vs canary, alertas 5xx/p95, métrica de negocio |
| Pub/Sub + Cloud Functions | `rollback.tf` | Rollback automático del canary al dispararse una alerta |

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
read -r VERSION IMAGE < <(../scripts/canary/publish-image.sh v3.1.0)
./scripts/migrate.sh   # brew install cloud-sql-proxy libpq

# 3. Todo lo demás (stable al 100 %, sin canary)
terraform apply -var="stable_image=$IMAGE" -var="stable_version=$VERSION"
terraform output api_url
```

El bucket del estado es compartido con el pipeline, así que local y GitHub
Actions ven la misma infraestructura.

## Pipeline (`.github/workflows/terraform-gcp.yml`)

Usa el secreto de GitHub `GCP_SA_KEY` (JSON de la cuenta de despliegue).

Se ejecuta solo a mano en **Actions → Terraform GCP → Run workflow**. Ya no
corre con push a `main`, para que un merge no encienda Cloud SQL ni Memorystore.
Con `apply` hace:

1. Crea el bucket del estado si no existe y corre `terraform init`.
2. Crea Artifact Registry y Cloud SQL.
3. Publica la imagen de `stable_ref` (por defecto `v3.1.0`) con su SemVer y la
   pasa a Cloud Run por digest. Las etiquetas del registro son inmutables.
4. Corre `migrations/*.sql`: las tablas base si no existen y siempre el Expand
   idempotente de v4.
5. Crea Memorystore, el conector VPC, los secretos, Cloud Run (stable al 100 %),
   el tablero, las alertas y la función de rollback.
6. Comprueba que `/health` responda `X-App-Version: <versión>; track=stable`.

El canary se despliega con **Actions → Canary GCP (api/v4)**; las etapas, el
SLO y la demo están en el [README principal](../README.md#seguimiento-3--canary-deployments).

La primera ejecución tarda unos 15–20 min (Cloud SQL y Memorystore son lentos).

## Verificar en GCP

```bash
terraform output api_url
gcloud run services describe hospitaline-tf-api --region us-central1
terraform output traffic_split canary_url stable_url dashboard_url
gcloud sql instances list
gcloud redis instances list --region us-central1
gcloud artifacts docker images list \
  us-central1-docker.pkg.dev/project-39d0c894-3885-4211-89d/hospitaline-tf-repo
gcloud secrets list --filter="name~hospitaline-tf"
```

En la consola: **Cloud Run → hospitaline-tf-api** (URL, revisiones, pestaña
Logs), **SQL → hospitaline-tf-db → Cloud SQL Studio** (tablas),
**Memorystore → Redis**, **Artifact Registry** y **Secret Manager**.

## Obtener la URL de la API y probarla en Postman

Cloud Run asigna una URL pública del tipo
`https://hospitaline-tf-api-XXXXXXXXXX.us-central1.run.app`. Se obtiene de
cualquiera de estas formas:

- **GitHub Actions:** al terminar el job, el resumen muestra
  `API desplegada: https://...run.app`.
- **Consola de GCP:** Cloud Run → `hospitaline-tf-api`; la URL aparece arriba,
  junto al nombre del servicio.
- **gcloud:**

  ```bash
  gcloud run services describe hospitaline-tf-api --region us-central1 \
    --format='value(status.url)'
  ```

- **Terraform** (desde `terraform/`): `terraform output -raw api_url`.

En Postman, usa esa URL como base y agrega la ruta del endpoint
(ver la tabla de endpoints del README principal), por ejemplo:

| Método | URL | Body (raw JSON) |
|---|---|---|
| `GET` | `{URL}/health` | — |
| `POST` | `{URL}/api/v1/hospitals` | `{"name":"Hospital Central","address":"Calle 10","city":"Medellín","phone":"6041234567"}` |
| `GET` | `{URL}/api/v1/hospitals` | — |
| `GET` | `{URL}/api/v3/hospitals/last` | — |
| `POST` | `{URL}/api/v3/hospitals` | `{"name":"Hospital Central","address":"Calle 10","city":"Medellín","phone":"6041234567"}` |

`/health` devuelve `"backend": "redis"` y `"connected": true` cuando la API
está usando Memorystore.

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
