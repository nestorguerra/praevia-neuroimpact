# TRIBE GPU Worker

Sprint 23 encapsula la inferencia TRIBE v2 fuera de Colab con una imagen Docker CUDA preparada para RunPod Serverless.

## Build

```bash
docker build -f worker/tribe/Dockerfile -t praevia/tribe-worker:local .
```

## Run real en RunPod Serverless

El contenedor arranca el handler serverless:

```bash
python -m tribe_worker.handler
```

Variables necesarias en el endpoint:

```bash
HF_TOKEN=hf_...
S3_ENDPOINT=https://...
S3_REGION=auto
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
TRIBE_CALLBACK_SECRET=...
TRIBE_MODEL_ID=facebook/tribev2
MODEL_CACHE_DIR=/models/tribe
```

La API principal llama al endpoint RunPod con `POST /run` y el worker devuelve el resultado al backend mediante callback privado.

## Run mock contract

```bash
python -m tribe_worker.cli --run-spec examples/run-spec.json --output-dir /tmp/tribe-out --mock
```

## Input contract

El handler recibe un payload RunPod con `input`:

```json
{
  "run_id": "uuid",
  "organization_id": "uuid",
  "asset_id": "uuid",
  "model_id": "facebook/tribev2",
  "cache_dir": "/models/tribe",
  "source_bucket": "praevia-neuroimpact-production",
  "output_bucket": "praevia-neuroimpact-production",
  "output_prefix": "predictions/production/org/.../run/...",
  "callback_url": "https://api.tu-dominio.com/v1/internal/tribe/callback",
  "derivatives": [
    {
      "derivative_type": "normalized_media",
      "storage_bucket": "praevia-neuroimpact-production",
      "storage_key": "derivatives/.../normalized_video.mp4",
      "label": "normalized_video.mp4"
    }
  ]
}
```

## Output contract

- `bold_predictions.npz`
- `segments.parquet`
- `run_metrics.json`

`bold_predictions.npz` contiene `bold` con forma esperada `(n_timesteps, 20484)` para fsaverage5.
