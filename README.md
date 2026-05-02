# PraevIA · NeuroImpact Analyzer

Repositorio de producto para convertir el prototipo PraevIA/NeuroImpact Analyzer en una plataforma B2B pilot-ready.

## Estado actual

Sprint 31 completado a nivel de repo: base PostgreSQL/Supabase productiva, storage S3/R2/MinIO con URLs firmadas reales, API real, preprocesamiento, worker GPU TRIBE preparado, scoring real desde `bold_predictions.npz`, LLM real con guardrails, PDF server-side, comparativa A/B/C trazable, admin real de costes/creditos/caps/export mensual, observabilidad/seguridad, CI/CD estricto y despliegue staging/produccion con Docker Compose, GHCR, Caddy HTTPS, deploy automatico y rollback. Sin pasarela de pago en beta. Deploy publico pendiente de hosts, DNS y secretos reales.

## Local foundation

Servicios locales preparados para Sprint 1:

```bash
docker compose -f infra/docker-compose.local.yml up
```

Variables de entorno base:

```bash
cp .env.example .env
```

## Estructura

- `frontend/`: aplicacion privada y landing cuando se migren a app real.
- `backend/`: API, auth integration, proyectos, assets, runs, reports y admin.
- `worker/`: procesamiento CPU/GPU, TRIBE, scoring y derivados multimedia.
- `reporting/`: plantillas HTML/CSS print-first y renderer PDF.
- `infra/`: despliegue, entornos, runbooks y configuracion.
- `design/source/`: assets originales PraevIA recibidos para diseno.
- `docs/`: decisiones de Sprint 0 y especificaciones base.

## Decisiones base

- Marca paraguas: PraevIA.
- Producto: NeuroImpact Analyzer.
- Posicionamiento: instrumento de pretest neurocognitivo in silico para decision creativa.
- Primer mercado: empresas corporativas espanolas, marketing, contenidos, eventos y agencias.
- Primer hito comercial: v1.0 Pilot-Ready.

## Documentos Sprint 0

