# Sprint 7 · Scoring neurocognitivo y resultados internos

Fecha: 2026-05-01

## Objetivo

Transformar la prediccion BOLD de TRIBE en metricas internas de producto: scores editoriales 0-100, redes, regiones, timeline, picos, valles, confianza, benchmark y acciones por timecode.

El sprint no interpreta compra, emocion real ni conducta. Convierte predicciones corticales en indicadores comparativos para decision creativa.

## Implementado

### DB

Migracion preparada:

`backend/supabase/migrations/0006_neurocognitive_scoring.sql`

Incluye:

- `neuro_scoring_results`
- `editorial_scores`
- `region_scores`
- `network_scores`
- `timecourse_points`
- `peak_moments`
- indices por run, experimento y resultado.
- RLS por organizacion.

### Backend

Contrato FastAPI preparado en:

- `backend/app/routes/scoring.py`
- `backend/app/schemas/scoring.py`
- `backend/app/repositories/scoring_memory.py`

Endpoints:

- `POST /v1/scoring/results`
- `GET /v1/scoring/results/{result_id}`
- `GET /v1/analysis-runs/{analysis_run_id}/scoring-results`
- `GET /v1/experiments/{experiment_id}/scoring-results`

El repositorio de desarrollo conserva resultados en memoria para poder probar el contrato sin Supabase desplegado.

### Worker scoring

Nuevo worker en:

- `worker/scoring/service.py`
- `worker/scoring/cli.py`

Entrada:

- `bold_predictions.npz` con array `bold`.
- shape esperada: `(n_timesteps, 20484)`.

Salida JSON:

- `scoring_version`
- `bold_delay_seconds`
- `confidence_label`
- `benchmark_label`
- `summary`
- `editorial_scores`
- `region_scores`
- `network_scores`
- `timecourse_points`
- `peak_moments`

Reglas v0.1:

- delay BOLD aproximado: `4.5s`.
- TR local: `1.49s`.
- confianza `alta` si hay 20484 vertices y al menos 24 timesteps.
- confianza `media` si hay 20484 vertices y al menos 10 timesteps.
- confianza `baja` si el input queda por debajo de esos umbrales.

### Scores editoriales

Metricas generadas:

- Neural Response Index.
- Visual Salience.
- Narrative Clarity.
- Multimodal Coherence.
- Semantic Load.
- Social Cueing.
- Scene Immersion.
- Action Readiness.
- Temporal Momentum.

Cada score incluye:

- valor 0-100.
- confianza.
- delta contra baseline demo.
- evidencia.
- accion recomendada.

### Redes y regiones

El mapeo v0.1 usa cortes deterministas de vertices como proxy interno:

- visual.
- auditory.
- language.
- social.
- control.
- motor.

Regiones proxy:

- Visual occipital.
- Scene / parahippocampal.
- Superior temporal.
- Inferior frontal language.
- STS / TPJ social.
- Prefrontal control.
- Premotor / action.

Este mapeo no sustituye el atlas final. Es una capa contractual para cerrar API, UI y persistencia hasta conectar atlas/ROI definitivo.

### Frontend

Panel Sprint 7 integrado en `/app/upload`:

- boton `Calcular scoring`.
- resumen NRI, confianza, numero de scores y delay BOLD.
- cards con nueve scores editoriales.
- timeline corregido por retardo BOLD.
- redes funcionales.
- regiones/ROIs.
- picos, valles y tramo plano con accion por timecode.
- bloque `JSON interno` con endpoints esperados.

Archivos principales:

- `frontend/src/components/scoring/ScoringPanel.tsx`
- `frontend/src/scoring/types.ts`
- `frontend/src/scoring/generateScoringResult.ts`
- `frontend/src/scoring/localScoringStore.ts`
- `frontend/src/scoring/useScoringStore.ts`

## Demo de aceptacion

Flujo probado con Playwright:

1. Registro local.
2. Entrada a `/app/upload`.
3. Upload de video `.webm`.
4. `Preparar inputs TRIBE`.
5. `Lanzar TRIBE`.
6. Run visible como `Done`.
7. `Calcular scoring`.
8. Panel Sprint 7 visible con:
   - 1 resultado.
   - 9 scores editoriales.
   - 6 redes funcionales.
   - 7 regiones/ROIs en datos.
   - 12 puntos de timeline.
   - 3 momentos accionables.

Capturas temporales:

- `/tmp/praevia-neuroimpact-qa/sprint7-scoring.png`
- `/tmp/praevia-neuroimpact-qa/sprint7-mobile.png`

## QA

- `npm run build`: OK.
- `python3 -m compileall backend/app worker/preprocessing worker/tribe/tribe_worker worker/scoring`: OK.
- Worker scoring CLI con `.npz` mock: OK.
- JSON scoring generado: OK.
- Playwright flujo Sprint 7: OK.
- Mobile 390px sin overflow horizontal: OK.
- Ruflo MCP check: OK.

Comando worker scoring:

```bash
PYTHONPATH=worker python3 -m scoring.cli \
  --npz /tmp/praevia-neuroimpact-qa/tribe-mock-final/bold_predictions.npz \
  --output /tmp/praevia-neuroimpact-qa/scoring-result.json
```

Resumen generado en QA:

```json
{
  "nri": 41.8,
  "confidence": "media",
  "decision": "Resultado interno generado. Requiere benchmark real antes de decision comercial."
}
```

En la app, el run local demo mostro NRI 71 con confianza media porque usa el generador contractual de frontend para simular el scoring desde el run TRIBE local.

## Limitaciones y gate tecnico

Sprint 7 queda cerrado como contrato de producto, API, DB, worker y UI, pero el scoring cientifico serio sigue bloqueado por el gate de Sprint 6.

Pendiente antes de usarlo en pilotos reales:

- ejecutar TRIBE real fuera de Colab.
- procesar al menos 3 assets reales: video, audio y texto.
- validar que cada asset produce `bold_predictions.npz` con shape `(n_timesteps, 20484)`.
- sustituir proxy ROI por atlas/ROI definitivo.
- crear benchmarks reales por categoria.
- calibrar scores contra resultados externos cuando haya pilotos.

No se debe presentar todavia como metrica comercial validada. Si se enseña en demo, debe llamarse scoring interno v0.1 o baseline demo.
