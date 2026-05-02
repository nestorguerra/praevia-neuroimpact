# Sprint 26 - PDF server-side real

Fecha: 2026-05-02

## Objetivo

Generar informes PDF en backend de forma repetible, trazable y descargable desde la app.

El PDF frontend queda como fallback local. En modo API/produccion, el informe se renderiza en servidor, se guarda en storage y la app descarga el artefacto privado mediante URL firmada.

## Implementado

### Renderer backend

`backend/app/services/report_renderer.py`:

- construye HTML print-first desde `ReportRead` + `NeuroScoringRead`.
- soporta plantillas `executive`, `creative` y `technical`.
- usa Playwright/Chromium server-side.
- valida overflow por pagina antes de generar PDF.
- genera PDF A4 con `print_background`.
- calcula hash SHA-256 de HTML y PDF.

El renderer principal es Playwright Python. Para QA local sin dependencia Python instalada existe fallback Node:

- `reporting/render-html-to-pdf.mjs`

### Storage y trazabilidad

`backend/app/repositories/reporting_db.py` ahora:

- calcula hash del asset original cuando existe.
- renderiza HTML/PDF antes de persistir el informe final.
- sube `report.html` y `report.pdf` a S3/R2.
- registra ambos artefactos en `storage_objects`.
- guarda `report_payload.server_pdf` con:
  - renderer.
  - page count.
  - hashes HTML/PDF.
  - bytes HTML/PDF.
  - storage keys.

El footer del PDF incluye:

- report ID.
- version/modelo TRIBE.
- version prompt.
- benchmark.
- paginacion.

### Descarga desde la app

Backend:

- `GET /v1/reports/{report_id}/download?format=pdf`
- `GET /v1/reports/{report_id}/download?format=html`

Frontend:

- si la sesion es API/Supabase, el boton PDF/HTML pide URL firmada al backend.
- si es local/demo, mantiene el generador frontend como fallback.

### Produccion

`backend/Dockerfile` instala:

```bash
python -m playwright install --with-deps chromium
```

Variables:

```bash
REPORT_RENDERER_MODE=playwright
REPORT_RENDERER_TIMEOUT_SECONDS=45
```

## Gate

```bash
cd frontend
npm run pdf:server-gate
```

El gate valida:

- renderer backend.
- plantillas ejecutivo/creativo/tecnico.
- footer trazable.
- hash de asset.
- subida prevista a storage.
- endpoint de descarga.
- uso desde frontend.
- Docker con Playwright/Chromium.
- PDF real generado con Playwright.

## Pendiente externo

Para cumplir el criterio con un run real completo hace falta tener S3/R2 configurado. Sin storage real, el backend puede crear el informe, pero no puede guardar ni servir los artefactos privados de produccion.