- [Sprint 0 Control Tower](docs/sprint-0-control-tower.md)
- [Arquitectura v0.1](docs/architecture-v0.1.md)
- [Gobierno legal y cientifico v0.1](docs/governance-legal-science-v0.1.md)
- [Alcance MVP v1.0](docs/mvp-scope-v1.0.md)
- [Modelo de costes v0.1](docs/cost-model-v0.1.md)
- [Entornos y operacion v0.1](docs/environments-and-operations-v0.1.md)
- [Mapa de fuente de diseno](docs/design-source-map.md)
- [Guia de lenguaje y claims](docs/language-claims-guide.md)
- [Ruflo Sprint 0](docs/ruflo-sprint0.md)
- [Checklist Sprint 0](docs/sprint-0-checklist.md)
- [Risk Register v0.1](docs/risk-register-v0.1.md)
- [Seguridad y privacidad baseline](docs/security-privacy-baseline.md)
- [Protocolo de validacion cientifica v0.1](docs/scientific-validation-protocol-v0.1.md)
- [Modelo de datos v0.1](docs/data-model-v0.1.md)
- [Ciclo de vida de run v0.1](docs/run-lifecycle-v0.1.md)
- [Checklist contrato piloto](docs/pilot-contract-checklist.md)
- [ADR 0001 · Stack pilot-ready](docs/adr-0001-stack-pilot-ready.md)
- [ADR 0002 · Reporting HTML print-first](docs/adr-0002-reporting-html-print-first.md)
- [ADR 0003 · Guardrails comerciales y cientificos](docs/adr-0003-guardrails-comerciales-cientificos.md)
- [Sprint 1 · Design System + Design Hub + Landing](docs/sprint-1-design-system.md)
- [Sprint 2 · Auth, organizaciones y app shell](docs/sprint-2-auth-shell.md)
- [Sprint 3 · Workspaces, proyectos y experimentos](docs/sprint-3-workspaces-projects-experiments.md)
- [Sprint 4 · Upload, storage seguro y Asset Health Check](docs/sprint-4-upload-storage-healthcheck.md)
- [Sprint 5 · Preprocesamiento multimodal](docs/sprint-5-preprocessing-multimodal.md)
- [Sprint 6 · Worker GPU TRIBE v2](docs/sprint-6-worker-gpu-tribe.md)
- [Fallback Colab Sprint 6](docs/sprint-6-colab-fallback.md)
- [Sprint 7 · Scoring neurocognitivo](docs/sprint-7-neurocognitive-scoring.md)
- [Sprint 8 · Dashboard individual](docs/sprint-8-individual-dashboard.md)
- [Sprint 9 · LLM + informes PDF](docs/sprint-9-llm-reporting-pdf.md)
- [Sprint 10 · Comparativa A/B/C y mix recomendado](docs/sprint-10-abc-comparison-mix.md)
- [Sprint 11 · Admin, creditos, costes y seguridad](docs/sprint-11-admin-credits-security.md)
- [Sprint 12 · Produccion staging/prod y hardening](docs/sprint-12-production-hardening.md)
- [Deployment staging/production v0.1](docs/deployment-staging-production-v0.1.md)
- [Production runbooks v0.1](docs/production-runbooks-v0.1.md)
- [Sprint 13 · Kit comercial y piloto Sprint 10](docs/sprint-13-commercial-kit.md)
- [Propuesta comercial Sprint 10](docs/commercial-sprint-10-proposal.md)
- [Demo scripts Sprint 13](docs/commercial-demo-scripts.md)
- [Ficha de seguridad comercial](docs/commercial-security-sheet.md)
- [Plantilla contrato piloto](docs/commercial-pilot-contract-template.md)
- [One-pager ejecutivo](docs/commercial-one-pager.md)
- [Sprint 14 · Colaboracion y workflow creativo](docs/sprint-14-collaboration-workflow.md)
- [Sprint 15 · Benchmarks, KPIs externos y calibracion](docs/sprint-15-benchmarks-kpis-calibration.md)
- [Sprint 16 · SaaS v1.5 y enterprise basico](docs/sprint-16-saas-v15-enterprise.md)
- [Enterprise beta · DPA, retencion, SLA y soporte](docs/enterprise-dpa-retention-sla.md)
- [Sprint 17 · Decisiones de infraestructura de produccion](docs/sprint-17-production-infrastructure.md)
- [Checklist de secretos para produccion](docs/production-secrets-checklist.md)
- [Sprint 18 · Auth real y seguridad base](docs/sprint-18-auth-real-security.md)
- [Sprint 19 · Base de datos de produccion](docs/sprint-19-production-database.md)
- [Sprint 20 · Storage seguro real](docs/sprint-20-secure-storage-real.md)
- [Sprint 21 · Backend API real](docs/sprint-21-backend-api-real.md)
- [Sprint 22 · Preprocesamiento real](docs/sprint-22-real-preprocessing.md)
- [Sprint 23 · Worker GPU TRIBE real](docs/sprint-23-worker-gpu-tribe-real.md)
- [Sprint 24 · Scoring real](docs/sprint-24-real-scoring.md)
- [Sprint 25 · LLM real y guardrails](docs/sprint-25-llm-real-guardrails.md)
- [Sprint 26 · PDF server-side real](docs/sprint-26-pdf-server-side-real.md)
- [Sprint 27 · Comparativa A/B/C real](docs/sprint-27-real-abc-comparison.md)
- [Sprint 28 · Admin, costes y creditos reales](docs/sprint-28-admin-costs-credits-real.md)
- [Sprint 29 · Observabilidad y seguridad](docs/sprint-29-observability-security.md)
- [Sprint 30 · CI/CD produccion estricto](docs/sprint-30-strict-production-cicd.md)
- [Sprint 31 · Staging + Produccion](docs/sprint-31-staging-production.md)
- [Sprint 32 · QA funcional completa](docs/sprint-32-functional-qa.md)
- [Sprint 33 · Legal, ciencia y comercial](docs/sprint-33-legal-science-commercial.md)

## Frontend Sprint 1

```bash
cd frontend
npm install
npm run dev
```

URLs locales:

- Landing: `http://localhost:5173/`
- Preview app: `http://localhost:5173/app`
- Upload: `http://localhost:5173/app/upload`
- Resultados: `http://localhost:5173/app/results`
- Comparativas: `http://localhost:5173/app/compare`
- Admin: `http://localhost:5173/app/admin`
- Benchmarks: `http://localhost:5173/app/benchmarks`
- SaaS v1.5: `http://localhost:5173/app/enterprise`
- Workflow: `http://localhost:5173/app/workflow`
- Viewer externo: `http://localhost:5173/share/<token>`
- Pilot Kit: `http://localhost:5173/pilot-kit`
- Deck cliente: `http://localhost:5173/pilot-kit/deck-cliente.html`
- Deck interno: `http://localhost:5173/pilot-kit/deck-interno.html`
- Teaser: `http://localhost:5173/pilot-kit/motion-teaser.html`
- Login: `http://localhost:5173/login`
- Registro: `http://localhost:5173/register`
- Design Hub: `http://localhost:5173/design-hub/index.html`

