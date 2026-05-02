# Sprint 21 · Backend API Real

## Objetivo

Que la app privada use API real cuando la sesion viene de Supabase, manteniendo fallback local solo para demo sin backend.

## Cambios entregados

- Cliente API compartido en `frontend/src/api/client.ts`.
- Benchmarks conectados a `/v1/benchmarks`, `/v1/benchmark-items` y `/v1/external-kpis`.
- Comparativas conectadas a `/v1/experiments/{experiment_id}/comparisons` y `/v1/comparisons`.
- Workflow creativo conectado a `/v1/collaboration/*`.
- Enterprise conectado a `/v1/enterprise/*` y snapshot admin real.
- Admin conectado a `/v1/admin/organizations/{organization_id}/snapshot`.
- Repositorio DB real para workflow y migracion `0016_backend_api_real_collaboration.sql`.
- Gate `backend-api:gate` para evitar regresiones a pantallas solo-locales.

## Criterio de aceptacion

- Con `AUTH_MODE=supabase` y `PERSISTENCE_MODE=db`, las pantallas principales leen/escriben contra backend.
- Con modo local/demo, la app sigue operativa sin Supabase para demos rapidas.
- El backend no importa repositorios memory directamente en rutas criticas.
- Las tablas de workflow tienen RLS y policies por organizacion.

## Verificacion

```bash
cd frontend
npm run backend-api:gate
npm run db:gate
npm run build
```

## Pendiente para prueba real

Hace falta aplicar las migraciones en Supabase y configurar secretos reales:

- `VITE_AUTH_MODE=supabase`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_PUBLIC_URL`
- `DATABASE_URL`
- `SUPABASE_JWT_SECRET` o JWKS configurado

Sin esas claves, el gate valida contratos y wiring, pero no puede hacer prueba live autenticada contra Supabase.
