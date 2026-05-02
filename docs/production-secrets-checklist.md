# Checklist de secretos para produccion

No pegues estos secretos en commits, PDFs, capturas publicas ni mensajes de clientes. Pasarlos solo por canal privado y guardarlos en el proveedor correspondiente.

## Supabase

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `DATABASE_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Uso:

- Sprint 18: auth real.
- Sprint 19: DB real + RLS.

## Cloudflare R2

- `STORAGE_MODE=s3`
- `S3_ENDPOINT`
- `S3_REGION`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_CREATE_BUCKET_IF_MISSING=false`

Uso:

- Sprint 20: uploads firmados reales.
- Sprint 22: lectura/escritura de derivados del worker CPU.
- Sprint 23: lectura/escritura del worker GPU.
- Sprint 26: almacenamiento de PDFs.

## Preprocesamiento CPU

- `PREPROCESSING_WORKER_MODE=local_cpu`
- `PREPROCESSING_TEMP_DIR`
- `WHISPER_PROVIDER=local`
- `WHISPER_MODEL`
- `WHISPER_DEVICE`
- `WHISPER_COMPUTE_TYPE`

Uso:

- Sprint 22: FFmpeg, metadatos, normalizacion, silencios y Whisper local.

Nota: Whisper local no necesita API key externa, pero el entorno debe poder instalar `faster-whisper` y descargar/cachear el modelo elegido.

## RunPod

- `GPU_PROVIDER=runpod_serverless`
- `GPU_PROVIDER_API_KEY`
- `RUNPOD_API_KEY`
- `TRIBE_WORKER_MODE=remote_gpu`
- `TRIBE_WORKER_ENDPOINT_URL=https://api.runpod.ai/v2/<endpoint-id>`
- `TRIBE_WORKER_IMAGE`
- `TRIBE_CALLBACK_URL`
- `TRIBE_CALLBACK_SECRET`
- `TRIBE_RUN_TIMEOUT_SECONDS`
- `TRIBE_RUN_MAX_RETRIES`
- `TRIBE_GPU_EUR_PER_SECOND`

Uso:

- Sprint 23: inferencia TRIBE real.

GPU inicial recomendada: T4/L4 para pruebas cortas. Si aparecen errores de memoria, duraciones largas o timeouts, subir a A10G/L40S.

## Hugging Face

- `HF_TOKEN`
- `TRIBE_MODEL_ID=facebook/tribev2`

Uso:

- Sprint 23: descarga/cache del modelo en worker GPU.

## OpenAI

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_TIMEOUT_SECONDS`
- `LLM_INTERPRETER_MODEL`
- `LLM_WRITER_MODEL`
- `LLM_WRITER_REASONING_EFFORT`
- `LLM_PROMPT_VERSION`
- `LLM_JSON_MAX_RETRIES`
- `LLM_INPUT_EUR_PER_1K`
- `LLM_OUTPUT_EUR_PER_1K`

Uso:

- Sprint 25: interpretacion y redaccion real de informes.
- Confirmar nombres exactos de modelo con la cuenta OpenAI que vaya a pagar el servicio.
- El coste estimado de informes se registra en `usage_events` con las tarifas configuradas.

Nota: confirma en tu cuenta el nombre exacto del modelo disponible. La app acepta el valor como variable de entorno.

## PDF server-side

- `REPORT_RENDERER_MODE`
- `REPORT_RENDERER_TIMEOUT_SECONDS`

Uso:

- Sprint 26: generacion HTML/PDF server-side con Playwright/Chromium.
- Requiere storage S3/R2 configurado para guardar y descargar artefactos.

## Sentry

- `SENTRY_DSN`

Uso:

- Sprint 29: observabilidad.

## Resend

- `RESEND_API_KEY`
- `EMAIL_FROM`

Uso:

- Sprint 18: recovery/magic links si no delegamos todo en Supabase.
- Sprint 29: notificaciones de jobs e informes.

## Seguridad backend

- `JWT_SECRET`
- `SIGNED_URL_TTL_SECONDS`
- `CORS_ALLOWED_ORIGINS`
- `ALLOWED_HOSTS`
- `FORCE_HTTPS`

Uso:

- Sprint 18 en adelante.
