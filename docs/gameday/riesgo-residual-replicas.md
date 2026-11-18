# Riesgo residual — segunda réplica de hospitaline-api

Fecha: 2026-11-17.

El Deployment pide 2 réplicas. Una está Running y responde `http://34.121.168.216/health` con 200. La otra está Pending.

El nodo tiene 325m de CPU libres y 100 MiB de memoria libre. El pod nuevo pide 350m y 640 MiB. El pod `gke-system-balloon-pod` de `kube-system` reserva el resto. GKE no permite borrarlo y la cuota de CPU no deja crear otro nodo.

No bajé los requests. Con menos CPU el pod sigue sin memoria. Bajar la memoria hasta 100 MiB dejaría la API cerca de quedarse sin memoria. Los límites y la URL de DevOps siguen igual.

La ronda 0 del experimento 2 ya quedó restaurada. Este hueco es de disponibilidad, no del game day.
