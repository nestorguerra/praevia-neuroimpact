# Arquitectura Google Cloud para beta

Fecha: 2026-05-02

## Resumen ejecutivo

Si queremos una ruta mas enterprise para corporates en Espana, Google Cloud es una opcion fuerte. Permite dejar backend, storage, cola, secretos, logs y GPU dentro del mismo proveedor, con mejor encaje para procurement que una mezcla de servicios pequenos.

La decision no es solo coste. Google Cloud reduce dispersion operativa, pero aumenta trabajo de integracion frente al stack rapido Supabase + R2 + RunPod.

## Recomendacion

Para beta comercial seria, recomiendo esta arquitectura Google-first:

| Capa | Servicio Google | Decision |
| --- | --- | --- |
| Frontend publico y app | Firebase Hosting o Cloud Run static container | Firebase Hosting si queremos simplicidad; Cloud Run si queremos todo bajo servicios. |
| Auth | Firebase Authentication / Identity Platform | Sustituye Supabase Auth. Requiere adaptar backend JWT y onboarding. |
| Base de datos | Cloud SQL for PostgreSQL | Sustituye Supabase Postgres. Mantiene SQL/Postgres, pero cambia auth/RLS. |
| Backend API | Cloud Run | FastAPI container actual. |
| Storage | Cloud Storage | Sustituye R2/S3. Para cambio rapido se puede usar modo interoperabilidad S3 con HMAC. |
| Cola | Cloud Tasks | Encola TRIBE y preprocesamiento de forma durable. |
| Worker CPU | Cloud Run Jobs o Cloud Run service | FFmpeg/Whisper. |
| Worker GPU TRIBE | Cloud Run GPU con NVIDIA L4 o Vertex AI Custom Job | Cloud Run GPU primero; Vertex AI si necesitamos jobs largos o mas tipos GPU. |
| Secretos | Secret Manager | API keys, HF token, OpenAI key, callback secret. |
| Observabilidad | Cloud Logging, Error Reporting, Monitoring | Sentry puede mantenerse si queremos mejor UX de errores. |
| Email | Firebase Auth email templates o proveedor externo | Para beta puede servir Firebase; para emails de producto, Resend/Postmark sigue siendo mas comodo. |

## Por que puede ser mejor

- Mejor narrativa enterprise: proveedor unico, IAM, logs, secretos, cuotas y billing centralizado.
- Cloud Run permite escalar a cero para backend/worker cuando no hay uso.
- Cloud Run ya soporta GPU NVIDIA L4 para servicios containerizados.
- Cloud Tasks encaja muy bien con trabajos largos y reintentos de analisis.
- Cloud Storage y Cloud SQL son faciles de explicar a IT/procurement.

## Coste orientativo beta

Coste fijo aproximado:

| Servicio | Coste beta estimado |
| --- | ---: |
| Firebase Hosting/Auth | 0-25 USD/mes al inicio, segun uso y plan |
| Cloud Run backend | 0-30 USD/mes si hay poco trafico y min instances 0 |
| Cloud SQL PostgreSQL | 10-60 USD/mes segun instancia y backups |
| Cloud Storage | centimos/GB-mes; depende de region y clase |
| Cloud Tasks | muy bajo en beta |
| Secret Manager | bajo, normalmente centimos/pocos USD |
| Worker GPU Cloud Run/Vertex | variable por segundos GPU |
| OpenAI | variable por tokens |

Presupuesto mensual de beta: 75-200 USD/mes + GPU + OpenAI.

Presupuesto por asset corto:

- Preprocesamiento CPU: bajo.
- TRIBE GPU L4: variable; medir con 10-20 assets reales.
- OpenAI informe: variable por longitud del informe y modelo.

## Punto critico: TRIBE en Google

Hay dos caminos:

### Opcion A: Cloud Run GPU + Cloud Tasks

Recomendada para beta si TRIBE funciona bien en L4.

Flujo:

1. Backend recibe `analysis_run`.
2. Backend crea tarea en Cloud Tasks.
3. Cloud Tasks invoca worker Cloud Run GPU.
4. Worker descarga derivados desde Cloud Storage.
5. Worker ejecuta TRIBE.
6. Worker sube `bold_predictions.npz`, `segments.parquet`, `run_metrics.json`.
7. Worker llama al callback del backend.
8. Backend marca run como `done` y dispara scoring/reporting.

Ventajas:

