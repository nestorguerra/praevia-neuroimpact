# ADR 0002 · Reporting HTML print-first

## Estado

Aceptado para Sprint 0.

## Contexto

El PDF no es un accesorio. En clientes corporativos, el informe circula por comites, agencias, marketing, eventos y direccion.

Ya existe `design/source/report.html` como plantilla A4 print-first con identidad PraevIA, scores, timeline, decision, recomendaciones y metodologia.

## Decision

Generar informes con:

- HTML/CSS versionado.
- Tokens compartidos.
- Playwright/Chromium para PDF.
- Snapshot HTML inmutable por informe.
- PDF inmutable por informe.

ReportLab o scripts previos quedan como referencia, no como motor principal de producto.

## Consecuencias

Ventajas:

- Misma identidad visual en app, preview y PDF.
- Mejor control de layout A4.
- Facilidad para hacer QA visual y regression PDF.

Costes:

- Hay que cuidar fuentes, saltos de pagina y rendering en CI.
- Hay que almacenar snapshots para reproducibilidad.

## Revision

Revisar al terminar Sprint 9, cuando se genere el primer PDF desde un run real.

