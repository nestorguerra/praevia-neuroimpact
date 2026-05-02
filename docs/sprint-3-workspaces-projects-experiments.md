# Sprint 3 · Workspaces, proyectos y experimentos

Fecha: 2026-05-01

## Objetivo

Montar la estructura funcional del producto con la jerarquia:

```text
Organizacion -> Workspace -> Proyecto -> Experimento -> Asset -> Run -> Informe
```

## Implementado

### Frontend

- Persistencia local por organizacion para Sprint 3.
- Modelo local:
  - `workspaces`
  - `projects`
  - `experiments`
- Wizard de nuevo proyecto:
  - template comercial.
  - workspace existente o nuevo.
  - marca/cliente.
  - campana.
  - objetivo.
  - canal.
  - audiencia.
  - idioma.
  - KPI esperado.
  - tipo de experimento.
- Tipos de experimento:
  - Individual.
  - A/B.
  - A/B/C.
  - Guion.
  - Evento.
  - Formacion.
- Plantillas comerciales:
  - Spot A/B/C.
  - Evento.
  - Guion.
  - Formacion.
  - Analisis individual.
- Lista de proyectos con filtros:
  - busqueda.
  - workspace.
  - estado.
  - tipo.
- Detalle de proyecto:
  - workspace.
  - estado.
  - experimento.
  - objetivo.
  - canal.
  - audiencia.
  - idioma.
  - KPI esperado.
- Tabla de jerarquia funcional hasta `Asset -> Run -> Informe`.

### DB

Migracion preparada:

`backend/supabase/migrations/0002_workspaces_projects_experiments.sql`

Incluye:

- `workspaces`
- `projects`
- `experiments`
- tipos enum `experiment_type` y `project_status`.
- indices basicos.
- RLS por organizacion.

### Backend

Contrato inicial FastAPI preparado en:

- `backend/app/main.py`
- `backend/app/routes/projects.py`
- `backend/app/schemas/projects.py`
- `backend/app/repositories/memory.py`

Endpoints base:

- `GET /health`
- `GET /v1/organizations/{organization_id}/workspaces`
- `POST /v1/workspaces`
- `GET /v1/organizations/{organization_id}/projects`
- `POST /v1/projects`
- `POST /v1/experiments`
- `POST /v1/project-bundles`

## Demo de aceptacion

Flujo probado con Playwright:

1. Registro local.
2. Entrada a `/app`.
3. Abrir wizard.
4. Seleccionar `Spot A/B/C`.
5. Crear `Banco Atlas / Hipotecas Q2`.
6. Confirmar que aparece en lista.
7. Confirmar detalle con experimento `A/B/C`.
8. Confirmar jerarquia hasta `Asset -> Run -> Informe`.

## QA

- `npm run build`: OK.
- `python3 -m compileall app`: OK.
- Playwright flujo Sprint 3: OK.
- Desktop 1440px: OK.
- Mobile 390px sin overflow horizontal: OK.

Capturas temporales:

- `/tmp/praevia-neuroimpact-qa/sprint3-workspace.png`
- `/tmp/praevia-neuroimpact-qa/sprint3-mobile.png`

## Limitaciones

- CRUD frontend usa `localStorage` hasta conectar API real.
- FastAPI usa repositorio en memoria como contrato inicial.
- No hay Supabase aplicado todavia.
- Asset, Run e Informe siguen como siguientes pasos del roadmap.

