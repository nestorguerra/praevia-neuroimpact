# TRIBE worker deployment

Proveedor recomendado para piloto: RunPod Serverless GPU.

## Motivo

- Permite separar backend SaaS de inferencia GPU.
- Arranque bajo demanda para controlar coste.
- Imagen Docker propia con CUDA, PyTorch, FFmpeg y TRIBE.
- Secrets separados: `HF_TOKEN`, storage S3/R2 y API callback.

## Imagen

```bash
docker build -f worker/tribe/Dockerfile -t praevia/tribe-worker:local .
```

## Variables

```bash
HF_TOKEN=
TRIBE_MODEL_ID=facebook/tribev2
MODEL_CACHE_DIR=/models/tribe
S3_ENDPOINT=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
API_CALLBACK_URL=
```

## Hardware inicial

- GPU: NVIDIA L4/A10/A100 segun disponibilidad.
- VRAM minima objetivo: 24 GB para assets cortos de piloto.
- Timeout inicial: 15 minutos por asset corto.
- Concurrencia inicial: 1 por worker.

## Contrato de job

Input:

```json
{
  "run_id": "uuid",
  "asset_id": "uuid",
  "model_id": "facebook/tribev2",
  "cache_dir": "/models/tribe",
  "inputs": {
    "video_path": "/inputs/normalized_video.mp4",
    "audio_path": "/inputs/audio_16k_mono.wav",
    "text_path": "/inputs/transcript.whisper.json"
  }
}
```

Output:

- `bold_predictions.npz`
- `segments.parquet`
- `run_metrics.json`

El backend debe marcar `analysis_runs.status=done` solo cuando los tres artefactos quedan registrados.

