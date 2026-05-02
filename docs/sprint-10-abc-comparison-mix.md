# Sprint 10 · Comparativa A/B/C y mix recomendado

Fecha: 2026-05-01

## Objetivo

Construir el caso comercial estrella: subir dos o tres versiones, comparar resultados neurocognitivos, elegir master, detectar ganadores por modalidad y proponer un mix accionable por timecode.

## Implementado

### DB

Migracion preparada:

`backend/supabase/migrations/0008_comparisons_abc.sql`

Incluye:

- `comparison_runs`
- `comparison_items`
- `comparison_metric_deltas`
- `comparison_timepoint_deltas`
- `comparison_mix_segments`
- `comparison_status`
- `asset_slot`
- indices por experimento/comparativa.
- RLS por organizacion.

### Backend

Contrato FastAPI preparado:

- `backend/app/schemas/comparisons.py`
- `backend/app/repositories/comparison_memory.py`
- `backend/app/routes/comparisons.py`

Endpoints:

- `POST /v1/comparisons`
- `GET /v1/comparisons/{comparison_id}`
- `GET /v1/experiments/{experiment_id}/comparisons`

El contrato valida que todos los scoring results pertenecen a la misma organizacion y experimento. La salida incluye ranking, deltas por metrica, ganador por timepoint, comparabilidad y mix recomendado.

### Frontend

Nueva vista privada:

- `/app/compare`

Archivos principales:

- `frontend/src/pages/ComparisonPage.tsx`
- `frontend/src/comparison/types.ts`
- `frontend/src/comparison/generateComparison.ts`
- `frontend/src/comparison/localComparisonStore.ts`
- `frontend/src/comparison/exportComparison.ts`
- `frontend/src/components/layout/AppShell.tsx`
- `frontend/src/styles/app.css`

La pantalla incluye:

- decision recomendada visible.
- cards A/B/C con ranking y master.
- timeline comparado por tramo.
- tabla de deltas por metrica.
- mix recomendado: master, apertura, tramo medio, cierre/CTA y recorte.
- criterios de comparabilidad: piezas, formato, duracion y canal.
- resumen de ganadores global/modalidad/tramo.
- export PDF A/B/C, JSON y CSV.

## Demo de aceptacion

Flujo probado con Playwright:

1. Registro local.
2. Upload de tres assets `.txt` en slots A/B/C.
3. Preparar inputs TRIBE.
4. Lanzar TRIBE mock contractual.
5. Calcular scoring para las tres versiones.
6. Abrir `/app/compare`.
7. Regenerar mix.
8. Exportar PDF A/B/C.
9. Exportar JSON.
10. Exportar CSV.

Resultado:

```json
{
  "cards": 3,
  "mixRows": 5,
  "metricRows": 9,
  "timepoints": 12,
  "winnerCards": 4,
  "pdfHead": "%PDF-1.4",
  "csvLines": 36
}
```

API validada en entorno temporal:

```text
POST /v1/comparisons -> 200
Comparativa A/B/C C 3 9 12 5
GET /v1/comparisons/{id} -> 200
GET /v1/experiments/{experiment_id}/comparisons -> 1
```

Artefactos QA:

- `/tmp/praevia-neuroimpact-qa/sprint10-comparison.png`
- `/tmp/praevia-neuroimpact-qa/sprint10-mobile.png`
- `/tmp/praevia-neuroimpact-qa/sprint10-comparison.pdf`
- `/tmp/praevia-neuroimpact-qa/sprint10-comparison.json`
- `/tmp/praevia-neuroimpact-qa/sprint10-comparison.csv`

## QA

- `npm run build`: OK.
- `python3 -m compileall backend/app worker/preprocessing worker/tribe/tribe_worker worker/scoring`: OK.
- Contrato backend `build_comparison`: OK.
- FastAPI `POST /v1/comparisons`: OK en venv temporal con dependencias.
- Flujo UI A/B/C completo: OK.
- Export PDF A/B/C: OK, `%PDF-1.4`.
- Export JSON: OK.
- Export CSV: OK.
- Desktop 1440px: OK, sin overflow horizontal.
- Mobile 390px: OK, sin overflow horizontal.
- Ruflo MCP: OK, 237 tools disponibles.

## Limitaciones

- La comparativa usa scoring v0.1 local hasta completar el gate TRIBE real con GPU.
- El PDF A/B/C del frontend es fallback descargable para demo; el renderer Playwright del backend debe producir el PDF final de produccion.
- Los criterios de comparabilidad son v1 visual/contractual. En produccion deben comparar duracion real, canal, formato, codec y estrategia creativa.
- El mix recomendado es determinista. En Sprint 11+ conviene guardarlo como objeto auditable con coste, usuario y version de scoring.

## Criterio de aceptacion

Cumplido para MVP interno:

- el usuario puede subir tres versiones.
- el producto calcula scoring para cada una.
- la comparativa muestra ganador global.
- la comparativa muestra ganadores por modalidad.
- la comparativa muestra ganadores por tramo.
- hay mix recomendado con master y donantes.
- hay export PDF/JSON/CSV.
- la decision final es defendible y accionable.
