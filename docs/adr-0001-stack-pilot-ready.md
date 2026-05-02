# ADR 0001 · Stack pilot-ready

## Estado

Aceptado para Sprint 0.

## Contexto

El producto necesita subir archivos pesados, ejecutar jobs largos, usar GPU, generar PDFs y mantener trazabilidad. No conviene meter todo en una sola aplicacion web.

Hay dos fuerzas:

- Velocidad para llegar a un MVP pilot-ready.
- Ruta enterprise para clientes corporativos con SSO, procurement, auditoria y despliegues mas exigentes.

## Decision

Para MVP:

- Frontend: React + Vite + TypeScript.
- Backend: FastAPI.
- DB/Auth: Supabase Auth + PostgreSQL.
- Storage: R2/S3-compatible.
- Jobs: Redis + RQ.
- Worker GPU: RunPod Serverless como candidato principal.
- Reporting: Playwright/Chromium.

Upgrade path:

- Google Cloud-first si priorizamos procurement enterprise desde beta: Firebase/Identity Platform, Cloud SQL, Cloud Storage, Cloud Tasks, Cloud Run GPU y Secret Manager.
- Next.js App Router si necesitamos portal enterprise con SSR/server functions.
- WorkOS si SSO/SAML/Directory Sync se vuelve requisito temprano.
- Temporal si los workflows necesitan cancelacion durable, reintentos complejos y observabilidad avanzada.
- AWS-only si un cliente enterprise lo exige.

## Consecuencias

Ventajas:

- Menos complejidad para Sprint 1-6.
- Stack Python-first para backend/worker.
- Buen encaje con el prototipo React.
- Cambio razonable hacia enterprise sin tirar la base.

Costes:

- Habra que mantener disciplina de contratos API.
- Si los workflows crecen rapido, RQ podria quedarse corto.
- Supabase puede necesitar reemplazo o capa enterprise si procurement aprieta.
- Google Cloud-first reduce dispersion operativa, pero exige adaptar auth, storage y cola GPU antes de reemplazar el stack actual.

## Revision

Revisar al final de Sprint 6, cuando el worker real este funcionando.

## Nota 2026-05-02

Se documenta una alternativa Google Cloud para beta enterprise en `docs/google-cloud-beta-architecture.md`. No reemplaza automaticamente la decision MVP; abre una ruta paralela para ejecutar TRIBE en Cloud Run GPU/Cloud Tasks y, si conviene, migrar despues auth/DB a Firebase + Cloud SQL.