Auth Sprint 18:

```bash
cd frontend
npm run auth:gate
```

DB Sprint 19:

```bash
cd frontend
npm run db:gate
```

El modo produccion usa `PERSISTENCE_MODE=db` y `DATABASE_URL`. El modo local/demo puede seguir usando `PERSISTENCE_MODE=memory`.

Backend API Sprint 21:

```bash
cd frontend
npm run backend-api:gate
```

Con `AUTH_MODE=supabase`, `PERSISTENCE_MODE=db` y `VITE_API_PUBLIC_URL`, las pantallas de benchmarks, comparativas, workflow, enterprise y admin leen/escriben contra backend. En modo local/demo mantienen fallback local para seguir probando sin secretos reales.

## Worker Sprint 22

```bash
cd worker
python3 -m preprocessing.cli --input /ruta/asset.srt --kind text --output /tmp/neuroimpact-preprocessed
```

Para video/audio hace falta tener `ffmpeg` y `ffprobe` instalados. Para transcripcion real hace falta `faster-whisper` o usar `worker/preprocessing/Dockerfile`.

## Worker TRIBE Sprint 23

```bash
PYTHONPATH=worker/tribe python3 -m tribe_worker.cli \
  --run-spec worker/tribe/examples/run-spec.json \
  --output-dir /tmp/tribe-out \
  --mock
```

Para TRIBE real hace falta Docker, `HF_TOKEN`, storage S3/R2/GCS compatible y la imagen de `worker/tribe/Dockerfile`.

Proveedores soportados:

- RunPod Serverless: `GPU_PROVIDER=runpod_serverless`.
- Google Cloud Run GPU + Cloud Tasks: `GPU_PROVIDER=google_cloud_run_gpu` y `TRIBE_WORKER_RUNTIME=http`.

La ruta Google esta documentada en `docs/google-cloud-beta-architecture.md` y `infra/google-cloud-run-deployment.md`.

## Worker scoring Sprint 7

```bash
PYTHONPATH=worker python3 -m scoring.cli \
  --npz /tmp/praevia-neuroimpact-qa/tribe-mock-final/bold_predictions.npz \
  --output /tmp/praevia-neuroimpact-qa/scoring-result.json
```

El scoring productivo de Sprint 24 vive en backend y lee `bold_predictions.npz` desde S3/R2, valida shape `(n_timesteps, 20484)` y persiste NRI, scores editoriales, redes, regiones, timeline corregido por BOLD y momentos accionables.

```bash
cd frontend
npm run scoring:gate
```

## Reporting Sprint 9

```bash
node reporting/render-report.mjs \
  --input reporting/sample-report.json \
  --output-html /tmp/praevia-neuroimpact-qa/sprint9-report.html \
  --output-pdf /tmp/praevia-neuroimpact-qa/sprint9-report.pdf
```

La app tambien permite generar un informe desde `/app/results`, con PDF/HTML/JSON descargables y guardrails de lenguaje.

## Comparativa Sprint 10

La app permite completar el flujo comercial A/B/C desde `/app/upload` y revisar el resultado en `/app/compare`: ganador global, ganadores por modalidad, ganador por tramo, mix recomendado y export PDF/JSON/CSV.

Backend preparado:

- `POST /v1/comparisons`
- `GET /v1/comparisons/{comparison_id}`
- `GET /v1/experiments/{experiment_id}/comparisons`

## Admin Sprint 11

La app incluye panel operativo en `/app/admin` para ver consumo, coste, creditos, GPU seconds, tokens, storage, audit log, limites, backups y borrado seguro. En modo Supabase llama a la API para borrar objetos reales de S3/R2; en modo local mantiene el fallback de demo.

Backend preparado:

- `POST /v1/admin/usage-events`
- `POST /v1/admin/audit-logs`
- `POST /v1/admin/secure-delete`
- `GET /v1/admin/organizations/{organization_id}/snapshot`

## Demo gate y production gate Sprint 30

```bash
cd frontend
npm run demo:gate
```

`demo:gate` ejecuta build, smoke tolerante con API ausente, PDF regression, visual regression, gates comerciales/workflow/benchmark/enterprise, worker mock, E2E local y Ruflo checker.

```bash
cd frontend
npm run production:gate
```

`production:gate` es estricto: falla si backend no responde, DB no conecta, storage no firma URLs o el worker TRIBE no esta disponible. Para validar solo dependencias:

```bash
cd frontend
npm run production:dependencies-gate
```

Worker real opcional/manual:

```bash
cd frontend
RUN_TRIBE_REAL_GATE=true REQUIRE_REMOTE_WORKER=true npm run worker:real-gate
```

