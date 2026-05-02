# Sprint 25 · LLM real + guardrails

Fecha: 2026-05-02

## Objetivo

Conectar la generacion de informes a OpenAI real sin enviar archivos brutos al LLM.

El router mantiene fallback local si no existe `OPENAI_API_KEY`, pero en produccion llama a OpenAI Responses API con salida JSON estructurada.

## Implementado

### Router OpenAI

`backend/app/services/llm_router.py` ahora soporta:

- llamada real a `POST /v1/responses`.
- modelo de interpretacion: `LLM_INTERPRETER_MODEL`.
- modelo de redaccion: `LLM_WRITER_MODEL`.
- `reasoning.effort` configurable con `LLM_WRITER_REASONING_EFFORT`.
- salida `json_schema` estricta.
- reintentos controlados con `LLM_JSON_MAX_RETRIES`.
- fallback local cuando no hay API key.

### Politica de datos

El payload enviado al LLM contiene solo metricas estructuradas:

- summary.
- editorial scores.
- network scores.
- top region scores.
- peak moments.
- timecourse events seleccionados.

No se envian video, audio, transcript bruto, storage keys ni archivos originales.

### Guardrails

Hay dos pasadas:

1. Preflight sobre strings del contexto estructurado.
2. Postflight sobre la salida del modelo.

Si aparece un claim prohibido, se reescribe y se guarda el hallazgo en `guardrail_findings` y `report_payload.llm_trace`.

### Coste y trazabilidad

El informe guarda:

- proveedor.
- modelos usados.
- prompt version.
- input tokens.
- output tokens.
- coste estimado.
- response IDs.
- numero de reintentos JSON.

`backend/app/repositories/reporting_db.py` registra cada informe en `usage_events` con `event_type='report_generation'`.

El coste no inventa precios: se calcula solo con:

- `LLM_INPUT_EUR_PER_1K`.
- `LLM_OUTPUT_EUR_PER_1K`.

Si estan a `0`, el coste queda registrado como `0` hasta que se cargue tarifa real.

## Variables nuevas

```bash
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_TIMEOUT_SECONDS=60
LLM_INTERPRETER_MODEL=gpt-5.5-pro
LLM_WRITER_MODEL=gpt-5.5-thinking
LLM_WRITER_REASONING_EFFORT=high
LLM_PROMPT_VERSION=report-master-v0.1
LLM_JSON_MAX_RETRIES=2
LLM_INPUT_EUR_PER_1K=0
LLM_OUTPUT_EUR_PER_1K=0
```

## Gate

```bash
cd frontend
npm run llm:gate
```

El gate comprueba:

- uso de Responses API.
- schema JSON estricto.
- guardrails pre/post.
- token/cost tracking.
- payload sin archivos brutos.
- registro de `usage_events`.
- fallback local sin API key.
- ruta OpenAI simulada sin llamar a red.

## Comprobar modelos reales

Cuando tengamos `OPENAI_API_KEY`, ejecutar:

```bash
cd frontend
npm run openai:models
```

Este comando consulta `/v1/models` y verifica que `LLM_INTERPRETER_MODEL` y `LLM_WRITER_MODEL` existen en la cuenta que pagara el servicio.

## Pendiente externo

Necesito una `OPENAI_API_KEY` real y confirmar en esa cuenta los nombres exactos de modelo disponibles.

Mientras no haya clave, la app sigue generando informes con el modo local determinista para desarrollo y demos internas.
