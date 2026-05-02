# Sprint 18 · Auth real y seguridad base

Fecha: 2026-05-02

## Objetivo

Sustituir la autenticacion local por Supabase Auth en entornos reales y bloquear el backend privado si no hay sesion JWT valida.

## Implementado

### Frontend

- `@supabase/supabase-js` integrado.
- `VITE_AUTH_MODE=local|supabase`.
- `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
- Registro con email corporativo, password y organizacion.
- Login con password.
- Recuperacion de password por email.
- Hidratacion de usuario desde `profiles`, `memberships` y `organizations`.
- Sesion con access token de Supabase.
- Logout mediante Supabase.
- Bloqueo de `/app/*` si no hay sesion.
- Estado de carga mientras se valida la sesion.
- Modo local conservado solo para desarrollo/demo explicito.

### Backend

- Dependencia `require_auth`.
- Validacion de bearer JWT con `SUPABASE_JWT_SECRET` o `JWT_SECRET`.
- Endpoints privados protegidos por dependencia global.
- `/health`, `/ready` y alta de demo request permanecen publicos.
- Listado de demo requests protegido.
- `/ready` expone estado de auth sin revelar secretos.

### Variables nuevas

- `AUTH_MODE`
- `SUPABASE_JWT_SECRET`
- `VITE_AUTH_MODE`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Modo local

Para desarrollo sin claves reales:

```env
AUTH_MODE=local
VITE_AUTH_MODE=local
```

Esto mantiene la demo usable, pero no debe usarse en staging ni produccion.

## Modo produccion

Para staging/produccion:

```env
AUTH_MODE=supabase
VITE_AUTH_MODE=supabase
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## MFA

Supabase Auth soporta MFA. Sprint 18 deja el producto preparado a nivel de proveedor, pero la UI de enrolamiento/verificacion MFA queda para hardening enterprise si el piloto lo exige.

## Limitaciones que quedan para Sprint 19

El backend valida sesion JWT y bloquea anonimos. La comprobacion fuerte de pertenencia a organizacion por cada recurso debe cerrarse cuando los repositorios de memoria pasen a PostgreSQL/Supabase con RLS real.

Hasta Sprint 19, no considerar el backend multi-tenant production-ready aunque ya rechace llamadas sin token.

## QA

Comandos:

```bash
cd frontend
npm run auth:gate
npm run build
```

Criterio:

- Ruta privada sin bearer token devuelve `401` en modo supabase.
- Demo request publico sigue funcionando.
- Build frontend pasa.
