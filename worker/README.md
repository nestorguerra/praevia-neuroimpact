# Worker CPU · Preprocesamiento multimodal

Sprint 5 prepara los assets para TRIBE sin entrenar ningun modelo.

## Requisitos locales

- `ffmpeg`
- `ffprobe`
- Python 3.11+
- `faster-whisper` para transcripcion real con Whisper local.

Si FFmpeg no esta instalado, el worker devuelve un error claro. Si `faster-whisper` no esta instalado, genera `transcript.whisper.json` con estado `dependency_missing` para que el job sea trazable, pero en staging/produccion el Dockerfile ya instala la dependencia.

## Uso

```bash
python3 -m preprocessing.cli \
  --input /ruta/asset.mp4 \
  --kind video \
  --output /tmp/neuroimpact-preprocessed
```

Tambien puede descargar el asset directamente desde R2/S3/MinIO antes de preprocesar:

```bash
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com \
S3_REGION=auto \
S3_ACCESS_KEY_ID=... \
S3_SECRET_ACCESS_KEY=... \
python3 -m preprocessing.cli \
  --s3-bucket praevia-neuroimpact-staging \
  --s3-key staging/org/<org>/experiment/<experiment>/a-<asset>.mp4 \
  --kind video \
  --upload-bucket praevia-neuroimpact-staging \
  --upload-prefix staging/derived/org/<org>/experiment/<experiment>/asset/<asset>/job/<job> \
  --output /tmp/neuroimpact-preprocessed
```

Outputs esperados:

- `metadata.ffprobe.json`
- `normalized_video.mp4` o `audio_16k_mono.wav`
- `audio_16k_mono.wav` extraido desde video
- `transcript.whisper.json`
- `transcript.srt.json` para subtitulos SRT
- `silence_report.json`

La decision de Sprint 22 es Whisper local en worker CPU. Deja costes controlados, evita enviar material confidencial a otro proveedor de transcripcion y se puede mover a GPU o WhisperX cuando haga falta alineacion palabra-tiempo mas fina.
