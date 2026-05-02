# Sprint 2 · Auth, organizaciones y app shell

Fecha: 2026-05-01

## Objetivo

Tener app privada real con login, registro, recuperacion visual, organizacion, rol owner, creditos, topbar, rail lateral, breadcrumbs, avatar y logout.

## Implementado

- Rutas:
  - `/login`
  - `/register`
  - `/forgot`
  - `/app`
  - `/app/design-system`
- Auth local persistente con `localStorage`.
- Registro con email corporativo y creacion automatica de organizacion.
- Login local para pruebas.
- Logout real.
- App shell privado:
  - marca PraevIA/NeuroImpact.
  - left rail por grupos: Principal, Insights, Cuenta.
  - topbar con organizacion, breadcrumbs, plan, creditos, avatar y logout.
  - workspace dashboard.
- SQL Supabase preparado:
  - `profiles`
  - `organizations`
  - `memberships`
  - roles owner/admin/analyst/viewer.
  - RLS por organizacion.
  - trigger de alta de usuario y organizacion.

## Decision tecnica

Sprint 2 funciona en local sin Supabase para poder probar el producto ya. La migracion SQL queda lista en:

`backend/supabase/migrations/0001_auth_organizations.sql`

Cuando tengamos proyecto Supabase, sustituiremos `localAuth.ts` por un provider real manteniendo el mismo contrato de `AuthContext`.

## QA

Realizado:

- `npm run build`: OK.
- Smoke Playwright de registro: OK.
- Creacion local de organizacion: OK.
- Entrada a `/app`: OK.
- Visualizacion de creditos y plan: OK.
- Logout: OK.
- Proteccion de `/app` sin sesion: OK.
- Mobile register 390px sin overflow horizontal: OK.
- Revision visual desktop/mobile: OK.

## Limitaciones

- No hay auth real todavia.
- No hay MFA real todavia.
- No hay Supabase conectado.
- RLS esta preparado en SQL, pero no aplicado en una base real.

## Capturas QA

Capturas temporales generadas durante la validacion:

- `/tmp/praevia-neuroimpact-qa/sprint2-login.png`
- `/tmp/praevia-neuroimpact-qa/sprint2-app-fixed.png`
- `/tmp/praevia-neuroimpact-qa/sprint2-register-mobile.png`
