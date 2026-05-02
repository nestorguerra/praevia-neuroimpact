# Sprint 17 · Decisiones de infraestructura de produccion

Fecha: 2026-05-02

## Objetivo

Cerrar la arquitectura real de produccion antes de empezar a sustituir mocks por servicios reales.

Este sprint no anade funcionalidad visible. Deja decididos los proveedores, entornos, secretos, limites de gasto y criterios de paso para que Sprint 18 pueda empezar auth real sin improvisar.

## Decision final recomendada

| Capa | Decision Sprint 17 | Motivo |
| --- | --- | --- |
| Frontend privado y landing | Vercel | Encaja bien con React/Vite, previews por rama y despliegue rapido. |
| Backend FastAPI | Render Web Service | Soporta Python/FastAPI, dominios propios y red privada entre servicios. |
| DB/Auth | Supabase Auth + PostgreSQL | Auth integrada con Postgres y RLS por organizacion. |
| Storage | Cloudflare R2 | API S3-compatible, buckets por entorno y coste controlado para assets pesados. |
| Queue | Upstash Redis | Redis gestionado, sencillo para staging/produccion inicial. |
| Worker GPU TRIBE | RunPod Serverless o Google Cloud Run GPU | RunPod es mas rapido para beta barata; Google Cloud es mejor si priorizamos procurement enterprise. |
| LLM | OpenAI Responses API | API unica para interpretacion/redaccion con salida estructurada. |
| Observabilidad | Sentry | Errores frontend/backend y trazabilidad inicial de fallos. |
| Email transaccional | Resend | API simple para emails de producto: auth, notificaciones y pilotos. |
| Billing | Manual | Beta sin pasarela de pago. Export mensual de uso y facturacion manual. |

## Fuentes oficiales verificadas

- Supabase Auth y RLS: https://supabase.com/docs/guides/auth y https://supabase.com/docs/guides/database/postgres/row-level-security
- Cloudflare R2 S3 API: https://developers.cloudflare.com/r2/api/s3/
- RunPod Serverless: https://docs.runpod.io/serverless/quick-deploys
- Google Cloud Run GPU: https://cloud.google.com/run/docs/configuring/services/gpu
- Upstash Redis REST API: https://upstash.com/docs/redis/features/restapi
- Render Web Services: https://render.com/docs/web-services
- Vercel + Vite: https://vercel.com/docs/frameworks/frontend/vite
- OpenAI Responses API: https://platform.openai.com/docs/api-reference/responses
- Resend API: https://resend.com/docs/api-reference/introduction

## Entornos

| Entorno | Dominio | Uso | Datos | Worker |
| --- | --- | --- | --- | --- |
| Local | `http://localhost:5173` | Desarrollo y demo mock | Datos locales/no sensibles | Mock por defecto |
| Staging | `https://staging.neuroimpact.<dominio>` | QA, demos internas y pilotos simulados | Datos de prueba o cliente con permiso explicito | GPU remoto opcional |
| Produccion | `https://app.neuroimpact.<dominio>` | Pilotos reales | Datos reales bajo contrato | GPU remoto obligatorio |

## Politica de secretos

No se guardan secretos reales en git.

En local se puede usar `.env` no versionado. En staging/produccion, las claves deben vivir en el secret manager del proveedor:

- Vercel Environment Variables para frontend publico no sensible.
- Render Environment Variables para backend.
- RunPod secrets/environment o Google Secret Manager para worker GPU.
- Supabase dashboard para DB/Auth.
- Cloudflare dashboard/API token para R2.

## Secretos necesarios