## QA funcional completa Sprint 32

```bash
cd frontend
npm run qa:functional
```

Este flujo prueba registro, login, recuperacion, proyectos, A/B/C, upload de video/audio/texto, health check, preprocesamiento, TRIBE, scoring, dashboard, PDF, comparativa, admin coste, borrado seguro, share link, benchmark, KPI externo y export mensual de uso. En local marca `tribe_real` como simulado; para produccion:

```bash
cd frontend
QA_REAL_MODE=true APP_QA_URL=https://staging.neuroimpact.praevia.ai API_SMOKE_URL=https://api-staging.neuroimpact.praevia.ai npm run qa:functional
```

El resultado queda en `/tmp/praevia-neuroimpact-qa/sprint32-functional-checklist.json`.

Deploy Sprint 31:

```bash
cd frontend
npm run deploy:gate
```

Workflows:

- `Deploy Staging`: automatico tras `Production Gate` verde en `main`.
- `Deploy Production`: release publicado o ejecucion manual.
- `Rollback`: manual por entorno y release id.

Entornos:

- Local: `.env.example` o `infra/env/local.example.env`
- Staging: `infra/env/staging.example.env` + `infra/docker-compose.staging.yml`
- Production: `infra/env/production.example.env` + `infra/docker-compose.production.yml`

Readiness de entorno Sprint 17:

```bash
cd frontend
npm run env:gate
```

Backend hardening:

- `GET /health`
- `GET /ready`
- CORS por entorno.
- Trusted hosts.
- HTTPS redirect opcional.
- Security headers.
- Sentry backend/frontend.
- Logs estructurados JSON.
- Rate limiting con eventos operativos.
- Alertas de coste.
- Backups y errores visibles en Admin.

Observabilidad Sprint 29:

```bash
cd frontend
npm run observability:gate
```

## Workflow Sprint 14

```bash
cd frontend
npm run workflow:gate
```

El workflow permite:

- Comentar sobre timeline con timecode.
- Crear tareas desde recomendaciones.
- Asignar responsable.
- Marcar tareas y recomendaciones como draft, revisado, aprobado o archivado.
- Crear share links con expiracion.
- Abrir viewer externo solo lectura.
- Revisar historial basico.

Backend preparado:

- `GET /v1/collaboration/{organization_id}/{experiment_id}`
- `POST /v1/collaboration/comments`
- `POST /v1/collaboration/tasks`
- `PATCH /v1/collaboration/tasks/{task_id}/status`
- `POST /v1/collaboration/share-links`
- `GET /v1/share/{token}`

## Benchmarks Sprint 15

```bash
cd frontend
npm run benchmark:gate
```

La app permite:

- Crear/usar benchmark interno por categoria.
- Asignar pieza nueva a benchmark.
- Calcular percentiles por score.
- Importar KPIs reales manuales: VTR, CTR, retencion, brand lift, encuesta o feedback evento.
- Ver score vs KPI real.
- Exportar PDF/JSON/CSV con benchmark aplicado.

Backend preparado:

- `GET /v1/benchmarks/{organization_id}`
- `POST /v1/benchmarks`
- `POST /v1/benchmark-items`
- `POST /v1/external-kpis`

SQL base:

- `backend/supabase/migrations/0010_benchmarks_kpis.sql`

## SaaS v1.5 Sprint 16

```bash
cd frontend
npm run enterprise:gate
```

La app incluye `/app/enterprise` para preparar pilotos recurrentes sin pasarela de pago:

- Planes Starter, Professional y Enterprise.
- API keys basicas por organizacion con scopes, rotacion y revocacion.
- Export mensual de uso en PDF/JSON/CSV para facturacion manual beta.
- SSO/SAML como roadmap Enterprise bajo contrato.
- Politica de retencion configurable.
- DPA basico, SLA piloto, soporte, onboarding/offboarding y checklist procurement.

Backend preparado:

- `GET /v1/enterprise/{organization_id}/snapshot`
- `POST /v1/enterprise/api-keys`
- `POST /v1/enterprise/api-keys/{key_id}/rotate`
- `POST /v1/enterprise/api-keys/{key_id}/revoke`
- `PUT /v1/enterprise/retention-policy`
- `POST /v1/enterprise/billing-exports`

SQL base:

- `backend/supabase/migrations/0011_enterprise_saas_v15.sql`

## LLM real Sprint 25

```bash
cd frontend
npm run llm:gate
```

El router de informes ya conecta con OpenAI Responses API cuando existe `OPENAI_API_KEY`:

