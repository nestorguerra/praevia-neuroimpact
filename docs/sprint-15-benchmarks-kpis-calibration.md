# Sprint 15 · Benchmarks, KPIs externos y calibracion

## Estado

Implementado a nivel repo/local y validado con gate automatizado.

## Objetivo

Empezar a construir el moat del producto: benchmarks privados por categoria, percentiles internos y KPIs reales posteriores para calibrar el valor predictivo de los scores.

## Entregables implementados

- Ruta privada `/app/benchmarks`.
- Benchmark interno demo: `Banca / CTV / 30s`.
- Tabla local de benchmarks.
- Tabla local de `benchmark_items`.
- Tabla local de `external_kpis`.
- SQL base en `infra/sql/0010_benchmarks_kpis.sql`.
- Asignacion de pieza nueva al benchmark.
- Calculo de percentiles por score.
- Import manual de KPI real: VTR, CTR, retencion, brand lift, encuesta o feedback evento.
- Vista exploratoria score vs KPI.
- Correlacion Pearson exploratoria.
- Export PDF/JSON/CSV del benchmark aplicado.
- Backend contract preparado en `/v1/benchmarks/*`.
- Gate automatizado `npm run benchmark:gate`.

## Backend preparado

- `GET /v1/benchmarks/{organization_id}`
- `POST /v1/benchmarks`
- `POST /v1/benchmark-items`
- `POST /v1/external-kpis`

## Criterio de aceptacion

Validado con `scripts/benchmark-gate.mjs`:

1. Registro local.
2. Abrir `/app/benchmarks`.
3. Crear/usar benchmark `Banca / CTV / 30s`.
4. Asignar una pieza nueva al benchmark.
5. Importar KPI VTR manual.
6. Ver percentil interno NRI.
7. Ver score vs KPI real.
8. Exportar PDF de calibracion.

## Artefactos QA

- `/tmp/praevia-neuroimpact-qa/sprint15-benchmarks.png`
- `/tmp/praevia-neuroimpact-qa/sprint15-benchmark-gate.json`
- `/tmp/praevia-neuroimpact-qa/sprint15-benchmark-calibration.pdf`

## Lectura de producto

Los scores absolutos tienen valor limitado. El producto empieza a ser dificil de sustituir cuando cada cliente construye benchmarks propios y puede ver:

- Score de pieza nueva.
- Percentil contra categoria comparable.
- Delta contra media interna.
- KPI real posterior.
- Tendencia exploratoria score vs resultado real.

## Limites

La correlacion es exploratoria. No implica causalidad, no predice compra y no sustituye brand lift, estudios con usuarios ni medicion de campana. Sirve para calibrar hipotesis creativas con historico privado del cliente.

## Pendiente para produccion real

- Persistir en PostgreSQL con RLS.
- Import CSV/XLSX de KPIs.
- Validacion de categorias comparables antes de asignar runs.
- Benchmark por workspace/cliente con permisos.
- Percentiles robustos con muestra minima configurable.
- PDF integrado en el motor HTML print-first.
