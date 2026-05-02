# Sprint 24 · Scoring real

Fecha: 2026-05-02

## Objetivo

Transformar `bold_predictions.npz` real de TRIBE en metricas de producto persistidas en PostgreSQL:

- NRI
- Visual Salience
- Narrative Clarity
- Multimodal Coherence
- Semantic Load
- Social Cueing
- Scene Immersion
- Action Readiness
- Temporal Momentum

## Implementado

### Scoring engine

`backend/app/services/scoring_engine.py`:

- lee `bold_predictions.npz`.
- valida matriz 2D.
- valida `20484` vertices corticales esperados para fsaverage5.
- rechaza NaN/infinitos.
- calcula scores por red.
- calcula ROI mapping proxy v0.2.
- genera timeline por TR.
- detecta peak, valley y flat.
- corrige timecode a tiempo de estimulo con `BOLD_DELAY_SECONDS=4.5`.
- calcula confianza segun shape, duracion temporal y derivados disponibles.

### Backend DB

`backend/app/repositories/scoring_db.py` ya no usa `build_mock_scoring` en modo DB.

Flujo:

1. valida que el usuario pertenece a la organizacion.
2. valida que el run TRIBE esta `done`.
3. busca `prediction_artifacts.artifact_type='bold_npz'`.
4. descarga el NPZ desde S3/R2.
5. calcula scoring real.
6. persiste:
   - `neuro_scoring_results`
   - `editorial_scores`
   - `region_scores`
   - `network_scores`
   - `timecourse_points`
   - `peak_moments`
   - `usage_events`

### Migracion

`0018_real_scoring_traceability.sql` anade trazabilidad:

- `source_prediction_artifact_id`
- `pipeline_mode`
- `input_quality`
- `n_timesteps`
- `n_vertices`

## Gate

```bash
cd frontend
npm run scoring:gate
```

El gate genera un NPZ sintetico, valida las nueve metricas, valida red/ROI/timeline, comprueba rechazo de shape invalida y verifica que el backend DB usa artefactos reales.

## Pendiente externo

Para cerrar el criterio con assets reales hace falta el output de Sprint 23:

- run TRIBE real `done`.
- `bold_predictions.npz` en S3/R2.
- storage real configurado.

Sin ese artefacto real, el motor esta validado por contrato y runtime sintetico, pero no puede demostrar scoring de una pieza real.
