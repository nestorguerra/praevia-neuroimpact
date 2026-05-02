# Sprint 6 · Worker GPU TRIBE v2 end-to-end

Fecha: 2026-05-01

## Objetivo

Ejecutar TRIBE v2 fuera de Colab y registrar predicciones BOLD como artefactos de run.

## Base tecnica verificada

El model card oficial de `facebook/tribev2` documenta el flujo de inferencia:

```python
from tribev2 import TribeModel

model = TribeModel.from_pretrained("facebook/tribev2", cache_folder="./cache")
df = model.get_events_dataframe(video_path="path/to/video.mp4")
preds, segments = model.predict(events=df)
```

Tambien indica que `get_events_dataframe` acepta `video_path`, `audio_path` o `text_path`, y que las predicciones viven en fsaverage5 con unos 20k vertices.

Fuente: https://huggingface.co/facebook/tribev2

## Implementado

### Worker GPU

Nuevo worker en:

- `worker/tribe/Dockerfile`
- `worker/tribe/requirements.txt`
- `worker/tribe/tribe_worker/runner.py`
- `worker/tribe/tribe_worker/cli.py`
- `worker/tribe/examples/run-spec.json`

Incluye:

- base CUDA/PyTorch.
- FFmpeg.
- Nilearn.
- Hugging Face Hub.
- clone/install del repo oficial `facebookresearch/tribev2`.
- cache de modelo vía `MODEL_CACHE_DIR`.
- uso de `HF_TOKEN` por variable de entorno.
- modo real y modo mock contractual.

### Outputs

El worker escribe:

- `bold_predictions.npz`
- `segments.parquet`
- `run_metrics.json`

El `.npz` contiene `bold` con shape esperada:

```text
(n_timesteps, 20484)
```

### Backend

Migracion preparada:

`backend/supabase/migrations/0005_analysis_runs_predictions.sql`

Incluye:

- `analysis_runs`
- `prediction_artifacts`
- enum `analysis_run_status`
- logs.
- GPU seconds.
- VRAM.
- duracion.
- storage keys de outputs.
- RLS por organizacion.

Contrato FastAPI preparado en:

- `backend/app/routes/inference.py`
- `backend/app/schemas/inference.py`
- `backend/app/repositories/inference_memory.py`

Endpoints:

- `POST /v1/analysis-runs`
- `POST /v1/analysis-runs/batch`
- `GET /v1/analysis-runs/{run_id}`
- `GET /v1/experiments/{experiment_id}/analysis-runs`

### Frontend

Nuevo panel Sprint 6 dentro de `/app/upload`:

- boton `Lanzar TRIBE`.
- runs por asset preprocesado.
- estado `Done`.
- shape `12 x 20484` en modo local.
- artifacts:
  - `bold_predictions.npz`
  - `segments.parquet`
  - `run_metrics.json`
- logs y prediction keys.

## Demo de aceptacion local

Flujo probado con Playwright:

1. Registro local.
2. Entrada a `/app/upload`.
3. Upload de video `.webm`.
4. `Preparar inputs TRIBE`.
5. Job de Sprint 5 `Completado`.
6. `Lanzar TRIBE`.
7. Run visible como `Done`.
8. Artefactos visibles:
   - `bold_predictions.npz`
   - `segments.parquet`
   - `run_metrics.json`
9. Shape visible `12 x 20484`.

## QA

- `npm run build`: OK.
- `python3 -m compileall backend/app worker/preprocessing worker/tribe/tribe_worker`: OK.
- Worker mock CLI: OK.
- `.npz` mock validado: `(12, 20484) float32`.
- Playwright flujo Sprint 6: OK.
- Mobile 390px sin overflow horizontal: OK.
- Ruflo MCP check: OK.

Capturas temporales:

- `/tmp/praevia-neuroimpact-qa/sprint6-tribe-run.png`
- `/tmp/praevia-neuroimpact-qa/sprint6-mobile.png`

## Limitaciones y gate tecnico

El contrato end-to-end queda implementado, pero el gate tecnico de TRIBE real no esta superado en este Mac.

Bloqueos actuales:

- Docker no esta instalado.
- No hay GPU local disponible.
- FFmpeg no esta instalado.
- `hf` CLI no esta instalado.
- Falta `HF_TOKEN` configurado.
- No hay proveedor GPU desplegado todavia.

Por tanto, no se debe pasar a scoring serio de Sprint 7 hasta ejecutar tres assets reales:

- video.
- audio.
- texto.

Cada uno debe producir un `bold_predictions.npz` real desde TRIBE con shape `(n_timesteps, 20484)` y registro `analysis_runs.status=done`.

