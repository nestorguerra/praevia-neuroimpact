# Sprint 30 - CI/CD produccion estricto

## Objetivo

Que CI no mienta. La demo puede ejecutarse con backend ausente, pero el gate de produccion debe fallar si backend, DB, storage o worker no estan disponibles.

## Cambios principales

- `demo:gate`: conserva el comportamiento tolerante para demos locales y QA visual sin backend.
- `production:gate`: ahora es estricto y no permite API ausente.
- `production:dependencies-gate`: consulta backend y exige:
  - `GET /health` OK.
  - `GET /ready` OK.
  - `GET /ready/dependencies?strict=true` OK.
  - DB con `PERSISTENCE_MODE=db` y `select 1`.
  - Storage configurado y capaz de firmar una URL de subida.
  - Worker TRIBE disponible segun modo.
- `worker:real-gate`: opcional/manual. Solo ejecuta comprobacion remota real si `RUN_TRIBE_REAL_GATE=true`.
- GitHub Actions arranca servicios locales, backend, frontend y ejecuta gates comerciales, workflow, benchmark, enterprise, admin, observabilidad, worker mock, PDF, visual y E2E.

## Backend readiness

Nuevo endpoint:

```http
GET /ready/dependencies?strict=true&require_remote_worker=false
```

Respuesta esperada:

```json
{
  "ok": true,
  "strict": true,
  "app_env": "local_ci",
  "checks": [
    { "name": "database", "ok": true },
    { "name": "storage", "ok": true },
    { "name": "worker", "ok": true }
  ]
}
```

Si `READINESS_TOKEN` esta configurado, el cliente debe enviar `X-Readiness-Token`.

## Uso local

Demo tolerante:

```bash
cd frontend
npm run demo:gate
```

Produccion estricta:

```bash
cd frontend
npm run production:gate
```

Para que pase, deben estar vivos frontend, backend, DB, storage y worker.

## Worker real opcional

```bash
cd frontend
RUN_TRIBE_REAL_GATE=true REQUIRE_REMOTE_WORKER=true npm run worker:real-gate
```

Esto requiere backend levantado con proveedor GPU real configurado:

- `TRIBE_WORKER_MODE=remote_gpu`
- `TRIBE_WORKER_ENDPOINT_URL`
- RunPod: `RUNPOD_API_KEY` o `GPU_PROVIDER_API_KEY`
- Google Cloud: `GPU_PROVIDER=google_cloud_run_gpu`, `GCP_PROJECT_ID`, `GCP_TASKS_QUEUE`, `GCP_TASKS_LOCATION`

## Criterio de aceptacion

No se puede marcar produccion como OK si backend, DB, storage o worker estan caidos. En PR se valida contrato completo con worker mock; la comprobacion de worker real queda manual/opcional hasta tener secrets de RunPod o Google Cloud disponibles en CI.
