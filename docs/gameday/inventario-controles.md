# Inventario de controles — filas de Daniela

Nube: GCP, proyecto `project-39d0c894-3885-4211-89d`, clúster GKE Autopilot `hospitaline-gke` (`us-central1`), namespace `hospitaline-prod`. Propietaria: Daniela. Consulta de D3FEND: 2026-11-17, fichas oficiales.

| Capa | Control | Señal que produce | D3FEND |
|---|---|---|---|
| Red | NetworkPolicy `hospitaline-api`, `hospitaline-redis` y `default-deny` | `gd2-netpol-deny`: log `policy-action` con `disposition=deny` y `src.namespace=hospitaline-prod` | Network Isolation (D3-NI), Inbound Traffic Filtering (D3-ITF), Outbound Traffic Filtering (D3-OTF) |
| Red | `NetworkLogging` `default` con `cluster.deny.log: true` | Logs `policy-action` del clúster | Network Traffic Analysis (D3-NTA) |
| Red | Alerta `gd2-undeclared-workload` | Audit `pods.create` en `hospitaline-prod` cuyo principal no empieza por `system:` | — |
| Datos | Retención de 86400 s, sin bloqueo, en `project-39d0c894-3885-4211-89d-gd4-flow-receipts` | Borrado y sobrescritura de `receipts/` responden 403 | — |
| Datos | Auditoría `storage.googleapis.com` solo `DATA_WRITE` y métrica `gd4-mass-object-destruction` | Alerta si hay 5 o más `storage.objects.delete` bajo `receipts/` en 60 s | File Integrity Monitoring (D3-FIM), como comparación posterior de hash |
| Datos | Copia aislada `biblio-express-final-2026-gd4-copia-aislada` (la opera Phol; Daniela lee y restaura) | Objetos `receipts/gd4-r1-*` presentes en la copia | Restore File (D3-RF) |
| Carga de trabajo | Sondas `liveness` y `readiness` de `hospitaline-api` en `GET /health:3000`; requests 250m/512Mi y limits 500m/1Gi | `/health` 200 | — |
| Carga de trabajo | `cloud-sql-proxy` con `runAsNonRoot: true`. La imagen de la API es el tag `v5.1.0`, no un digest, y ese contenedor no declara `runAsNonRoot` | No hay experimento de esta capa | — |
