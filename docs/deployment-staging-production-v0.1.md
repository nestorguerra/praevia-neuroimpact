# Deployment staging/production v0.1

Fecha: 2026-05-01

## Objetivo

Separar local, staging y produccion con una ruta de despliegue controlada para frontend, backend, worker GPU, storage y DB.

## Entornos

| Entorno | URL app | URL API | Uso |
| --- | --- | --- | --- |
| local | `http://localhost:5173` | `http://localhost:8000` | desarrollo y QA local |
| staging | `https://staging.neuroimpact.praevia.ai` | `https://api-staging.neuroimpact.praevia.ai` | demos internas y pruebas pre-piloto |
| production | `https://neuroimpact.praevia.ai` | `https://api.neuroimpact.praevia.ai` | pilotos controlados |

El repo incluye `.env.staging.example` y `.env.production.example`. Los ficheros reales `.env.staging` y `.env.production` no deben versionarse.

## Componentes

- Frontend: `frontend/Dockerfile`, sirve Vite build con Nginx.
- Backend: `backend/Dockerfile`, sirve FastAPI con Uvicorn.
- HTTPS/proxy: `infra/caddy/Caddyfile`.
- Staging compose: `infra/docker-compose.staging.yml`.
- Production compose: `infra/docker-compose.production.yml`.
- Worker GPU: `worker/tribe/Dockerfile` y `infra/tribe-worker-deployment.md`.
- Storage: S3/R2 por entorno.
- DB: PostgreSQL/Supabase por entorno.

## Comandos

Staging:

```bash
cp .env.staging.example .env.staging
# editar secretos reales
docker compose -f infra/docker-compose.staging.yml up -d --build
```

Produccion:

```bash
cp .env.production.example .env.production
# editar secretos reales
IMAGE_TAG=v1.0.0 docker compose -f infra/docker-compose.production.yml up -d
```

## DNS y HTTPS

Caddy emite certificados automaticamente cuando:

- `staging.neuroimpact.praevia.ai` apunta al host staging.
- `api-staging.neuroimpact.praevia.ai` apunta al host staging.
- `neuroimpact.praevia.ai` apunta al host production.
- `api.neuroimpact.praevia.ai` apunta al host production.
- Puertos 80 y 443 estan abiertos.

Estado actual: dominio objetivo documentado, pero no aprovisionado desde este entorno porque faltan DNS/credenciales reales.

## Variables criticas

- `FORCE_HTTPS=true` en staging/prod.
- `CORS_ALLOWED_ORIGINS` con solo la URL de app del entorno.
- `ALLOWED_HOSTS` con solo hostnames de API del entorno.
- `JWT_SECRET` diferente por entorno.
- `HF_TOKEN` solo en worker/entorno seguro.
- `OPENAI_API_KEY` y `ANTHROPIC_API_KEY` solo en backend/LLM router.
- `MONTHLY_COST_CAP_EUR` y `MONTHLY_GPU_CAP_SECONDS` configurados antes de cualquier piloto.

## Health checks

- `GET /health`: vida basica.
- `GET /ready`: readiness operativa no sensible.
- Smoke frontend: `node scripts/smoke.mjs`.
- Gate completo: `node scripts/production-gate.mjs`.

## Gate de paso a production

No se promueve una build si falla cualquiera de estos pasos:

```bash
npm --prefix frontend run build
python -m compileall backend/app worker/preprocessing worker/tribe/tribe_worker worker/scoring
ALLOW_MISSING_API=false APP_SMOKE_URL=https://neuroimpact.praevia.ai API_SMOKE_URL=https://api.neuroimpact.praevia.ai node scripts/smoke.mjs
APP_E2E_URL=https://neuroimpact.praevia.ai node scripts/e2e-production-mvp.mjs
node scripts/pdf-regression.mjs
APP_VISUAL_URL=https://neuroimpact.praevia.ai node scripts/visual-regression.mjs
```

Para staging puede usarse `ALLOW_MISSING_API=true` solo mientras el backend publico no este levantado.
