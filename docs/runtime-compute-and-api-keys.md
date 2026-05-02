# Runtime compute and API keys

Fecha: 2026-05-02

## Decision

TRIBE v2 no se ejecuta en Codex ni en el navegador. Para la beta local seguimos con mock contractual; para pilotos reales se debe desplegar un worker GPU externo con Docker, cache de modelo y storage S3/R2.

El preprocesamiento de Sprint 22 no usa GPU ni API externa por defecto: se ejecuta con FFmpeg + Whisper local en worker CPU y escribe derivados en S3/R2/MinIO. Si el volumen crece, se mueve a cola Redis + worker CPU dedicado.

Proveedor recomendado para el primer piloto: RunPod Serverless GPU.

Motivo:

- permite ejecutar una imagen Docker propia del worker TRIBE.
- pago por uso, util para pilotos con pocos assets.
- evita depender de Colab como infraestructura de producto.
- mantiene Colab solo como fallback manual de emergencia.

Proveedor alternativo recomendado si priorizamos ruta enterprise: Google Cloud.

Motivo:

- Cloud Run puede alojar backend, worker CPU y worker GPU bajo el mismo proyecto.
- Cloud Tasks permite encolar runs TRIBE de forma durable.
- Cloud Storage y Cloud SQL son mas faciles de defender ante IT/procurement corporativo.
- Secret Manager evita guardar claves reales en `.env` o en el frontend.

Coste:

- Google Cloud puede ser algo mas caro y requiere mas integracion inicial.
- Para beta enterprise, el coste fijo esperado es 75-200 USD/mes mas GPU y OpenAI.
- Para beta rapida barata, RunPod sigue siendo el camino mas corto.

Estado implementacion:

- `GPU_PROVIDER=google_cloud_run_gpu` soportado por backend.
- `GCP_PROJECT_ID`, `GCP_TASKS_QUEUE`, `GCP_TASKS_LOCATION` y `GCP_TASKS_SERVICE_ACCOUNT` controlan Cloud Tasks.
- `TRIBE_WORKER_RUNTIME=http` permite arrancar el worker TRIBE en Cloud Run.
- `TRIBE_WORKER_BEARER_TOKEN` permite proteger el endpoint del worker si se publica sin IAM; si Cloud Run usa IAM, Cloud Tasks debe firmar con OIDC.

Alternativas aceptadas:

- Modal GPU worker si preferimos Python/serverless mas integrado.
- Hugging Face Inference Endpoint privado si se prioriza operar cerca del Hub.
- Google Cloud Run GPU + Cloud Tasks si se prioriza stack enterprise unico.
- Vertex AI Custom Jobs si TRIBE necesita jobs mas largos o GPU mas flexible.
- Colab manual solo para emergencia/I+D, no para produccion.

Ver tambien:

- `docs/google-cloud-beta-architecture.md`
- `infra/google-cloud-run-deployment.md`
- `infra/env/google-production.example.env`

## Secrets requeridos

Los secretos necesarios para pasar de demo a piloto real son:

- `HF_TOKEN`: descarga/cache del modelo `facebook/tribev2` en el worker.
- `GPU_PROVIDER_API_KEY`: proveedor GPU, por ejemplo RunPod o Modal.
- `RUNPOD_API_KEY`: alias directo si usamos RunPod Serverless.
- `TRIBE_WORKER_ENDPOINT_URL`: endpoint privado del worker.
- `TRIBE_CALLBACK_URL`: endpoint publico del backend para recibir resultados del worker.
- `TRIBE_CALLBACK_SECRET`: secreto compartido para firmar el callback del worker.
- `TRIBE_RUN_TIMEOUT_SECONDS`: timeout operativo del run.
- `TRIBE_RUN_MAX_RETRIES`: reintentos al encolar el job.
- `OPENAI_API_KEY`: interpretacion y redaccion de informes.
- `OPENAI_BASE_URL`: URL base de OpenAI, por defecto `https://api.openai.com/v1`.
- `OPENAI_TIMEOUT_SECONDS`: timeout de llamada al LLM.
- `LLM_INTERPRETER_MODEL`: modelo de lectura final, por defecto `gpt-5.5-pro`.
- `LLM_WRITER_MODEL`: modelo de redaccion razonada, por defecto `gpt-5.5-thinking`.
- `LLM_WRITER_REASONING_EFFORT`: esfuerzo de razonamiento para redaccion.
- `LLM_PROMPT_VERSION`: version trazable del prompt.
- `LLM_JSON_MAX_RETRIES`: reintentos si la salida JSON falla.
- `LLM_INPUT_EUR_PER_1K` y `LLM_OUTPUT_EUR_PER_1K`: tarifas internas para registrar coste estimado por informe.
- `REPORT_RENDERER_MODE=playwright`: renderer server-side HTML/PDF.
- `REPORT_RENDERER_TIMEOUT_SECONDS`: timeout de Chromium al generar PDF.
- `PREPROCESSING_WORKER_MODE=local_cpu`: activa FFmpeg/Whisper real.
- `WHISPER_MODEL`: modelo local, por defecto `small`.

## UI implementada

La app privada incluye `/app/settings`:

- seleccion de proveedor compute.
- modo worker: mock local, GPU remoto o Colab manual.
- API key proveedor GPU.
- endpoint worker TRIBE.
- callback URL y secreto del worker TRIBE.
- Hugging Face token.
- OpenAI API key.
- modelo de interpretacion.
- modelo de redaccion.
- caps de gasto beta.
- preview de variables `.env` para backend seguro.

## Seguridad

En beta local, la pantalla guarda los valores en `localStorage` del navegador para poder probar el flujo.

En produccion, esto no es suficiente. Las claves deben guardarse en un secret vault del backend/proveedor cloud y el frontend solo debe mostrar estado configurado/no configurado. No se deben escribir claves reales de clientes en logs, PDFs, exports, localStorage compartido ni reportes.
