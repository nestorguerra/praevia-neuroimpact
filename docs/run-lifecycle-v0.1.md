# Ciclo de vida de un run v0.1

## Estados

```mermaid
stateDiagram-v2
  [*] --> queued
  queued --> validating
  validating --> preprocessing
  preprocessing --> gpu_running
  gpu_running --> scoring
  scoring --> interpreting
  interpreting --> rendering_pdf
  rendering_pdf --> done
  validating --> failed
  preprocessing --> failed
  gpu_running --> failed
  scoring --> failed
  interpreting --> failed
  rendering_pdf --> failed
  queued --> cancelled
  validating --> cancelled
  preprocessing --> cancelled
```

## Eventos SSE/API

- `run.created`
- `asset.validating`
- `asset.validated`
- `asset.failed`
- `preprocess.started`
- `preprocess.completed`
- `gpu.started`
- `gpu.completed`
- `scoring.completed`
- `interpretation.completed`
- `pdf.completed`
- `run.done`
- `run.failed`

## Reintentos

Permitidos:

- Upload callback perdido.
- Preprocessing temporal.
- LLM timeout.
- PDF renderer timeout.

No automaticos sin revision:

- GPU out of memory.
- Modelo no disponible.
- Asset corrupto.
- Violacion de politica de archivo.

## Cancelacion

Desde MVP:

- Cancelar si run esta en cola.
- Marcar cancelacion solicitada si el worker ya esta procesando.

Post-MVP:

- Cancelacion durable con Temporal si los workflows largos lo justifican.