| Variable | Servicio | Local | Staging | Produccion |
| --- | --- | --- | --- | --- |
| `SUPABASE_URL` | Supabase | opcional | obligatorio | obligatorio |
| `SUPABASE_ANON_KEY` | Supabase | opcional | obligatorio | obligatorio |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | opcional backend | obligatorio backend | obligatorio backend |
| `SUPABASE_JWT_SECRET` | Supabase | opcional local | obligatorio backend | obligatorio backend |
| `VITE_SUPABASE_URL` | Supabase | opcional local | obligatorio frontend | obligatorio frontend |
| `VITE_SUPABASE_ANON_KEY` | Supabase | opcional local | obligatorio frontend | obligatorio frontend |
| `DATABASE_URL` | Supabase/Postgres | local DB o Supabase | obligatorio | obligatorio |
| `REDIS_URL` | Upstash Redis | local Redis | obligatorio | obligatorio |
| `STORAGE_MODE` | Storage adapter | `auto` | `s3` | `s3` |
| `S3_ENDPOINT` | Cloudflare R2 | MinIO/R2 | obligatorio | obligatorio |
| `S3_BUCKET` | Cloudflare R2 | local bucket | obligatorio | obligatorio |
| `S3_ACCESS_KEY_ID` | Cloudflare R2 | local key | obligatorio | obligatorio |
| `S3_SECRET_ACCESS_KEY` | Cloudflare R2 | local secret | obligatorio | obligatorio |
| `S3_CREATE_BUCKET_IF_MISSING` | Storage adapter | `true` | `false` | `false` |
| `GPU_PROVIDER_API_KEY` | RunPod | opcional | obligatorio si RunPod remoto | obligatorio si RunPod |
| `GCP_PROJECT_ID` | Google Cloud | opcional | obligatorio si Google GPU | obligatorio si Google GPU |
| `GCP_TASKS_QUEUE` | Google Cloud Tasks | opcional | obligatorio si Google GPU | obligatorio si Google GPU |
| `GCP_TASKS_LOCATION` | Google Cloud Tasks | opcional | obligatorio si Google GPU | obligatorio si Google GPU |
| `GCP_TASKS_SERVICE_ACCOUNT` | Google Cloud IAM | opcional | recomendado si Google GPU | obligatorio si Cloud Run privado |
| `TRIBE_WORKER_ENDPOINT_URL` | RunPod/Cloud Run | vacio/mock | obligatorio si GPU remoto | obligatorio |
| `HF_TOKEN` | Hugging Face | opcional mock | obligatorio si GPU remoto | obligatorio |
| `OPENAI_API_KEY` | OpenAI | opcional mock | obligatorio informes reales | obligatorio |
| `SENTRY_DSN` | Sentry | opcional | recomendado | obligatorio |
| `RESEND_API_KEY` | Resend | opcional | recomendado | obligatorio si email real |
| `JWT_SECRET` | Backend | local-only | obligatorio fuerte | obligatorio fuerte |

## Limites de gasto iniciales

| Recurso | Local | Staging | Produccion beta |
| --- | --- | --- | --- |
| GPU seconds/mes | 0-600 | 3.600 | 7.200 |
| Coste mensual cap | 50 EUR | 150 EUR | 350 EUR |
| Duracion max asset | 180s | 180s | 180s |
| Runs simultaneos GPU | 1 | 1 | 1-2 |
| LLM reports/mes | 20 | 50 | 150 |

Estos limites son conservadores. Se ajustan despues del primer lote de assets reales.

## Buckets R2

| Entorno | Bucket |
| --- | --- |
| Local | `neuroimpact-local` o MinIO |
| Staging | `praevia-neuroimpact-staging` |
| Produccion | `praevia-neuroimpact-production` |

Estructura sugerida:

```text
{env}/org/{organization_id}/experiment/{experiment_id}/{slot}-{asset_id}-{filename}
derived/{env}/org/{organization_id}/experiment/{experiment_id}/{asset_id}/
predictions/org/{organization_id}/experiment/{experiment_id}/asset/{asset_id}/run/{run_id}/
reports/org/{organization_id}/experiment/{experiment_id}/asset/{asset_id}/
exports/org/{organization_id}/
```

## Dominios

Pendiente de Nestor:

- dominio principal.
- subdominio app produccion.
- subdominio staging.
- subdominio API produccion.
- subdominio API staging.

Propuesta:

- `app.neuroimpact.<dominio>`
- `api.neuroimpact.<dominio>`
- `staging.neuroimpact.<dominio>`
- `api-staging.neuroimpact.<dominio>`

## Criterio de aceptacion

Sprint 17 queda aceptado cuando:

- Las decisiones de proveedor estan documentadas.
- Existen plantillas de entorno local/staging/production.
- Existe checklist de secretos.
- Existe gate de readiness de entorno.
- Nestor confirma cuentas y aporta claves fuera del repo.
- Se decide dominio/subdominios.

## Pendiente de Nestor

Para poder arrancar Sprint 18 sin friccion necesito:

- Supabase project URL.
- Supabase anon key.
- Supabase service role key.
- Cloudflare R2 account id, endpoint, access key y secret key.
- RunPod API key o proyecto Google Cloud con Cloud Run GPU/Cloud Tasks.
- Hugging Face token.
- OpenAI API key con acceso a los modelos elegidos.
- Sentry DSN.
- Resend API key si quieres emails reales desde Sprint 18.
- Dominio o subdominio.
