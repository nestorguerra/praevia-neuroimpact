# Entornos y operacion v0.1

## Entornos

| Entorno | Uso | Datos |
| --- | --- | --- |
| Local | Desarrollo | Datos fake y assets pequenos. |
| Staging | QA, demos internas, pilotos simulados | Datos de prueba o cliente con permiso explicito. |
| Produccion | Pilotos reales | Datos reales con contrato, retencion y auditoria. |

## Separacion obligatoria

- DB distinta por entorno.
- Buckets distintos por entorno.
- Secrets distintos por entorno.
- Workers separados o colas separadas.
- Logs con environment tag.

## Secretos

Gestionar fuera del repo:

- Supabase URL/key.
- Storage access key.
- Token Hugging Face.
- OpenAI/Anthropic keys.
- Sentry DSN.
- Redis URL.
- Signing secrets.

## Operacion de jobs

Estados minimos:

- `queued`
- `validating`
- `preprocessing`
- `gpu_running`
- `scoring`
- `interpreting`
- `rendering_pdf`
- `done`
- `failed`
- `cancelled`

Cada job debe tener:

- started_at
- finished_at
- error_code
- error_message seguro
- retry_count
- provider_job_id
- logs_key si aplica

## Runbooks iniciales

Crear antes de produccion:

- Worker GPU no arranca.
- Modelo no descarga.
- GPU out of memory.
- PDF no renderiza.
- LLM devuelve claim prohibido.
- Upload incompleto.
- Cliente pide borrado.
- Coste mensual supera cap.

## QA minimo

- Smoke test login.
- Smoke test crear proyecto.
- Smoke test upload fake.
- Smoke test job mock.
- Smoke test dashboard.
- Smoke test PDF.
- Visual regression de login, upload, dashboard, report y landing.
- PDF regression con un informe de ejemplo.

## Retencion inicial

Propuesta:

- Demos internas: borrar assets a 30 dias.
- Pilotos: retencion acordada por contrato, por defecto 90 dias.
- Informes: conservar mientras dure el piloto salvo solicitud de borrado.
- Logs tecnicos: 90 dias sin datos sensibles.