- Serverless real.
- Escala a cero.
- Cola gestionada.
- Menos piezas externas.

Riesgos:

- Solo NVIDIA L4 en Cloud Run GPU.
- El worker HTTP y el cliente Cloud Tasks ya estan implementados, pero faltan despliegue y prueba real.
- Hay que validar que la inferencia TRIBE cabe en L4 para assets de piloto.

### Opcion B: Vertex AI Custom Jobs

Mas robusta si TRIBE necesita mas GPU, jobs largos o experimentacion ML formal.

Ventajas:

- Mejor para workloads ML pesados.
- Mas opciones de acelerador.
- Jobs trazables como workload ML.

Riesgos:

- Mas lento de arrancar.
- Mas caro/complex para beta.
- Mayor carga de integracion.

## Impacto sobre el producto actual

El producto ya esta preparado conceptualmente para backend, storage, GPU, LLM, PDF y costes. Pero para Google-first hay cambios reales:

| Area | Estado actual | Cambio necesario |
| --- | --- | --- |
| Auth | Supabase JWT HS256 | Firebase/Identity Platform JWT RS256/JWKS |
| DB | Supabase Postgres + `auth.uid()` en RLS | Cloud SQL Postgres + backend-only access o RLS adaptado |
| Storage | S3/R2 via boto3 | Cloud Storage nativo o interoperabilidad S3/HMAC |
| GPU | RunPod `/run` + `/status` | Cloud Tasks + Cloud Run GPU callback |
| Secrets | Env vars proveedor | Secret Manager |
| Observabilidad | Sentry preparado | Cloud Logging/Error Reporting opcional |

## Fase 1 implementada

Queda preparado en codigo:

- `GPU_PROVIDER=google_cloud_run_gpu` como proveedor soportado.
- Encolado de runs mediante Cloud Tasks.
- Worker TRIBE con modo HTTP para Cloud Run.
- Health check del worker Cloud Run.
- Perfil de entorno `infra/env/google-production.example.env`.
- Storage compatible con Google Cloud Storage via HMAC/S3 interoperability.

Lo que aun requiere despliegue real:

- Crear proyecto GCP, Cloud SQL, bucket, cola y secrets.
- Construir/subir imagenes a Artifact Registry.
- Desplegar backend Cloud Run.
- Desplegar worker Cloud Run GPU.
- Ejecutar 3 assets reales y medir coste.

## Adaptacion recomendada del roadmap

Insertar un sprint tecnico antes del Sprint 23 real:

### Sprint 22G - Google Cloud Foundation

Objetivo: preparar Google Cloud como plataforma base.

Trabajo:

- Crear proyecto GCP.
- Configurar billing budget y alertas.
- Crear Firebase project.
- Crear Cloud SQL Postgres.
- Crear buckets Cloud Storage por entorno.
- Crear Secret Manager.
- Crear Cloud Tasks queue.
- Crear service accounts para backend y workers.
- Configurar Artifact Registry.
- Configurar dominios `app` y `api`.

Criterio de aceptacion:

- Backend Cloud Run responde `/health`.
- Frontend apunta a backend Cloud Run.
- Cloud SQL conecta.
- Cloud Storage genera subida/descarga.
- Secrets no estan en frontend.

### Sprint 23G - TRIBE Worker en Google

Objetivo: ejecutar TRIBE con Cloud Run GPU.

Trabajo:

- Crear Dockerfile/entrypoint HTTP para worker TRIBE.
- Crear endpoint `/run` protegido.
- Encolar ejecucion via Cloud Tasks.
- Usar Cloud Storage para input/output.
- Callback seguro al backend.
- Registrar gpu_seconds/coste estimado.

Criterio de aceptacion:

- Un asset de video, uno de audio y uno de texto terminan `done` con predicciones reales.

## Decision propuesta

Para Nestor:

- Si buscamos salir rapido y barato: mantener Supabase + R2 + RunPod.
- Si buscamos una base mas vendible a corporates desde el principio: migrar a Google Cloud-first.

Mi recomendacion pragmatica:

1. Mantener el producto actual funcionando.
2. Crear rama `google-cloud-foundation`.
3. Adaptar primero compute/storage/secretos a Google.
4. Mantener Supabase Auth temporalmente si queremos no bloquear.
5. Migrar Auth/DB a Firebase + Cloud SQL solo cuando haya una razon comercial clara.

Esto evita tirar trabajo hecho y nos permite probar TRIBE real en Google sin rehacer todo el login.
