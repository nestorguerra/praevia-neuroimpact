# Sprint 11 · Admin, creditos, costes y seguridad de produccion

Fecha: 2026-05-01

## Objetivo

Controlar el producto como negocio antes de pilotos: saber cuanto cuesta cada analisis, quien lo lanzo, que archivos toca, cuantos tokens consume, cuantos creditos descuenta y como borrar un asset con todos sus derivados.

## Implementado

### DB

Migracion preparada:

`backend/supabase/migrations/0009_admin_usage_security.sql`

Incluye:

- `organization_limits`
- `usage_events`
- `credit_ledger`
- `audit_logs`
- `secure_deletion_requests`
- `rate_limit_events`
- `error_events`
- `backup_snapshots`
- indices por organizacion/fecha.
- RLS por organizacion.

### Backend

Contrato FastAPI preparado:

- `backend/app/schemas/admin.py`
- `backend/app/repositories/admin_memory.py`
- `backend/app/routes/admin.py`

Endpoints:

- `POST /v1/admin/usage-events`
- `POST /v1/admin/audit-logs`
- `POST /v1/admin/secure-delete`
- `GET /v1/admin/organizations/{organization_id}/snapshot`

La API en memoria permite probar el contrato sin Supabase real. En produccion, estos eventos deben escribirse desde los jobs de upload, preprocessing, TRIBE, scoring, reporting, comparativa y borrado.

### Frontend

Nueva vista privada:

- `/app/admin`

Archivos principales:

- `frontend/src/pages/AdminPage.tsx`
- `frontend/src/admin/types.ts`
- `frontend/src/admin/buildAdminSnapshot.ts`
- `frontend/src/admin/localAdminStore.ts`
- `frontend/src/admin/secureDelete.ts`
- `frontend/src/components/layout/AppShell.tsx`
- `frontend/src/styles/app.css`

La pantalla incluye:

- creditos consumidos/restantes.
- coste estimado total.
- desglose GPU, LLM, storage y plataforma.
- tokens LLM.
- storage vivo.
- runs lanzados.
- errores abiertos.
- ledger de usage events.
- panel de borrado seguro por asset.
- limites operativos: rate limit, TTL de URL firmada, retencion, backups y RLS.
- audit log.
- export de snapshot admin JSON.

### Borrado seguro local

El borrado seguro elimina del estado local:

- asset original.
- preprocessing jobs.
- derivatives/storage keys.
- analysis runs.
- prediction artifacts.
- scoring results.
- reports HTML/PDF.
- comparativas A/B/C asociadas.

Tambien deja:

- `DeletedAssetRecord`.
- audit log `secure_delete.completed`.
- usage event `secure_delete`.

## Demo de aceptacion

Flujo probado con Playwright:

1. Registro local.
2. Upload de tres assets `.txt`.
3. Preparar inputs TRIBE.
4. Lanzar TRIBE mock contractual.
5. Calcular scoring para las tres versiones.
6. Generar informe desde `/app/results`.
7. Descargar informe PDF.
8. Generar comparativa A/B/C.
9. Abrir `/app/admin`.
10. Ver creditos, costes, usage events, audit logs y limites.
11. Exportar snapshot admin JSON.
12. Borrar un asset y sus derivados.
13. Confirmar que assets activos bajan de 3 a 2 y aparece `secure_delete.completed`.

Resultado:

```json
{
  "before": {
    "stats": 6,
    "usageRows": 14,
    "runCards": 3,
    "auditRows": 5,
    "assetOptions": 3
  },
  "after": {
    "assetOptions": 2,
    "usageRows": 9,
    "auditRows": 4,
    "hasDeleteAudit": true
  },
  "reportHead": "%PDF-1.4"
}
```

API validada en entorno temporal:

```text
POST /v1/admin/usage-events -> 200
POST /v1/admin/audit-logs -> 200
POST /v1/admin/secure-delete -> 200
GET /v1/admin/organizations/{organization_id}/snapshot -> 200
```

Artefactos QA:

- `/tmp/praevia-neuroimpact-qa/sprint11-report.pdf`
- `/tmp/praevia-neuroimpact-qa/sprint11-admin-snapshot.json`
- `/tmp/praevia-neuroimpact-qa/sprint11-admin-before-delete.png`
- `/tmp/praevia-neuroimpact-qa/sprint11-admin-after-delete.png`
- `/tmp/praevia-neuroimpact-qa/sprint11-admin-mobile.png`

## QA

- `npm run build`: OK.
- `python3 -m compileall backend/app worker/preprocessing worker/tribe/tribe_worker worker/scoring`: OK.
- FastAPI admin endpoints: OK en venv temporal.
- Flujo UI completo: OK.
- Informe PDF descargado: OK, `%PDF-1.4`.
- Admin snapshot JSON descargado: OK.
- Borrado seguro local: OK.
- Desktop 1440px: OK, sin overflow horizontal.
- Mobile 390px: OK, sin overflow horizontal.
- Ruflo MCP checker: OK, 237 tools detectadas.

## Limitaciones

- El coste GPU usa coste estimado local hasta conectar proveedor real.
- El coste LLM se estima desde tokens del informe; en modo local no llama a APIs externas.
- El borrado seguro elimina estado local y storage keys simuladas; en produccion debe llamar a S3/R2 y dejar manifiesto firmado.
- Rate limiting, Sentry, backups y retention quedan como contrato y visualizacion; falta conectar middleware/servicios reales en Sprint 12.
- El topbar sigue mostrando creditos asignados de la sesion; el consumo real se muestra en `/app/admin`.

## Criterio de aceptacion

Cumplido para MVP interno:

- se puede saber cuanto cuesta cada demo.
- se pueden ver creditos consumidos.
- se pueden ver GPU seconds, tokens y storage.
- se puede ver quien lanzo runs/informes.
- se puede descargar snapshot admin.
- se puede borrar un asset con derivados e informe.
- el borrado queda auditado.
