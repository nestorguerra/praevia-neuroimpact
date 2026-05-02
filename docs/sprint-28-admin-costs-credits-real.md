# Sprint 28 - Admin, costes y creditos reales

## Objetivo

Controlar margen y uso real antes de operar pilotos: saber cuanto cuesta cada analisis, quien lo lanzo, que recursos consume y si una organizacion puede seguir analizando.

## Lo implementado

- Snapshot admin ampliado con creditos, limites, coste, storage vivo y exports mensuales.
- `usage_events` reales para:
  - `asset_upload`
  - `preprocessing`
  - `tribe_run`
  - `scoring`
  - `report_generation`
  - `comparison_generation`
  - `secure_delete`
- Bloqueo de nuevos runs TRIBE si la organizacion supera caps.
- Export mensual backend para facturacion manual beta.
- UI admin actualizada a Sprint 28.
- Gate automatizado `scripts/admin-costs-gate.mjs`.

## Backend

Archivos principales:

- `backend/app/schemas/admin.py`
- `backend/app/repositories/admin_db.py`
- `backend/app/routes/admin.py`
- `backend/app/repositories/inference_db.py`
- `backend/app/repositories/uploads_db.py`
- `backend/app/repositories/preprocessing_db.py`
- `backend/supabase/migrations/0020_admin_costs_credits_real.sql`

Endpoint nuevo:

```http
POST /v1/admin/organizations/{organization_id}/monthly-usage-exports/{YYYY-MM}
```

El endpoint calcula desde DB y guarda en `monthly_usage_exports`. No depende del frontend para inventar el coste.

## Caps

Los caps se leen desde `organization_limits`:

- `monthly_credit_limit`
- `hard_credit_limit`
- `monthly_cost_limit_eur`
- `monthly_gpu_seconds_limit`
- `storage_byte_limit`
- `run_rate_limit_per_hour`
- `report_rate_limit_per_hour`
- `retention_days`

Si faltan filas de limite, se aplican defaults desde `organizations.credits` y variables de entorno.

## Costes

Variables nuevas:

```bash
STORAGE_EUR_PER_GB_MONTH=0.015
PLATFORM_EVENT_EUR=0.015
```

El coste total admin suma:

- coste estimado de eventos (`usage_events.estimated_cost_eur`).
- coste vivo de storage (`storage_objects` activos).

TRIBE usa `TRIBE_GPU_EUR_PER_SECOND`. LLM usa `LLM_INPUT_EUR_PER_1K` y `LLM_OUTPUT_EUR_PER_1K`.

## QA

```bash
cd frontend
npm run admin:costs-gate
npm run production:gate
```

## Criterio de aceptacion

Desde admin se puede ver:

- creditos usados y restantes.
- si la organizacion puede seguir analizando.
- coste estimado total y por capa.
- GPU seconds.
- tokens OpenAI.
- storage activo.
- usage ledger.
- export mensual para facturacion manual.

No se integra pasarela de pago en beta.
