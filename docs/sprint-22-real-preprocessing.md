# Sprint 22 · Preprocesamiento real

Fecha: 2026-05-02

## Decision

Para beta y pilotos usamos Whisper local dentro del worker CPU. No conectamos una API externa de transcripcion por defecto.

Motivo:

- Mejor privacidad para assets corporativos.
- Coste predecible frente a pago por minuto.
- Menos proveedores externos en beta.
- Facil de mover a GPU o WhisperX si necesitamos alineacion palabra-tiempo mas fina.

## Implementado

### Backend

- `PREPROCESSING_WORKER_MODE=local_cpu` activa preprocesamiento real desde la API.
- `PREPROCESSING_WORKER_MODE=mock` conserva el flujo demo/local sin storage real.
- `backend/app/services/preprocessing_cpu.py` descarga el original desde R2/S3/MinIO, ejecuta FFmpeg/ffprobe, genera derivados y los sube de vuelta a storage.
- `backend/app/repositories/preprocessing_db.py` crea jobs reales, persiste derivados en `asset_derivatives` y registra manifiesto en `storage_objects`.
- Los jobs fallidos quedan como `failed`, con error visible y logs.

### Worker CPU

- `worker/preprocessing/service.py` ya no usa transcript mock.
- `transcript.whisper.json` se genera con `faster-whisper` cuando la dependencia esta instalada.
- Si falta `faster-whisper`, el transcript queda trazable con `status=dependency_missing`; esto evita fallos silenciosos en desarrollo, pero no es aceptable para produccion.
- `.srt` produce `transcript.srt.json` con segmentos temporales y deteccion simple de idioma.
- `.txt` y `.md` producen `normalized_text.json`.
- Video/audio producen:
  - `metadata.ffprobe.json`
  - `normalized_video.mp4` cuando aplica
  - `audio_16k_mono.wav`
  - `transcript.whisper.json`
  - `silence_report.json`

### Contenedores

- `worker/preprocessing/Dockerfile` instala FFmpeg y `faster-whisper`.
- `backend/Dockerfile` instala FFmpeg y el extra `.[preprocessing]` para soportar `local_cpu` en beta.

### Configuracion

Variables nuevas:

```env
PREPROCESSING_WORKER_MODE=local_cpu
PREPROCESSING_TEMP_DIR=/tmp/praevia-preprocessing
WHISPER_PROVIDER=local
WHISPER_MODEL=small
WHISPER_DEVICE=cpu
WHISPER_COMPUTE_TYPE=int8
```

En local el ejemplo queda en `mock` para no bloquear a quien no tenga FFmpeg/Whisper. En staging/production queda en `local_cpu`.

## Criterio de aceptacion

Un video sin subtitulos debe:

1. Descargar el original desde storage.
2. Extraer metadatos con ffprobe.
3. Normalizar video/audio con FFmpeg.
4. Extraer audio 16 kHz mono.
5. Transcribir con Whisper local.
6. Detectar silencios.
7. Subir derivados a storage.
8. Persistir job, derivados y manifiesto.

## QA

- Gate especifico: `npm run preprocessing:gate`.
- Gate completo: `npm run production:gate`.
- El Mac actual no tiene FFmpeg/ffprobe instalados; por eso el gate no ejecuta media real local, solo valida contrato, Dockerfile y runtime de texto/SRT.

## Pendiente para entorno real

- Instalar/provisionar FFmpeg y modelo Whisper en el entorno de ejecucion.
- Configurar storage real R2/S3/MinIO.
- Cambiar `PREPROCESSING_WORKER_MODE=local_cpu` solo cuando storage este operativo.
- Si el volumen sube, mover este trabajo a cola Redis + worker CPU separado para no bloquear la API.
