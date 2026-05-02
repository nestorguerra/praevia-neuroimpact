# Sprint 29 - Observabilidad y seguridad

## Objetivo

Operar el producto sin ir a ciegas: cada fallo relevante de API, worker TRIBE, LLM o storage queda trazado, el panel admin lo muestra como evento accionable y la configuracion de produccion evita secretos en frontend.

## Implementado

- Sentry backend con `sentry-sdk[fastapi]`, trazas configurables y PII desactivada.
- Sentry frontend con `@sentry/react`, `ErrorBoundary` y `VITE_SENTRY_DSN`.
- Logs estructurados JSON con `request_id`, metodo, ruta, estado, latencia y rate-limit.
- Middleware unico de observabilidad y seguridad: `X-Request-ID`, `Retry-After`, headers de seguridad y HSTS cuando `FORCE_HTTPS=true`.
- Rate limiting basico por IP+ruta, con eventos persistidos en `rate_limit_events` cuando se puede inferir organizacion.
- Registro de errores persistente en `error_events` para API, worker, LLM y storage.
- Alertas de coste: si `COST_ALERT_THRESHOLD_EUR` esta configurado, o se supera el 80% del cap mensual, se crea un evento `source=cost`.
- Registro de snapshots de backup desde API admin y visualizacion en el panel admin.
- Gate automatico `observability:gate` para comprobar Sentry, logs, rate limits, CORS/HTTPS, secretos fuera de frontend y migracion.

## Variables nuevas

```env
SENTRY_DSN=
SENTRY_TRACES_SAMPLE_RATE=0.05
SENTRY_PROFILES_SAMPLE_RATE=0
STRUCTURED_LOGS=true
RATE_LIMIT_WINDOW_SECONDS=60
RATE_LIMIT_REQUESTS=120
COST_ALERT_THRESHOLD_EUR=250
VITE_SENTRY_DSN=
VITE_SENTRY_TRACES_SAMPLE_RATE=0.05
VITE_APP_ENV=production
```

Las claves privadas siguen siendo solo backend: `OPENAI_API_KEY`, `HF_TOKEN`, `RUNPOD_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `S3_SECRET_ACCESS_KEY` y `TRIBE_CALLBACK_SECRET` no deben aparecer en `frontend/src`.

## API / Admin

- `GET /ready` expone estado de Sentry, logs estructurados, rate limit y umbral de alerta de coste.
- `GET /v1/admin/organizations/{organization_id}/snapshot` incluye `error_events` y `backup_snapshots`.
- `POST /v1/admin/backup-snapshots` registra snapshots de DB o manifests de storage/reporting.

## Criterio de aceptacion

Un error de worker, API, LLM o storage queda registrado y accionable; las alertas de coste aparecen en admin; produccion tiene CORS estricto, HTTPS configurable, rate limiting, logs estructurados, audit logs, borrado seguro, backups trazables y secretos fuera del frontend.

## QA

```bash
cd frontend
npm run observability:gate
npm run production:gate
```

`production:gate` sigue necesitando que el frontend este servido en `http://localhost:5173` para smoke/E2E visuales.
