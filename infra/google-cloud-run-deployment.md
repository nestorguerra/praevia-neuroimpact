# Google Cloud Run deployment

## Objetivo

Desplegar NeuroImpact Analyzer sobre Google Cloud manteniendo el producto actual y preparando TRIBE real con GPU.

## Servicios

- Firebase Hosting: frontend Vite/React.
- Cloud Run: backend FastAPI.
- Cloud SQL PostgreSQL: persistencia.
- Cloud Storage: assets, derivados, predicciones e informes.
- Cloud Tasks: cola durable para runs TRIBE.
- Cloud Run GPU: worker TRIBE con NVIDIA L4.
- Secret Manager: secretos.
- Cloud Logging/Monitoring/Error Reporting: observabilidad.

## Setup paso a paso

### 1. Proyecto y billing

Crear proyecto:

```bash
gcloud projects create praevia-neuroimpact-prod
gcloud config set project praevia-neuroimpact-prod
```

Activar billing, budget mensual y alertas al 50%, 75% y 90%.

### 2. APIs

```bash
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  storage.googleapis.com \
  cloudtasks.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com
```

### 3. Artifact Registry

```bash
gcloud artifacts repositories create praevia \
  --repository-format=docker \
  --location=europe-west1
```

### 4. Cloud SQL

Crear instancia PostgreSQL:

```bash
gcloud sql instances create praevia-neuroimpact-prod \
  --database-version=POSTGRES_16 \
  --region=europe-west1 \
  --tier=db-g1-small \
  --storage-type=SSD \
  --storage-size=20GB
```

Crear DB y usuario:

```bash
gcloud sql databases create neuroimpact --instance=praevia-neuroimpact-prod
gcloud sql users create neuroimpact --instance=praevia-neuroimpact-prod --password=CHANGE_ME
```

### 5. Buckets

```bash
gcloud storage buckets create gs://praevia-neuroimpact-production \
  --location=europe-west1 \
  --uniform-bucket-level-access
```

Para compatibilidad rapida con el adapter S3 actual, crear HMAC key de Cloud Storage y usar:

```env
S3_ENDPOINT=https://storage.googleapis.com
S3_BUCKET=praevia-neuroimpact-production
S3_ACCESS_KEY_ID=<gcs-hmac-access-key>
S3_SECRET_ACCESS_KEY=<gcs-hmac-secret>
```

### 6. Secret Manager

Guardar secretos:

```bash
printf "..." | gcloud secrets create OPENAI_API_KEY --data-file=-
printf "..." | gcloud secrets create HF_TOKEN --data-file=-
printf "..." | gcloud secrets create TRIBE_CALLBACK_SECRET --data-file=-
```

### 7. Backend Cloud Run

Build:

```bash
gcloud builds submit \
  --tag europe-west1-docker.pkg.dev/praevia-neuroimpact-prod/praevia/backend:production \
  -f backend/Dockerfile .
```

Deploy:

```bash
gcloud run deploy praevia-neuroimpact-api \
  --image europe-west1-docker.pkg.dev/praevia-neuroimpact-prod/praevia/backend:production \
  --region europe-west1 \
  --allow-unauthenticated \
  --add-cloudsql-instances praevia-neuroimpact-prod:europe-west1:praevia-neuroimpact-prod \
  --set-env-vars APP_ENV=production,AUTH_MODE=supabase,PERSISTENCE_MODE=db,STORAGE_MODE=s3
```

### 8. Worker TRIBE Cloud Run GPU

El worker ya incluye `TRIBE_WORKER_RUNTIME=http` para arrancar como servicio HTTP en Cloud Run.

Build:

```bash
gcloud builds submit \
  --tag europe-west1-docker.pkg.dev/praevia-neuroimpact-prod/praevia/tribe-worker:production \
  -f worker/tribe/Dockerfile .
```

Deploy objetivo:

```bash
gcloud run deploy praevia-tribe-worker \
  --image europe-west1-docker.pkg.dev/praevia-neuroimpact-prod/praevia/tribe-worker:production \
  --region europe-west1 \
  --no-allow-unauthenticated \
  --gpu=1 \
  --gpu-type=nvidia-l4 \
  --memory=16Gi \
  --cpu=4 \
  --timeout=1800 \
  --concurrency=1
```

Variables minimas del worker:

```env
TRIBE_WORKER_RUNTIME=http
GPU_PROVIDER=google_cloud_run_gpu
TRIBE_MODEL_ID=facebook/tribev2
HF_TOKEN=
S3_ENDPOINT=https://storage.googleapis.com
S3_BUCKET=praevia-neuroimpact-production
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
TRIBE_CALLBACK_SECRET=
TRIBE_WORKER_BEARER_TOKEN=
```

### 9. Cloud Tasks

Crear cola:

```bash
gcloud tasks queues create tribe-runs --location=europe-west1
```

El backend debe crear tareas HTTP hacia el worker, con OIDC service account y payload del run.

### 10. Frontend

Usar Firebase Hosting o Cloud Run static. Variables publicas:

```env
VITE_API_PUBLIC_URL=https://api.neuroimpact.praevia.ai
VITE_AUTH_MODE=supabase
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## Bloqueos antes de usarlo en produccion

- Decidir si mantenemos Supabase Auth o migramos a Firebase Auth.
- Validar que TRIBE cabe y rinde en NVIDIA L4.
- Medir coste real con 10 assets cortos.
