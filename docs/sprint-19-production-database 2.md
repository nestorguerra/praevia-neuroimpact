# Sprint 19 · Base de datos de produccion

Fecha: 2026-05-02

## Objetivo

Mover la base del producto desde memoria/localStorage hacia PostgreSQL/Supabase con claves foraneas, indices y RLS por organizacion.

## Implementado

### Migraciones reales

Se movieron los SQL sueltos de `infra/sql` a migraciones reales:

- `backend/supabase/migrations/0010_benchmarks_kpis.sql`
- `backend/supabase/migrations/0011_enterprise_saas_v15.sql`

Tambien se anadio:

- `backend/supabase/migrations/0012_runtime_settings_and_scoring_view.sql`

Las nuevas migraciones incluyen:

- foreign keys a `organizations`, `assets`, `neuro_scoring_results`, etc.
- indices por organizacion, benchmark, prefix de API key y mes.
- RLS activado.
- policies por organizacion.
- `runtime_settings` persistente sin guardar secretos en claro.
- vista `scoring_results` como alias de compatibilidad sobre `neuro_scoring_results`.

### Repositorio DB

Se anadio repositorio PostgreSQL para el primer flujo funcional:

- `workspaces`
- `projects`
- `experiments`

Archivos:

- `backend/app/repositories/projects_db.py`
- `backend/app/repositories/projects_repository.py`

El backend selecciona persistencia con:

```env
PERSISTENCE_MODE=memory
PERSISTENCE_MODE=db
```

En local sigue `memory`; en staging/produccion queda `db`.

### Seguridad multi-tenant

El repositorio DB comprueba membership antes de listar o crear recursos:

```sql
select exists (
  select 1
  from public.memberships
  where organization_id = $organization_id
    and user_id = $current_user_id
)
```

Esto complementa RLS y evita aceptar `organization_id` manipulado desde rutas.

### Frontend

`useProjectStore` queda dual:

- sesion local/demo: usa `localStorage`.
- sesion Supabase: usa API real con bearer token.

Archivos:

- `frontend/src/projects/apiProjectStore.ts`
- `frontend/src/projects/useProjectStore.ts`

El wizard de proyectos ya soporta creacion asincrona contra API.

## Pendiente importante

Sprint 19 deja el patron real para proyectos. Aun falta migrar completamente a DB los stores de:

- assets/uploads.
- preprocessing jobs.
- analysis runs.
- scoring completo.
- reports.
- comparisons.
- benchmarks UI.
- admin/usage.
- collaboration/share links.
- enterprise settings.

Las tablas y RLS existen o quedan cubiertas por migraciones, pero no todos los stores frontend estan sustituidos por API real todavia. Esto debe cerrarse en los sprints 20-28 siguiendo el patron de proyectos.

## QA

Comandos:

```bash
cd frontend
npm run db:gate
npm run build
npm run env:gate
```

Con claves reales de Supabase, el criterio final sera:

1. aplicar migraciones 0001-0012 en Supabase.
2. crear usuario real.
3. crear proyecto desde `/app`.
4. reiniciar navegador/servidor.
5. verificar que proyecto sigue en DB.
6. verificar que otro usuario de otra organizacion no puede verlo.
