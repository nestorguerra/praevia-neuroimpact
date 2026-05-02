# Sprint 9 · LLM Interpretation Engine + informes PDF

Fecha: 2026-05-01

## Objetivo

Generar informes ejecutivos/creativos desde un resultado de scoring, con lenguaje controlado, trazabilidad, guardrails de claims y salida PDF/HTML/JSON.

## Implementado

### DB

Migracion preparada:

`backend/supabase/migrations/0007_reports_llm.sql`

Incluye:

- `reports`
- `report_sections`
- `report_type`
- `report_status`
- modelo draft/final/reviewer.
- tokens y coste estimado.
- guardrail status/findings.
- storage keys para HTML/PDF.
- RLS por organizacion.

### Backend

Contrato FastAPI preparado:

- `backend/app/routes/reports.py`
- `backend/app/schemas/reports.py`
- `backend/app/repositories/reporting_memory.py`

Endpoints:

- `POST /v1/reports`
- `GET /v1/reports/{report_id}`
- `GET /v1/scoring/results/{scoring_result_id}/reports`
- `GET /v1/experiments/{experiment_id}/reports`

### LLM Router

Servicios preparados:

- `backend/app/services/llm_router.py`
- `backend/app/services/guardrails.py`

Contrato Sprint 9:

- draft model: `local-draft-v0` para desarrollo.
- final model configurado como `gpt-5.5`.
- reviewer premium configurado como `claude-opus-4.7`.
- prompt version: `report-master-v0.1`.

En local no se llaman proveedores externos. El router usa interpretacion determinista para poder probar producto sin claves. Los adapters OpenAI/Anthropic se conectan despues sin cambiar rutas, schema ni UI.

### Guardrails

El sistema revisa y reescribe claims prohibidos antes de guardar informe:

- "medimos emocion real".
- "leemos la mente".
- "garantizamos compra/conversion/recuerdo/engagement".
- "predice compra/conducta/emocion".
- "manipulacion subconsciente".

Salida:

- `passed`
- `rewritten`
- `blocked` preparado para futuro.

### Frontend

La pestaña `Informe` de `/app/results` ahora permite:

- generar informe desde el scoring activo.
- ver status de modelos y guardrails.
- revisar secciones generadas.
- descargar PDF.
- descargar HTML print-first.
- descargar report JSON.

Archivos principales:

- `frontend/src/reporting/types.ts`
- `frontend/src/reporting/generateReport.ts`
- `frontend/src/reporting/guardrails.ts`
- `frontend/src/reporting/htmlReport.ts`
- `frontend/src/reporting/pdfReport.ts`
- `frontend/src/reporting/localReportStore.ts`
- `frontend/src/pages/ResultsPage.tsx`

### Reporting HTML/PDF

Renderer Playwright preparado:

- `reporting/render-report.mjs`
- `reporting/sample-report.json`

Comando:

```bash
node reporting/render-report.mjs \
  --input reporting/sample-report.json \
  --output-html /tmp/praevia-neuroimpact-qa/sprint9-report.html \
  --output-pdf /tmp/praevia-neuroimpact-qa/sprint9-report.pdf
```

El frontend tambien genera un PDF descargable local para demo. El PDF de produccion debe generarse con el renderer Playwright/Chromium en backend/job.

## Demo de aceptacion

Flujo probado con Playwright:

1. Registro local.
2. Upload de asset `.txt`.
3. Preparar inputs TRIBE.
4. Lanzar TRIBE mock contractual.
5. Calcular scoring.
6. Abrir dashboard.
7. Abrir tab `Informe`.
8. Generar informe.
9. Descargar PDF.
10. Descargar HTML.
11. Descargar Report JSON.

Resultado:

```json
{
  "sections": 5,
  "guardrails": ["gpt-5.5", "claude-opus-4.7", "passed", "0 EUR"],
  "downloads": [
    {"path": "/tmp/praevia-neuroimpact-qa/sprint9-ui-report.pdf", "head": "%PDF-1.4"},
    {"path": "/tmp/praevia-neuroimpact-qa/sprint9-ui-report.html", "head": "<!doctyp"},
    {"path": "/tmp/praevia-neuroimpact-qa/sprint9-ui-report.json", "head": "{\\n  \\"id\\""}
  ]
}
```

Artefactos QA:

- `/tmp/praevia-neuroimpact-qa/sprint9-report-tab.png`
- `/tmp/praevia-neuroimpact-qa/sprint9-mobile.png`
- `/tmp/praevia-neuroimpact-qa/sprint9-report-html.png`
- `/tmp/praevia-neuroimpact-qa/sprint9-report.pdf`
- `/tmp/praevia-neuroimpact-qa/sprint9-ui-report.pdf`

## QA

- `npm run build`: OK.
- `python3 -m compileall backend/app worker/preprocessing worker/tribe/tribe_worker worker/scoring`: OK.
- Renderer Playwright HTML/PDF: OK.
- UI report generation: OK.
- PDF descargado desde UI: OK, `%PDF-1.4`.
- HTML descargado desde UI: OK.
- Report JSON descargado desde UI: OK.
- Desktop 1366 x 768: OK, sin overflow horizontal.
- Mobile 390px: OK, sin overflow horizontal.

## Limitaciones

- El router LLM no llama aun a APIs externas.
- El coste queda a 0 EUR en modo local.
- El PDF del frontend es un fallback descargable; el PDF de produccion debe salir del renderer Playwright.
- Las recomendaciones siguen siendo deterministas, sin segunda lectura real de modelo.
- El scoring comercial serio sigue pendiente del gate TRIBE real en GPU con assets reales.

## Criterio de aceptacion

Cumplido para MVP interno:

- desde un scoring se genera un informe.
- el informe tiene secciones estructuradas.
- los guardrails revisan claims.
- hay PDF descargable.
- hay HTML print-first.
- hay JSON trazable.
- las recomendaciones conservan timecode.
