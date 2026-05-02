# Sprint 23 · Worker GPU TRIBE real

Fecha: 2026-05-02

## Decision

Proveedor recomendado inicial para beta rapida: RunPod Serverless GPU.

Proveedor Google-first para beta enterprise: Google Cloud Run GPU + Cloud Tasks.

GPU inicial:

- T4/L4 para pruebas cortas y assets de pocos minutos.
- A10G/L40S si TRIBE necesita mas VRAM, si sube la duracion o si aparecen timeouts.

RunPod encaja porque su endpoint `/run` crea trabajos asincronos y devuelve un job id, y `/status/{job_id}` permite revisar el estado. Esto evita bloquear la API principal durante inferencias largas.

Google Cloud encaja si queremos concentrar backend, storage, cola, secretos, logs y GPU dentro de un unico proveedor mas facil de defender ante IT/procurement corporativo.

## Implementado

### Worker GPU

- Docker CUDA final en `worker/tribe/Dockerfile`.
- Handler serverless en `worker/tribe/tribe_worker/handler.py`.
- Servicio HTTP para Cloud Run en `worker/tribe/tribe_worker/http_server.py`.
- Entrypoint dual RunPod/Cloud Run en `worker/tribe/tribe_worker/entrypoint.py`.
- CLI local preservado en `worker/tribe/tribe_worker/cli.py`.
- Import real corregido a `from tribev2.demo_utils import TribeModel`, como en el notebook de Colab.
- Descarga derivados desde S3/R2/MinIO.
- Convierte transcripts JSON/SRT a texto plano temporal antes de pasarlo a TRIBE.
- Ejecuta TRIBE real o mock contractual.
- Sube:
  - `bold_predictions.npz`
  - `segments.parquet`
  - `run_metrics.json`
- Envía callback al backend con `X-TRIBE-CALLBACK-SECRET`.

### Backend

- `TRIBE_WORKER_MODE=remote_gpu` activa GPU remoto.
- `TRIBE_WORKER_MODE=mock` mantiene demo local.
- Cliente RunPod en `backend/app/services/runpod_client.py`.
- Cliente Google Cloud Tasks en `backend/app/services/google_cloud_tasks_client.py`.
- Router de proveedor GPU en `backend/app/services/gpu_worker_client.py`.
- `analysis_runs` registra:
  - `compute_provider`
  - `provider_job_id`
  - timeout
  - intentos
  - callback recibido
  - estado proveedor
- Callback privado en `/v1/internal/tribe/callback`.
- Persistencia de artefactos en `prediction_artifacts`.
- Registro de objetos en `storage_objects`.
- Registro de coste en `usage_events`.
- Cap mensual por GPU seconds y coste estimado antes de lanzar jobs.
- Reintentos al encolar el job segun `TRIBE_RUN_MAX_RETRIES`.
- Timeout operativo transportado al payload del worker con `TRIBE_RUN_TIMEOUT_SECONDS`.

### Frontend

- El panel de upload lanza runs remotos.
- Si el backend devuelve `queued` o `running`, el frontend hace polling hasta `done`, `failed` o timeout de UI.
- El timeout de UI cubre runs largos de beta, pero el estado definitivo lo marca el callback del worker.
- El panel muestra proveedor, GPU seconds, VRAM, duracion, shape y artefactos.

## Variables

```env
GPU_PROVIDER=runpod_serverless
RUNPOD_API_KEY=
HF_TOKEN=
TRIBE_WORKER_MODE=remote_gpu
TRIBE_WORKER_ENDPOINT_URL=https://api.runpod.ai/v2/<endpoint-id>
TRIBE_WORKER_IMAGE=praevia/tribe-worker:production
TRIBE_MODEL_ID=facebook/tribev2
TRIBE_OUTPUT_BUCKET=praevia-neuroimpact-production
TRIBE_OUTPUT_PREFIX=predictions
TRIBE_EXPECTED_VERTICES=20484
TRIBE_RUN_TIMEOUT_SECONDS=900
TRIBE_RUN_MAX_RETRIES=2
TRIBE_CALLBACK_URL=https://api.neuroimpact.example.com/v1/internal/tribe/callback
TRIBE_CALLBACK_SECRET=
```

Google Cloud Run GPU:

```env
GPU_PROVIDER=google_cloud_run_gpu
GCP_PROJECT_ID=
GCP_REGION=europe-west1
GCP_TASKS_QUEUE=tribe-runs
GCP_TASKS_LOCATION=europe-west1
GCP_TASKS_SERVICE_ACCOUNT=
HF_TOKEN=
TRIBE_WORKER_MODE=remote_gpu
TRIBE_WORKER_RUNTIME=http
TRIBE_WORKER_ENDPOINT_URL=https://praevia-tribe-worker-xxx.a.run.app
TRIBE_WORKER_IMAGE=europe-west1-docker.pkg.dev/<project>/praevia/tribe-worker:production
TRIBE_CALLBACK_URL=https://api.neuroimpact.example.com/v1/internal/tribe/callback
TRIBE_CALLBACK_SECRET=
TRIBE_WORKER_BEARER_TOKEN=
```

## Criterio de aceptacion

Para cerrar el gate real, necesitamos las claves y el endpoint:

1. Subir tres assets reales: video, audio y texto.
2. Preprocesarlos con Sprint 22.
3. Lanzar TRIBE remoto sobre los tres.
4. Ver `analysis_runs.status=done`.
5. Ver `bold_predictions.npz` con shape `(n_timesteps, 20484)`.
6. Ver `segments.parquet` y `run_metrics.json`.
7. Ver `usage_events.event_type=tribe_run` con GPU seconds y coste estimado.

## Pendiente externo

- API key de RunPod.
- O proyecto Google Cloud con Cloud Tasks/Cloud Run GPU configurado.
- HF token en secreto del worker.
- Endpoint RunPod o Cloud Run GPU creado con imagen Docker publicada.
- Storage R2/S3 real accesible desde worker.
- Dominio/API publica para recibir callbacks.

Sin esas claves, el repo queda listo y validado en modo contrato, pero no puede ejecutar TRIBE real.
