# Sprint 27 - Comparativa A/B/C real

## Objetivo

Convertir la comparativa A/B/C en un flujo productivo real: tres assets ya procesados por TRIBE, tres scorings reales desde `bold_predictions.npz`, deltas comparativos, ganador por modalidad, ganador por tramo, mix recomendado e informe trazable.

## Lo implementado

- Contrato backend ampliado en `backend/app/schemas/comparisons.py`.
- Trazabilidad real en `backend/app/repositories/comparison_db.py`.
- Migracion `backend/supabase/migrations/0019_real_comparison_traceability.sql`.
- UI actualizada en `frontend/src/pages/ComparisonPage.tsx`.
- Tipos y mapeo API actualizados en `frontend/src/comparison/types.ts` y `frontend/src/comparison/apiComparisonStore.ts`.
- Gate automatizado `scripts/comparison-real-gate.mjs`.

## Validaciones de produccion

La API comprueba y guarda:

- Los scoring results pertenecen a la misma organizacion y experimento.
- Cada scoring apunta a un `analysis_run`.
- Cada run esta `done`.
- Cada scoring usa `pipeline_mode='real_npz'`.
- Cada scoring mantiene `source_prediction_artifact_id`.
- La malla cortical esperada es fsaverage5 con 20.484 vertices.
- Las versiones son comparables por tipo de asset, duracion, timesteps y modelo.

Si hay errores, la comparativa queda `failed`. Si solo hay diferencias defendibles, queda `needs_review`. Si todo cuadra, queda `ready`.

## Salida generada

La comparativa devuelve:

- Ranking A/B/C por NRI.
- Deltas por metrica editorial.
- Ganador por modalidad.
- Ganador por timepoint con margen.
- Mix recomendado: master, apertura, tramo medio, cierre y recorte.
- `report_payload` con `algorithm_version`, `source_runs`, comparabilidad, deltas y ventanas.
- Evento de uso `comparison_generation`.

## Comando de QA

```bash
cd frontend
npm run comparison:gate
```

El gate valida contrato, trazabilidad, migracion, UI y una ejecucion runtime de `build_comparison`.

## Criterio de aceptacion

El flujo queda listo a nivel de codigo para que, con Supabase/R2/RunPod/Hugging Face configurados, el usuario suba A/B/C reales, ejecute TRIBE en los tres assets, calcule scoring real y obtenga una decision defendible: master, tramos donantes y recorte accionable.

## Pendiente externo

Para probarlo con TRIBE real faltan credenciales y servicios:

- Supabase aplicado con migrations.
- Storage S3/R2 operativo.
- RunPod Serverless o proveedor GPU.
- `HF_TOKEN`.
- Tres assets reales cortos: video, audio y texto o tres versiones comparables.