- salida JSON estructurada con `json_schema` estricto.
- interpretacion y redaccion separadas por modelo.
- `reasoning.effort` configurable para la redaccion.
- guardrails antes y despues de la salida del modelo.
- no se envian archivos brutos al LLM, solo metricas estructuradas.
- tokens, coste estimado, prompt version y response IDs quedan trazados.
- cada informe DB registra `usage_events.event_type='report_generation'`.

Variables principales:

- `OPENAI_API_KEY`
- `LLM_INTERPRETER_MODEL`
- `LLM_WRITER_MODEL`
- `LLM_WRITER_REASONING_EFFORT`
- `LLM_JSON_MAX_RETRIES`
- `LLM_INPUT_EUR_PER_1K`
- `LLM_OUTPUT_EUR_PER_1K`

Sin API key, el sistema mantiene modo local determinista para desarrollo y demo.

Para confirmar los nombres de modelo disponibles en la cuenta OpenAI:

```bash
cd frontend
npm run openai:models
```

## PDF server-side Sprint 26

```bash
cd frontend
npm run pdf:server-gate
```

El backend ya genera informes HTML/PDF server-side:

- HTML print-first desde backend.
- Playwright/Chromium server-side.
- plantillas `executive`, `creative` y `technical`.
- control de overflow antes de emitir PDF.
- subida de HTML/PDF a S3/R2.
- registro en `storage_objects`.
- hash del asset original cuando existe.
- hashes SHA-256 de HTML y PDF.
- footer trazable con report ID, modelo, prompt, benchmark y pagina.
- descarga desde app via `GET /v1/reports/{report_id}/download?format=pdf|html`.

Variables:

- `REPORT_RENDERER_MODE=playwright`
- `REPORT_RENDERER_TIMEOUT_SECONDS=45`

En local/demo sigue existiendo PDF frontend como fallback. En produccion real hace falta storage S3/R2 para guardar y servir los artefactos.

## Comparativa A/B/C real Sprint 27

```bash
cd frontend
npm run comparison:gate
```

La comparativa A/B/C ya usa scoring real de backend cuando la app esta en modo Supabase/API:

- valida que cada version viene de un run TRIBE `done`.
- exige scoring `pipeline_mode='real_npz'`.
- conserva trazabilidad a `source_prediction_artifact_id`.
- valida malla fsaverage5 de 20.484 vertices.
- compara duracion, timesteps, tipo de asset y modelo.
- calcula ganador global, ganador por modalidad, ganador por tramo y mix recomendado.
- guarda `report_payload` con algoritmo, source runs, deltas, ventanas y estado.
- registra `usage_events.event_type='comparison_generation'`.

En demo local sigue existiendo comparativa determinista para vender y probar pantallas sin gastar GPU.

## Admin real Sprint 28

```bash
cd frontend
npm run admin:costs-gate
```

El admin ya controla margen y continuidad operativa:

- `usage_events` reales para upload, preprocessing, TRIBE, scoring, informes, comparativas y borrado.
- GPU seconds y coste TRIBE desde callback del worker.
- Tokens OpenAI y coste LLM desde informes.
- Storage vivo desde `storage_objects`, no desde estimaciones del navegador.
- Limites por organizacion: creditos, hard cap, coste, GPU seconds, storage, rate limits y retencion.
- Bloqueo de nuevos runs TRIBE si la organizacion supera caps.
- Export mensual backend para facturacion manual beta: `POST /v1/admin/organizations/{organization_id}/monthly-usage-exports/{YYYY-MM}`.

No hay Stripe ni pasarela de pago en beta.

## Kit comercial Sprint 13

```bash
cd frontend
npm run pilot:kit
npm run commercial:gate
```

El kit comercial deja preparado el recorrido de reunion para CMO/agencia:

- Landing con formulario de demo real y fallback local si la API no esta disponible.
- `POST /v1/marketing/demo-requests`
- `/pilot-kit` con activos y demos.
- Deck cliente e interno.
- Teaser motion de 18 segundos en HTML.
- One-pager, ficha de seguridad y contrato piloto.
- Pack legal/procurement Sprint 33.
- Dataset demo limpio en `frontend/public/pilot-kit/demo-data/`.

## Legal, ciencia y comercial Sprint 33

```bash
cd frontend
npm run legal:gate
```

El pack legal deja preparados DPA, privacidad, terminos, retencion, contrato piloto, limites cientificos, revision de claims, checklist procurement y ficha de seguridad. Tambien incluye la decision interna de clearance TRIBE: no vender SaaS comercial recurrente basado en TRIBE sin autorizacion comercial expresa o alternativa tecnica con derechos comerciales claros.
