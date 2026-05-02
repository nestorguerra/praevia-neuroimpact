# Sprint 12 · Produccion staging/prod y hardening

Fecha: 2026-05-01

## Objetivo

Sacar el producto de "funciona en mi maquina" y dejarlo preparado como Production MVP controlado: entornos, HTTPS, CORS, secrets, smoke tests, E2E, visual regression, PDF regression, runbooks y cost cap.

## Implementado

### Entornos

Archivos:

- `.env.example`
- `.env.staging.example`
- `.env.production.example`
- `docs/deployment-staging-production-v0.1.md`

Variables nuevas:

- `CORS_ALLOWED_ORIGINS`
- `ALLOWED_HOSTS`
- `FORCE_HTTPS`
- `RETENTION_DAYS`
- `MONTHLY_COST_CAP_EUR`
- `MONTHLY_GPU_CAP_SECONDS`

### Backend hardening

Archivos:

- `backend/app/settings.py`
- `backend/app/main.py`

Implementado:

- settings por entorno desde env vars.
- CORS explicito.
- trusted hosts.
- HTTPS redirect opcional.
- security headers.
- `GET /health`.
- `GET /ready`.

Validado:

```text
health 200 {'status': 'ok'}
ready 200 ready local
security nosniff DENY
cors 200 http://localhost:5173
```

### Deploy

Archivos:

- `frontend/Dockerfile`
- `frontend/nginx.conf`
- `backend/Dockerfile`
- `infra/caddy/Caddyfile`
- `infra/docker-compose.staging.yml`
- `infra/docker-compose.production.yml`

Cubierto:

- frontend containerizado.
- backend containerizado.
- HTTPS por Caddy.
- staging separado.
- production separado.
- worker GPU mantiene `worker/tribe/Dockerfile`.
- storage/DB/Redis se configuran por env.

Dominio objetivo:

- Staging app: `https://staging.neuroimpact.praevia.ai`
- Staging API: `https://api-staging.neuroimpact.praevia.ai`
- Production app: `https://neuroimpact.praevia.ai`
- Production API: `https://api.neuroimpact.praevia.ai`

Estado real: dominio y HTTPS quedan listos por configuracion, pero no aprovisionados desde este entorno porque faltan DNS/credenciales.

### QA automatizado

Archivos:

- `scripts/smoke.mjs`
- `scripts/e2e-production-mvp.mjs`
- `scripts/visual-regression.mjs`
- `scripts/pdf-regression.mjs`
- `scripts/production-gate.mjs`
- `.github/workflows/production-gate.yml`

Scripts npm:

- `npm run smoke`
- `npm run e2e:production-mvp`
- `npm run visual:regression`
- `npm run pdf:regression`
- `npm run production:gate`

El gate completo ejecuta:

1. build frontend.
2. smoke frontend/API.
3. PDF regression.
4. visual regression.
5. E2E Production MVP.
6. Ruflo MCP checker.

### Operacion

Archivos:

- `docs/production-runbooks-v0.1.md`

Runbooks cubiertos:

- worker GPU caido.
- exceso de gasto GPU/LLM.
- borrado solicitado por cliente.
- PDF regression falla.
- visual regression falla.
- API no ready.
- incidente de seguridad.

## Demo de aceptacion

Comando:

```bash
node scripts/production-gate.mjs
```

Resultado:

```text
[production-gate] OK
```

E2E Production MVP probado:

```json
{
  "ok": true,
  "reportHead": "%PDF-1.4",
  "beforeAssets": 3,
  "afterAssets": 2,
  "deleted": true,
  "usageEvents": 14,
  "auditText": true
}
```

PDF regression:

```json
{
  "ok": true,
  "pdfHead": "%PDF-1.4",
  "pdfBytes": 181768,
  "pages": 4
}
```

Visual regression:

```json
{
  "ok": true,
  "count": 8
}
```

Smoke:

- landing: 200.
- app privada: 200.
- admin: 200.
- design hub: 200.
- API marcada como warning local si no hay backend levantado en `localhost:8000`.

## Artefactos QA

- `/tmp/praevia-neuroimpact-qa/sprint12-e2e-report.pdf`
- `/tmp/praevia-neuroimpact-qa/sprint12-admin-snapshot.json`
- `/tmp/praevia-neuroimpact-qa/sprint12-e2e-admin-after-delete.png`
- `/tmp/praevia-neuroimpact-qa/sprint12-pdf-regression.pdf`
- `/tmp/praevia-neuroimpact-qa/sprint12-pdf-regression.html`
- `/tmp/praevia-neuroimpact-qa/sprint12-visual-manifest.json`
- `/tmp/praevia-neuroimpact-qa/sprint12-visual-*.png`

## QA final

- `npm run build`: OK.
- Python compile backend/workers: OK.
- `node --check scripts/*.mjs reporting/*.mjs`: OK.
- Backend `/health`, `/ready`, CORS y security headers con TestClient: OK.
- `node scripts/production-gate.mjs`: OK.
- Ruflo MCP checker: OK, 237 tools detectadas.

## Limitaciones

- No hay despliegue real con dominio publico porque faltan DNS, secretos y proveedor final.
- API publica no esta levantada en `localhost:8000` durante el smoke local; el gate permite warning con `ALLOW_MISSING_API=true`.
- Worker GPU real sigue pendiente de proveedor, GPU, Docker runtime y `HF_TOKEN`.
- Backups y Sentry quedan documentados/configurados por env, pero no conectados a proveedor real.

## Gate

Production MVP queda cumplido a nivel de repo y QA local automatizada.

Para considerarlo Production MVP publico falta aprovisionar:

- DNS.
- certificados via Caddy en host real.
- `.env.staging` y `.env.production` reales.
- DB y buckets por entorno.
- worker GPU real.
- secrets manager.
