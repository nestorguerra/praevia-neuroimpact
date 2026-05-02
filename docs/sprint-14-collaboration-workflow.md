# Sprint 14 · Colaboracion, comentarios y workflow creativo

## Estado

Implementado a nivel repo/local y validado con gate automatizado.

## Objetivo

Convertir el producto en workflow creativo, no solo en dashboard o PDF. El analista puede comentar un tramo, convertir recomendaciones en tareas, asignarlas, cambiar estado, compartir un viewer externo y revisar historial.

## Entregables implementados

- Ruta privada `/app/workflow`.
- Comentarios sobre timeline con timecode.
- Recomendaciones con estado: `draft`, `reviewed`, `approved`, `archived`.
- Creacion de tareas desde las tres recomendaciones principales.
- Asignacion de responsable.
- Cambio de estado de tarea.
- Share link seguro local con expiracion.
- Viewer externo solo lectura en `/share/:token`.
- Historial basico de acciones.
- Backend contract preparado en `/v1/collaboration/*`.
- Gate automatizado `npm run workflow:gate`.

## Backend preparado

- `GET /v1/collaboration/{organization_id}/{experiment_id}`
- `POST /v1/collaboration/comments`
- `POST /v1/collaboration/tasks`
- `PATCH /v1/collaboration/tasks/{task_id}/status`
- `POST /v1/collaboration/share-links`
- `GET /v1/share/{token}`

## Criterio de aceptacion

Validado con `scripts/workflow-gate.mjs`:

1. Registro local.
2. Abrir `/app/workflow`.
3. Crear 3 tareas desde recomendaciones.
4. Comentar `00:18-00:22 recortar locucion...`.
5. Aprobar una tarea.
6. Crear share link.
7. Abrir viewer externo solo lectura.
8. Ver tareas, comentario e historial.

## Artefactos QA

- `/tmp/praevia-neuroimpact-qa/sprint14-workflow.png`
- `/tmp/praevia-neuroimpact-qa/sprint14-share-viewer.png`
- `/tmp/praevia-neuroimpact-qa/sprint14-workflow-gate.json`

## Pendiente para produccion real

- Persistir workflow en PostgreSQL con RLS.
- Firmar share links en backend con expiracion server-side.
- Notificaciones por email/Slack cuando se asignen tareas.
- Comentarios directamente sobre player sincronizado.
- Permisos finos para viewer externo por informe, proyecto o tarea.
