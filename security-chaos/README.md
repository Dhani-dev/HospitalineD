# Caos de seguridad — HospitalineD

Daniela. Experimento 2: exposición y segmentación en GKE. La métrica objetivo es la cobertura de detección.

## Prerrequisitos

`bash`, `curl`, `jq`, `kubectl`, `gcloud` y `uuidgen`. No instales nada nuevo sin preguntar. El contexto de `kubectl` es el clúster `hospitaline-gke` y el proyecto `project-39d0c894-3885-4211-89d`.

## Variables

```bash
cp security-chaos/gameday.env.example security-chaos/gameday.env
```

`gameday.env` no se commitea. No pongas tokens ni llaves ahí ni en el chat.

## Comandos

Desde la raíz del repo:

```bash
security-chaos/exp2-segmentacion/steady-state.sh
```

Escribe `security-chaos/evidence/exp2/estado-estable.json`.

El interruptor de parada es el archivo `security-chaos/STOP` o la variable `GAMEDAY_STOP=1`.
