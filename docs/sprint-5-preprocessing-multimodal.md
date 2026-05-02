# Sprint 5 · Preprocesamiento multimodal

Fecha: 2026-05-01

## Objetivo

Convertir assets validos en inputs internos preparados para TRIBE: media normalizada, audio extraido, transcript, metadatos y logs de preprocesamiento.

## Implementado

### Frontend

- Panel de preprocesamiento dentro de `/app/upload`.
- Boton `Preparar inputs TRIBE` desde la estimacion de creditos y desde el panel Sprint 5.
- Jobs visibles por asset con:
  - estado.
  - progreso.
  - pasos.
  - logs.
  - storage keys de derivados.
- Derivados visibles por asset:
  - `metadata.ffprobe.json`
  - `normalized_video.mp4`
  - `audio_16k_mono.wav`
  - `transcript.whisper.json`
  - `silence_report.json`
  - `normalized_text.json` o `transcript.srt.json`
- Persistencia local por organizacion y experimento para demo.

### DB

Migracion preparada:

`backend/supabase/migrations/0004_preprocessing_jobs.sql`

Incluye:

- `preprocessing_jobs`
- `asset_derivatives`
- enum `preprocessing_job_status`
- indices basicos.
- RLS por organizacion.

### Backend

Contrato inicial FastAPI preparado en:

- `backend/app/routes/preprocessing.py`
- `backend/app/schemas/preprocessing.py`
- `backend/app/repositories/preprocessing_memory.py`

Endpoints base:

- `POST /v1/preprocessing/jobs`
- `GET /v1/preprocessing/jobs/{job_id}`
- `GET /v1/assets/{asset_id}/preprocessing-jobs`

El backend genera un contrato de derivados coherente con el futuro worker real y conserva jobs en repositorio de memoria para desarrollo local.

### Worker CPU

Worker preparado en:

- `worker/preprocessing/service.py`
- `worker/preprocessing/cli.py`
- `worker/README.md`

Funciones:

- `ffprobe` para metadatos.
- Normalizacion de video a MP4 H.264/AAC.
- Normalizacion de audio a WAV 16 kHz mono.
- Extraccion de audio desde video.
- Deteccion de silencios con `silencedetect`.
- Parser `.srt` con timecodes.
- Normalizacion `.txt`/`.md`.
- Transcripcion Whisper local incorporada en Sprint 22 mediante `faster-whisper`; el modo mock queda solo para desarrollo.

## Demo de aceptacion

Flujo probado con Playwright:

1. Registro local.
2. Entrada a `/app/upload`.
3. Upload de video `.webm` sin subtitulos.
4. Click en `Preparar inputs TRIBE`.
5. Job visible como `Completado`.
6. Derivados visibles:
   - media normalizada.
   - audio extraido.
   - transcript.
   - metadatos.
   - reporte de silencios.

Tambien se probo el worker CLI con `.srt` real:

- input: `/tmp/praevia-neuroimpact-qa/sprint5-text/sample.srt`
- output: `/tmp/praevia-neuroimpact-qa/sprint5-text/out`
- derivados: `transcript.srt.json` y `normalized_text.json`.

## QA

- `npm run build`: OK.
- `python3 -m compileall app ../worker/preprocessing`: OK.
- Worker CLI texto/SRT: OK.
- Playwright flujo Sprint 5: OK.
- Desktop 1440px: OK.
- Mobile 390px sin overflow horizontal: OK.
- TestClient FastAPI: no ejecutado en este Python global porque falta instalar dependencias backend (`fastapi`).

Capturas temporales:

- `/tmp/praevia-neuroimpact-qa/sprint5-preprocessing.png`
- `/tmp/praevia-neuroimpact-qa/sprint5-mobile.png`

## Limitaciones

- FFmpeg/ffprobe no esta instalado en este Mac, asi que el worker multimedia real no puede ejecutarse localmente todavia.
- Las dependencias runtime del backend no estan instaladas en el Python global; hay que crear entorno local antes de levantar FastAPI.
- La app puede generar derivados demo/contractuales en localStorage cuando se usa `PERSISTENCE_MODE=memory`.
- La transcripcion real exige instalar `faster-whisper` y descargar el modelo elegido en el worker.
- Desde Sprint 22, los derivados reales se suben a R2/S3/MinIO cuando `PREPROCESSING_WORKER_MODE=local_cpu` y el storage esta configurado.
- Sprint 6 consumira estos contratos para ejecutar TRIBE.
