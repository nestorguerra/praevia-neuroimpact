# Sprint 31 - Staging + Produccion

## Objetivo

Desplegar de verdad con entornos separados: local, staging y produccion con variables, DB, buckets, worker, dominios, certificados y secretos separados.

## Estrategia elegida

Base operativa: Docker Compose en una VM por entorno o en dos directorios completamente separados si se usa la misma maquina.

- Imagenes: GHCR.
- Proxy y HTTPS: Caddy con certificados automaticos.
- DB/Auth: Supabase/PostgreSQL separados por entorno.
- Storage: buckets R2/S3 separados.
- Worker TRIBE: endpoint RunPod separado.
- Deploy automatico: GitHub Actions.
- Rollback: symlink `current` a un release anterior y `docker compose up -d`.

## Entornos

| Entorno | Compose | Env file | Dominio app | Dominio API | Bucket |
| --- | --- | --- | --- | --- | --- |
| Local | `infra/docker-compose.local.yml` | `.env.example` | `localhost:5173` | `localhost:8000` | `neuroimpact-local` |
| Staging | `infra/docker-compose.staging.yml` | `.env.staging` | `staging.neuroimpact.praevia.ai` | `api-staging.neuroimpact.praevia.ai` | `praevia-neuroimpact-staging` |
| Produccion | `infra/docker-compose.production.yml` | `.env.production` | `app.neuroimpact.praevia.ai` | `api.neuroimpact.praevia.ai` | `praevia-neuroimpact-production` |

Los valores de dominio son placeholders operativos. Antes de activar deploy real hay que apuntar DNS A/AAAA o CNAME al host elegido.

## Workflows

- `.github/workflows/production-gate.yml`: CI estricto. No despliega.
- `.github/workflows/deploy-staging.yml`: despliega staging automaticamente cuando `Production Gate` termina bien en `main`; tambien permite lanzamiento manual.
- `.github/workflows/deploy-production.yml`: despliega produccion desde release publicado o manualmente.
- `.github/workflows/rollback.yml`: rollback manual de staging o produccion a un release existente.

## Secretos necesarios en GitHub

Staging:

```text
STAGING_DEPLOY_HOST
STAGING_DEPLOY_USER
STAGING_DEPLOY_PORT
STAGING_DEPLOY_SSH_KEY
STAGING_DEPLOY_ROOT
STAGING_ENV_FILE
STAGING_READINESS_TOKEN
```

Produccion:

```text
PRODUCTION_DEPLOY_HOST
PRODUCTION_DEPLOY_USER
PRODUCTION_DEPLOY_PORT
PRODUCTION_DEPLOY_SSH_KEY
PRODUCTION_DEPLOY_ROOT
PRODUCTION_ENV_FILE
PRODUCTION_READINESS_TOKEN
```

Registry:

```text
GHCR_USERNAME
GHCR_PAT
```

Variables publicas de repo o environment:

```text
GHCR_IMAGE_NAMESPACE
STAGING_APP_PUBLIC_URL
STAGING_API_PUBLIC_URL
STAGING_VITE_API_PUBLIC_URL
STAGING_VITE_SUPABASE_URL
STAGING_VITE_SUPABASE_ANON_KEY
STAGING_VITE_SENTRY_DSN
PRODUCTION_APP_PUBLIC_URL
PRODUCTION_API_PUBLIC_URL
PRODUCTION_VITE_API_PUBLIC_URL
PRODUCTION_VITE_SUPABASE_URL
PRODUCTION_VITE_SUPABASE_ANON_KEY
PRODUCTION_VITE_SENTRY_DSN
```

## Deploy manual desde tu maquina

```bash
DEPLOY_ENV=staging \
DEPLOY_HOST=staging-host \
DEPLOY_USER=deploy \
IMAGE_TAG=staging-abc123 \
ENV_FILE_SOURCE=.env.staging \
GHCR_USERNAME=usuario \
GHCR_PAT=token \
scripts/deploy-remote-compose.sh
```

## Rollback manual

```bash
DEPLOY_ENV=production \
DEPLOY_HOST=production-host \
DEPLOY_USER=deploy \
ROLLBACK_TO=production-abc123 \
scripts/rollback-remote-compose.sh
```

## Gate

```bash
cd frontend
npm run deploy:gate
```

Este gate comprueba:

- staging y produccion usan imagenes publicadas, no builds locales.
- los dominios y certificados pasan por Caddy.
- las variables de DB, storage, worker, callback, bucket y CORS son distintas.
- el worker mock esta desactivado en staging/produccion.
- los scripts de deploy y rollback existen.
- los workflows de deploy y rollback existen.

## Bloqueo actual

El codigo ya esta preparado para desplegar, pero el despliegue real queda bloqueado hasta tener:

- host SSH para staging y produccion,
- DNS apuntando a esos hosts,
- secretos GitHub cargados,
- `.env.staging` y `.env.production` reales,
- DB Supabase/PostgreSQL separadas,
- buckets R2/S3 separados,
- endpoints RunPod separados.

Sin esos datos no se puede cumplir literalmente el criterio de aceptacion en internet, pero el pipeline ya impide marcar como OK una produccion sin dependencias vivas.
