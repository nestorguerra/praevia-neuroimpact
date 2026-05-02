# Modelo de costes v0.1

## Objetivo

Evitar que una demo o piloto consuma GPU, LLM y storage sin control.

## Limites iniciales recomendados

| Tipo | Limite MVP | Motivo |
| --- | ---: | --- |
| Video | 90 segundos por asset | Suficiente para spots, teasers y piezas de evento cortas. |
| Audio | 10 minutos por asset | Permite podcasts/cortes, pero requiere control de coste. |
| Texto | 25.000 caracteres | Guiones y SRT de piezas cortas/medias. |
| A/B/C | Maximo 3 assets por experimento | Caso comercial estrella sin explotar costes. |
| Tamano video | 500 MB | Evita uploads imposibles en MVP. |
| Tamano audio | 150 MB | Mantiene preprocesamiento razonable. |
| Tamano texto | 5 MB | Suficiente para guiones/subtitulos. |

Estos limites se podran subir por plan o piloto.

## Unidad de credito

Propuesta inicial:

- 1 credito = 1 minuto de media procesado o fraccion.
- Texto puro consume minimo 1 credito por asset.
- A/B/C suma creditos por asset.
- Generacion PDF consume credito LLM/reporting separado si el plan lo exige.

Ejemplo:

- 1 video de 30s = 1 credito.
- 3 videos A/B/C de 30s = 3 creditos.
- 1 audio de 7m20s = 8 creditos.

## Componentes de coste por run

- Storage original.
- Storage derivados.
- Preprocesamiento CPU.
- Inferencia GPU.
- Scoring CPU.
- LLM draft/final/reviewer.
- Renderer PDF.
- Egress/download.

## Eventos de uso

Registrar en `usage_events`:

- `upload_started`
- `upload_completed`
- `health_check_completed`
- `preprocess_started`
- `preprocess_completed`
- `gpu_run_started`
- `gpu_run_completed`
- `scoring_completed`
- `llm_report_completed`
- `pdf_generated`
- `asset_deleted`

Campos minimos:

- organization_id
- project_id
- run_id
- asset_id
- user_id
- event_type
- credits_delta
- estimated_cost_eur
- provider
- duration_ms
- created_at

## Caps iniciales

- Cap por organizacion demo: 50 creditos.
- Cap por piloto Sprint 10: 10 assets incluidos.
- Cap piloto corporativo: 10-30 assets segun contrato.
- Alerta interna al 70% de creditos.
- Bloqueo suave al 100% salvo owner/admin.

## Perfil Google Cloud beta

Si movemos la beta a Google Cloud, usar estos limites iniciales:

| Componente | Cap inicial |
| --- | ---: |
| Presupuesto mensual GCP | 350 EUR |
| Alerta GCP | 50%, 75%, 90% |
| GPU TRIBE mensual | 7.200 segundos |
| Duracion maxima asset video | 180 segundos |
| Concurrencia worker GPU | 1 |
| Cloud SQL storage inicial | 20 GB |
| Cloud Storage retention | 90 dias |

El coste por asset debe medirse empiricamente con 10-20 runs reales. Hasta tener esa medicion, el precio comercial no debe prometer analisis ilimitados.

## Regla comercial

No vender como suscripcion barata. La primera oferta debe ser piloto premium con alcance cerrado, numero de piezas, workshops, informe y reanalisis definidos.
