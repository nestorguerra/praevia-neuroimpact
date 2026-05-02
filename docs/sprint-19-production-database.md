# Sprint 19 · Base de datos de produccion

Fecha: 2026-05-02

## Objetivo

Mover la persistencia funcional del producto a PostgreSQL/Supabase: proyectos, assets, jobs, runs, scoring, informes, comparativas, benchmarks, admin/uso, enterprise y runtime settings.

## Implementado

### Migraciones reales

La base de datos productiva vive en `backend/supabase/migrations/`.

Tablas cubiertas:

- `profiles`, `organizations`, `memberships`
- `workspaces`, `projects`, `experiments`
- `assets`, `asset_versions`, `upload_sessions`
- `preprocessing_jobs`, `asset_derivatives`
- `analysis_runs`, `prediction_artifacts`
- `neuro_scoring_results`, `editorial_scores`, `region_scores`, `network_scores`, `timecourse_points`, `peak_moments`
- `reports`, `report_sections`
- `comparison_runs`, `comparison_items`, `comparison_metric_deltas`, `comparison_timepoint_deltas`, `comparison_mix_segments`
- `benchmarks`, `benchmark_items`, `external_kpis`
- `usage_events`, `audit_logs`, `secure_deletion_requests`
- `organization_api_keys`, `organization_retention_policies`, `organization_sso_configs`, `monthly_usage_exports`
- `runtime_settings`

Compatibilidad de nombres del roadmap:

- `scoring_results` es una vista sobre `neuro_scoring_results`.
- `comparisons` es una vista sobre `comparison_runs`.

Todas las tablas principales tienen foreign keys, indices y RLS por organizacion. Las rutas backend tambien validan membership/admin en aplicacion, porque el backend puede conectar con `DATABASE_URL` directo y no debe fiarse solo de RLS.

### Repositorios DB

Se anadio una capa comun:

- `backend/app/repositories/db.py`

Y repositorios DB/selector para:

- proyectos
- uploads/assets
- preprocessing
- inference/runs
- scoring
- reports
- comparisons
- benchmarks
- admin
- enterprise
- runtime settings

El switch de persistencia:

```env
PERSISTENCE_MODE=memory
PERSISTENCE_MODE=db
```

En local se puede seguir usando demo/memory. En staging y produccion debe ir `PERSISTENCE_MODE=db`.

### Frontend

Cuando la sesion es Supabase, la app usa API real para:

- proyectos/workspaces/experimentos
- assets/upload intents y asset listing
- preprocessing jobs
- analysis runs
- scoring
- reports
- runtime settings

Cuando la sesion es local/demo, la app conserva `localStorage` solo como modo beta/demo.

## Seguridad

Cada operacion DB comprueba:

- usuario autenticado por JWT Supabase.
- membership real en `memberships`.
- rol admin/owner para operaciones sensibles: API keys, retention policy, secure delete y runtime settings.

`runtime_settings` no guarda secretos en claro. Guarda referencias y flags de configuracion. Las API keys reales deben ir en secret vault o variables de entorno del backend/proveedor.

## Pendiente antes de aplicar en cliente real

Falta ejecutar las migraciones en una instancia Supabase real. Para cerrar el criterio multi-tenant con datos reales necesito:

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`

Tambien siguen en modo local/demo algunas areas no criticas para Sprint 19:

- colaboracion/share viewer de Sprint 14
- marketing/demo lead store publico
- algunos gates visuales siguen usando `localStorage` para preparar fixtures de QA

## QA

Comandos ejecutados:

```bash
cd frontend
npm run db:gate
npm run build
npm run env:gate
npm run production:gate
```

Backend:

```bash
python3 -m compileall -q backend worker
python3 scripts/auth-gate.py
```

Resultado: gates en verde en modo local/test. La validacion final contra Supabase real queda bloqueada hasta tener las claves y aplicar migraciones.
